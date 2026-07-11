"""Passport America source for the parks pipeline.

PA's public site is a client-rendered Angular app whose campground directory is backed by a
Firebase Firestore collection (`campgrounds`) in the project `ionicapp-970ad`. That collection is
world-readable over the Firestore REST API with the app's own web apiKey (no App Check enforced on
reads), so we pull the canonical records directly instead of scraping the JS-rendered pages. This
yields real coordinates and addresses (no geocoding needed) for the whole network.

Each Firestore document already carries `lat`/`lng`, a 2-letter `state`, `country`, and a `dropped`
date (far-future for active parks, a past date once a campground leaves the program). We keep active
US/Canada/Mexico parks whose coordinates land inside North-America bounds.

Returns pipeline staging rows: {name, city, state, network:"pa", brand, lat, lng, source_url,
geo_source}. Robots note: this is a Google Firestore API read with the site's own public key, not a
crawl of passportamerica.com; no page under the site's robots rules is fetched.
"""

import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

PROJECT = "ionicapp-970ad"
API_KEY = "AIzaSyDGeoFNSau-s-X1tP3YIBmB943AzAQ4q-U"  # PA web app's public Firebase key (client-side, not a secret)
COLLECTION = "campgrounds"
BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/{COLLECTION}"
KEEP_COUNTRIES = {"US", "CA", "MX"}
CACHE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "_staged", "pa_rows.json"
)


def _val(fields, key):
    x = fields.get(key)
    if not x:
        return None
    return next(iter(x.values()))


def _active(dropped, today):
    """`dropped` is a YYYY-MM-DD date; a park still in the program carries a far-future date.
    Missing/blank is treated as active. A date strictly before today means it left the program.
    """
    if not dropped:
        return True
    return str(dropped)[:10] >= today


def fetch_docs():
    import requests

    sess = requests.Session()
    sess.headers.update({"User-Agent": common.UA, "Accept": "application/json"})
    docs, token = [], None
    while True:
        params = {"pageSize": 300, "key": API_KEY}
        if token:
            params["pageToken"] = token
        r = sess.get(BASE, params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        docs.extend(data.get("documents", []))
        token = data.get("nextPageToken")
        if not token:
            break
        time.sleep(0.4)
    return docs


def main():
    from datetime import date

    today = date.today().isoformat()
    docs = fetch_docs()
    rows, skipped_inactive, skipped_coords = [], 0, 0
    seen = set()
    for d in docs:
        f = d.get("fields", {})
        name = _val(f, "name")
        lat, lng = _val(f, "lat"), _val(f, "lng")
        state = (_val(f, "state") or "").strip().upper()[:2]
        country = (_val(f, "country") or "").strip().upper()[:2]
        city = _val(f, "city")
        dropped = _val(f, "dropped")
        if not name or country not in KEEP_COUNTRIES:
            continue
        if not _active(dropped, today):
            skipped_inactive += 1
            continue
        if not common.in_bounds(lat, lng):
            skipped_coords += 1
            continue
        key = common.natural_key("pa", name, city, state)
        if key in seen:
            continue
        seen.add(key)
        rows.append(
            {
                "name": name.strip(),
                "city": (city or "").strip(),
                "state": state,
                "network": "pa",
                "brand": None,
                "lat": round(float(lat), 6),
                "lng": round(float(lng), 6),
                "source_url": f"https://passportamerica.com/campgrounds ({d['name'].split('/')[-1]})",
                "geo_source": "pa_firestore",
            }
        )
    print(
        f"pa: {len(docs)} docs -> {len(rows)} active in-bounds rows "
        f"(skipped {skipped_inactive} inactive, {skipped_coords} bad-coords)",
        file=sys.stderr,
    )
    return rows


if __name__ == "__main__":
    out = main()
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    json.dump(out, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"wrote {len(out)} rows -> {CACHE}")
