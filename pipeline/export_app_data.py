"""Regenerate the app's parks.data.json from staging, with STABLE ids.

The app resolves saved trips via parkById(id), so ids must never be renumbered. Each staging row
reuses the id of the matching record in the CURRENT parks.data.json (matched on natural key); only
genuinely new parks receive a fresh id (max existing id + 1). Output is ordered by id so the file
diffs cleanly run to run.

`build_parks` is a pure function (unit-testable offline). In dry-run the orchestrator writes the result
to an artifact path, never over the committed file.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COMMITTED = os.path.join(REPO, "parks.data.json")
FIELDS = ["id", "name", "city", "st", "network", "lat", "lng"]


def load_prior(path=COMMITTED):
    try:
        return json.load(open(path, encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return []


def build_parks(staging_rows, prior_parks):
    """Return (parks_list, stats). Ids stable via natural-key + occurrence match to prior_parks.

    Some parks share a natural key (e.g. C2C lists 'COTA RV Park, Austin TX' twice under different
    resort codes). Keying by (natural_key, nth-occurrence) preserves every distinct record instead of
    collapsing duplicates, and reuses the prior id for the nth occurrence so ids stay stable.
    """
    from collections import defaultdict
    prior_lists = defaultdict(list)   # natural_key -> [ids] in ascending id order
    max_id = 0
    for p in sorted(prior_parks, key=lambda x: int(x["id"])):
        k = common.natural_key(p.get("network"), p.get("name"), p.get("city"), p.get("st"))
        prior_lists[k].append(int(p["id"]))
        max_id = max(max_id, int(p["id"]))

    occ = defaultdict(int)
    out, new_ids, next_id = [], 0, max_id
    for r in staging_rows:
        k = common.natural_key(r["network"], r["name"], r.get("city"), r.get("state"))
        n = occ[k]
        occ[k] += 1
        ids = prior_lists.get(k, [])
        if n < len(ids):
            pid = ids[n]
        else:
            next_id += 1
            pid = next_id
            new_ids += 1
        rec = {"id": pid, "name": r["name"], "city": r.get("city") or "",
               "st": (r.get("state") or ""), "network": r["network"]}
        if r.get("lat") is not None and r.get("lng") is not None:
            rec["lat"], rec["lng"] = r["lat"], r["lng"]
        out.append(rec)

    out.sort(key=lambda p: p["id"])
    removed = 0
    removed_sample = []
    for k, ids in prior_lists.items():
        gone = len(ids) - occ.get(k, 0)
        if gone > 0:
            removed += gone
            if len(removed_sample) < 10:
                removed_sample.append(f"{k[0]}:{k[1]}")
    stats = {
        "total": len(out),
        "new_parks": new_ids,
        "removed_parks": removed,
        "removed_sample": removed_sample,
        "by_network": _counts(out),
    }
    return out, stats


def _counts(parks):
    by = {}
    for p in parks:
        by[p["network"]] = by.get(p["network"], 0) + 1
    return by


def serialize(parks):
    # Compact separators (",", ":") to match the app's JSON.stringify output byte-for-byte,
    # so a data refresh diffs as just the changed rows, not a whole-file reformat.
    lines = []
    for p in parks:
        o = {f: p[f] for f in FIELDS if f in p}
        lines.append("  " + json.dumps(o, ensure_ascii=False, separators=(",", ":")))
    return "[\n" + ",\n".join(lines) + "\n]\n"


def write(parks, path):
    open(path, "w", encoding="utf-8").write(serialize(parks))
