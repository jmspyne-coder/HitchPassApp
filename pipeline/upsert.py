"""Upsert scraped rows into hitchpass.parks_staging, keyed on the stable natural key.

Idempotent: re-running with the same scrape yields the same staging (no duplicate rows). Coordinates
are CARRIED FORWARD from existing staging by natural key, so C2C/RPI rows we already geocoded are never
re-geocoded, and only genuinely new/moved rows arrive with a NULL coordinate for the delta geocode.

`merge_coords` is a pure function (unit-testable offline). `write_staging` performs the MotherDuck write
and only ever touches the networks that were refreshed this run.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

STAGING_COLS = ["name", "city", "state", "network", "brand", "lat", "lng",
                "source_url", "scraped_at", "geo_source"]


def merge_coords(scraped_rows, existing_rows):
    """Carry forward lat/lng/geo_source from existing staging onto freshly scraped rows.

    A row that arrives WITH a coordinate (tt/enc/dc expose them) keeps its fresh source coordinate.
    A row that arrives WITHOUT one (c2c/rpi) inherits the prior coordinate if we have it; otherwise it
    stays NULL for the geocoder. Returns a new list; does not mutate inputs.
    """
    from collections import defaultdict
    prior = defaultdict(list)   # natural_key -> [existing rows] (occurrence-indexed, matches export)
    for e in existing_rows:
        prior[common.natural_key(e["network"], e["name"], e.get("city"), e.get("state"))].append(e)
    occ = defaultdict(int)
    out = []
    for r in scraped_rows:
        row = dict(r)
        k = common.natural_key(row["network"], row["name"], row.get("city"), row.get("state"))
        n = occ[k]
        occ[k] += 1
        if row.get("lat") is None or row.get("lng") is None:
            plist = prior.get(k, [])
            p = plist[n] if n < len(plist) else None
            if p and p.get("lat") is not None and p.get("lng") is not None:
                row["lat"], row["lng"] = p["lat"], p["lng"]
                row.setdefault("geo_source", p.get("geo_source") or "carried")
        else:
            row.setdefault("geo_source", row.get("geo_source") or "source")
        out.append(row)
    return out


def write_staging(con, merged_rows, scraped_networks, now_iso):
    """Replace ONLY the scraped networks' rows in hitchpass.parks_staging; leave others intact."""
    con.execute("""CREATE TABLE IF NOT EXISTS hitchpass.parks_staging (
        name TEXT, city TEXT, state TEXT, network TEXT, brand TEXT,
        lat DOUBLE, lng DOUBLE, source_url TEXT, scraped_at TIMESTAMP, geo_source TEXT)""")
    nets = tuple(scraped_networks)
    con.execute("BEGIN")
    try:
        placeholders = ",".join(["?"] * len(nets))
        con.execute(f"DELETE FROM hitchpass.parks_staging WHERE network IN ({placeholders})", nets)
        tuples = [(
            r["name"], r.get("city"), r.get("state"), r["network"], r.get("brand"),
            r.get("lat"), r.get("lng"), r.get("source_url"), r.get("scraped_at") or now_iso,
            r.get("geo_source"),
        ) for r in merged_rows if r["network"] in scraped_networks]
        con.executemany(
            "INSERT INTO hitchpass.parks_staging VALUES (?,?,?,?,?,?,?,?,?,?)", tuples)
        con.execute("COMMIT")
    except Exception:
        con.execute("ROLLBACK")
        raise
    return len([r for r in merged_rows if r["network"] in scraped_networks])
