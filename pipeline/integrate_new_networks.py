"""One-shot integration of the PA + KOA scrape output into the committed app data.

The scheduled pipeline (run_pipeline.py) is intentionally OFF (manual dispatch, DRY-RUN) and routes
through MotherDuck. This script does the equivalent for the immediate ship: it takes the current
committed parks.data.json plus the freshly scraped PA/KOA rows and regenerates parks.data.json using
the SAME stable-id logic (export_app_data.build_parks), so existing parks keep their ids and only the
new PA/KOA parks receive fresh ids. It also emits JS-literal lines for the new parks so they can be
appended to index.html's inline offline-fallback array, keeping the two in parity.

Run after scrape_pa.py and scrape_koa.py have written pipeline/_staged/{pa,koa}_rows.json.
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import export_app_data as export  # noqa: E402

STAGED = os.path.join(HERE, "_staged")
COMMITTED = os.path.join(os.path.dirname(HERE), "parks.data.json")
INLINE_OUT = os.path.join(STAGED, "inline_new.txt")


def load_rows(name):
    p = os.path.join(STAGED, name)
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else []


def as_staging(prior):
    """Existing committed parks -> staging-row shape build_parks consumes."""
    return [
        {
            "name": p["name"],
            "city": p.get("city"),
            "state": p.get("st"),
            "network": p["network"],
            "lat": p.get("lat"),
            "lng": p.get("lng"),
        }
        for p in prior
    ]


def js_literal(park):
    # Match the inline array's JS object style: unquoted keys, JSON-encoded string values.
    def s(v):
        return json.dumps(v, ensure_ascii=False)

    parts = [
        f'id:{park["id"]}',
        f'name:{s(park["name"])}',
        f'city:{s(park.get("city",""))}',
        f'st:{s(park.get("st",""))}',
        f'network:{s(park["network"])}',
    ]
    if "lat" in park and "lng" in park:
        parts += [f'lat:{park["lat"]}', f'lng:{park["lng"]}']
    return "    { " + ", ".join(parts) + " }"


def main():
    prior = export.load_prior(COMMITTED)
    pa = load_rows("pa_rows.json")
    koa = load_rows("koa_rows.json")
    prior_ids = {int(p["id"]) for p in prior}

    candidate = as_staging(prior) + pa + koa
    parks, stats = export.build_parks(candidate, prior)
    export.write(parks, COMMITTED)

    new_parks = [p for p in parks if int(p["id"]) not in prior_ids]
    with open(INLINE_OUT, "w", encoding="utf-8") as f:
        f.write(",\n".join(js_literal(p) for p in new_parks) + "\n")

    print(f"prior parks:      {len(prior)}")
    print(f"pa scraped:       {len(pa)}")
    print(f"koa scraped:      {len(koa)}")
    print(f"total parks now:  {stats['total']}")
    print(
        f"new parks added:  {stats['new_parks']}  (removed: {stats['removed_parks']})"
    )
    print(f"by network:       {stats['by_network']}")
    print(f"inline JS lines -> {INLINE_OUT} ({len(new_parks)} entries)")
    return stats


if __name__ == "__main__":
    main()
