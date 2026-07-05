"""Ingest RPI from a manual export drop. NEVER crawls resortparks.com (robots: Disallow: /).

Reads the NEWEST file in /data/rpi_manual/ (CSV or JSON). Jim drops an export there; newest wins.
If no file exists, RPI is simply skipped (its rows already in staging are preserved). Coordinates,
if the export lacks them, are geocoded downstream / carried forward from prior staging.

Output: pipeline/_staged/parks-rpi.json (list of normalized rows) or nothing if no drop present.
"""
import csv
import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

DROP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "rpi_manual")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_staged", "parks-rpi.json")


def newest_drop():
    files = [f for f in glob.glob(os.path.join(DROP_DIR, "*"))
             if f.lower().endswith((".csv", ".tsv", ".json"))]
    if not files:
        return None
    return max(files, key=os.path.getmtime)


def _coord(v):
    try:
        f = float(v)
        return f
    except (TypeError, ValueError):
        return None


def rows_from_json(path):
    data = json.load(open(path, encoding="utf-8"))
    recs = data.get("parks", data) if isinstance(data, dict) else data
    out = []
    for r in recs:
        name = (r.get("name") or "").strip()
        if not name:
            continue
        lat, lng = _coord(r.get("lat")), _coord(r.get("lng"))
        if not (lat is not None and lng is not None and common.in_bounds(lat, lng)):
            lat = lng = None
        out.append({
            "name": name, "city": (r.get("city") or None), "state": (r.get("state") or "")[:2].upper(),
            "network": "rpi", "brand": None, "lat": lat, "lng": lng,
            "source_url": r.get("source_url"),
        })
    return out


def rows_from_csv(path):
    out = []
    with open(path, encoding="utf-8-sig", newline="") as fh:
        for r in csv.DictReader(fh):
            g = {(k or "").lower().strip(): v for k, v in r.items()}
            name = (g.get("name") or g.get("resort") or g.get("park") or "").strip()
            if not name:
                continue
            lat, lng = _coord(g.get("lat") or g.get("latitude")), _coord(g.get("lng") or g.get("longitude"))
            if not (lat is not None and lng is not None and common.in_bounds(lat, lng)):
                lat = lng = None
            out.append({
                "name": name, "city": (g.get("city") or None),
                "state": (g.get("state") or g.get("st") or "")[:2].upper(),
                "network": "rpi", "brand": None, "lat": lat, "lng": lng, "source_url": None,
            })
    return out


def main():
    drop = newest_drop()
    if not drop:
        print(f"RPI: no export in {DROP_DIR} - skipped (existing staging rows preserved). No crawl.")
        # Signal 'no update' by not writing OUT.
        if os.path.exists(OUT):
            os.remove(OUT)
        return None
    rows = rows_from_json(drop) if drop.lower().endswith(".json") else rows_from_csv(drop)
    seen, dedup = set(), []
    for r in rows:
        k = common.natural_key("rpi", r["name"], r["city"], r["state"])
        if k in seen:
            continue
        seen.add(k)
        dedup.append(r)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({"source_file": os.path.basename(drop), "parks": dedup},
              open(OUT, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"RPI ingest <- {os.path.basename(drop)} -> {OUT}  rows={len(dedup)} (NO crawl)")
    return dedup


if __name__ == "__main__":
    main()
