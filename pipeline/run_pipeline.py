"""Orchestrator for the Hitch Pass parks refresh.

Order: scrape robots-allowed networks (tt/enc/dc, c2c) -> ingest RPI drop (no crawl) -> upsert into
hitchpass.parks_staging carrying coords forward -> delta-geocode new rows (free) -> sanity gates ->
regenerate the app data file.

DRY_RUN (default "1"): writes to MotherDuck hitchpass.parks_staging and generates the app file to an
ARTIFACT path (pipeline/_staged/parks.data.json). It never overwrites the committed parks.data.json and
never commits or pushes. Set DRY_RUN=0 only from the go-live step that also adds the commit.

Exit codes: 0 ok; 1 sanity gate failure (nothing written to the app file); 2 data-separation halt.
"""
import json
import os
import sys
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import common          # noqa: E402
import scrape_els      # noqa: E402
import scrape_c2c      # noqa: E402
import ingest_rpi      # noqa: E402
import geocode         # noqa: E402
import upsert          # noqa: E402
import sanity_gates    # noqa: E402
import export_app_data as export  # noqa: E402

STAGED = os.path.join(HERE, "_staged")
ARTIFACT_JSON = os.path.join(STAGED, "parks.data.json")
REPORT = os.path.join(STAGED, "report.json")
COMMITTED = os.path.join(os.path.dirname(HERE), "parks.data.json")
DRY_RUN = os.environ.get("DRY_RUN", "1") != "0"


def load_existing(con):
    rows = con.execute("""SELECT name, city, state, network, brand, lat, lng, source_url,
                                 CAST(scraped_at AS VARCHAR), geo_source
                          FROM hitchpass.parks_staging""").fetchall()
    cols = ["name", "city", "state", "network", "brand", "lat", "lng", "source_url", "scraped_at", "geo_source"]
    return [dict(zip(cols, r)) for r in rows]


def counts(rows):
    by = {}
    for r in rows:
        by[r["network"]] = by.get(r["network"], 0) + 1
    return by


def seed_staging_if_empty(con, now_iso):
    """First run on a fresh MotherDuck account: initialize hitchpass.parks_staging from the committed
    parks.data.json so all coordinates (including RPI, which is never scraped) are present and the sanity
    gates pass without a manual migration. Also a disaster-recovery path if staging is ever lost. No-op
    once staging has rows."""
    import export_app_data as export
    con.execute("""CREATE TABLE IF NOT EXISTS hitchpass.parks_staging (
        name TEXT, city TEXT, state TEXT, network TEXT, brand TEXT,
        lat DOUBLE, lng DOUBLE, source_url TEXT, scraped_at TIMESTAMP, geo_source TEXT)""")
    if con.execute("SELECT count(*) FROM hitchpass.parks_staging").fetchone()[0]:
        return 0
    prior = export.load_prior(COMMITTED)
    if not prior:
        return 0
    tuples = [(p["name"], p.get("city"), p.get("st"), p["network"], None,
               p.get("lat"), p.get("lng"), None, now_iso, "seed") for p in prior]
    con.executemany("INSERT INTO hitchpass.parks_staging VALUES (?,?,?,?,?,?,?,?,?,?)", tuples)
    return len(tuples)


def safe_scrape(fn, label):
    """Run a scraper/ingest; a failure (e.g. an HTTP 403 bot-block) is logged and returned as None so
    the orchestrator carries that network forward instead of crashing the whole refresh."""
    try:
        return fn()
    except Exception as e:  # noqa: BLE001
        print(f"WARN: {label} source failed ({e}); carrying forward existing rows for it")
        return None


def main():
    os.makedirs(STAGED, exist_ok=True)
    now_iso = datetime.now(timezone.utc).isoformat()
    print(f"=== parks-refresh (DRY_RUN={DRY_RUN}) {now_iso} ===")

    # 1-3. gather scraped/ingested rows. A source that 403-blocks or errors is NON-FATAL: that network
    # is carried forward from existing staging and the run still produces a valid artifact. Sites bot-
    # challenge GitHub's datacenter IPs intermittently, so one bad fetch must not fail the whole refresh.
    els = safe_scrape(scrape_els.main, "els (tt/enc/dc)")
    c2c = safe_scrape(scrape_c2c.main, "c2c")
    rpi = safe_scrape(ingest_rpi.main, "rpi")
    scraped_networks = []
    if els:
        scraped_networks += ["tt", "enc", "dc"]
    if c2c:
        scraped_networks += ["c2c"]
    if rpi:
        scraped_networks += ["rpi"]
    scraped_rows = (els or []) + (c2c or []) + (rpi or [])
    for r in scraped_rows:
        r["scraped_at"] = now_iso
    skipped = [n for n in ("tt", "enc", "dc", "c2c") if n not in scraped_networks]
    if skipped:
        print(f"NOTE: source unavailable this run; carried forward from existing: {skipped}")

    # 4. connect; bootstrap an empty staging from the committed file, then snapshot last-known-good
    con = common.connect()
    seeded = seed_staging_if_empty(con, now_iso)
    if seeded:
        print(f"bootstrap: seeded {seeded} rows into empty parks_staging from committed parks.data.json")
    existing = load_existing(con)
    lkg_counts, lkg_total = counts(existing), len(existing)
    print("last-known-good:", lkg_counts, "total", lkg_total)

    # 5. carry coords forward, then delta-geocode the rows still missing coords
    merged = upsert.merge_coords(scraped_rows, existing)
    filled, flagged = geocode.geocode_rows(merged)

    # candidate full dataset = refreshed scraped networks + untouched other networks
    candidate = merged + [e for e in existing if e["network"] not in scraped_networks]

    # 6. sanity gates
    ok, failures, stats = sanity_gates.check_gates(candidate, lkg_counts, lkg_total)
    report = {"generated_at": now_iso, "dry_run": DRY_RUN, "scraped_networks": scraped_networks,
              "carried_forward_networks": skipped,
              "last_known_good": {"counts": lkg_counts, "total": lkg_total},
              "candidate_stats": stats, "geocode": {"filled": filled, "flagged": flagged},
              "gates_passed": ok, "gate_failures": failures}

    if not ok:
        json.dump(report, open(REPORT, "w", encoding="utf-8"), indent=2)
        print("\n*** SANITY GATES FAILED - nothing written to the app file ***")
        for f in failures:
            print("  -", f)
        con.close()
        sys.exit(1)

    # 7. gates pass -> persist staging + regenerate the app file
    written = upsert.write_staging(con, merged, scraped_networks, now_iso)
    print(f"staging: refreshed {written} rows across {scraped_networks}")
    con.close()

    prior = export.load_prior(COMMITTED)
    parks, ex_stats = export.build_parks(candidate, prior)
    report["export"] = ex_stats
    target = COMMITTED if not DRY_RUN else ARTIFACT_JSON
    export.write(parks, target)
    json.dump(report, open(REPORT, "w", encoding="utf-8"), indent=2)

    print("\n=== per-network (last-known -> candidate) ===")
    for net in common.NETWORKS:
        print(f"  {net:4} {lkg_counts.get(net,0):>5} -> {stats['network_counts'].get(net,0):<5}")
    print(f"  coord completeness: {stats['coord_completeness']*100:.2f}%")
    print(f"  new parks: {ex_stats['new_parks']}  removed: {ex_stats['removed_parks']}")
    print(f"app file written to: {target}  ({'ARTIFACT - committed file untouched' if DRY_RUN else 'COMMITTED PATH'})")
    print("report:", REPORT)


if __name__ == "__main__":
    main()
