"""Scrape Thousand Trails / Encore / Trails Collection from the ELS explore page (live GET).

One robots-allowed GET of https://thousandtrails.com/explore-campgrounds. The page is
server-rendered: each park is an <a class="newbook_crs_park"> carrying data-attr-brand,
data-attr-park-name, data-attr-state, data-attr-lat, data-attr-lng. Coordinates are exposed,
so these three networks need no geocoding. Brand splits the three networks directly:
  thousand-trails -> tt, encore-rv-resorts -> enc, destination-campgrounds -> dc.

Output: pipeline/_staged/parks-els.json  (list of normalized rows). No MotherDuck writes here.
"""
import json
import os
import sys

from bs4 import BeautifulSoup
import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

SOURCE_URL = "https://thousandtrails.com/explore-campgrounds"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_staged", "parks-els.json")

BRAND_TO_NET = {
    "thousand-trails": "tt",
    "encore-rv-resorts": "enc",
    "destination-campgrounds": "dc",
}

STATES = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA",
    "colorado": "CO", "connecticut": "CT", "delaware": "DE", "florida": "FL", "georgia": "GA",
    "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
    "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD", "massachusetts": "MA",
    "michigan": "MI", "minnesota": "MN", "mississippi": "MS", "missouri": "MO", "montana": "MT",
    "nebraska": "NE", "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
    "new york": "NY", "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
    "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
    "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT",
    "virginia": "VA", "washington": "WA", "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
    "district of columbia": "DC", "british columbia": "BC", "alberta": "AB", "ontario": "ON",
    "quebec": "QC", "manitoba": "MB", "saskatchewan": "SK", "nova scotia": "NS", "new brunswick": "NB",
}


def st_abbr(full, slug):
    if full and full.strip().lower() in STATES:
        return STATES[full.strip().lower()]
    if slug and slug.replace("-", " ").lower() in STATES:
        return STATES[slug.replace("-", " ").lower()]
    if full and len(full.strip()) == 2:
        return full.strip().upper()
    return None


def parse(html):
    soup = BeautifulSoup(html, "lxml")
    rows = []
    for a in soup.select("a.newbook_crs_park"):
        net = BRAND_TO_NET.get(a.get("data-attr-brand"))
        if not net:
            continue
        name = (a.get("data-attr-park-name") or "").strip()
        h2 = a.select_one(".newbook_crs_park_content h2")
        if not name and h2:
            name = h2.get_text(strip=True)
        if not name:
            continue
        p = a.select_one(".newbook_crs_park_content p")
        loc = p.get_text(strip=True) if p else ""
        city, state_full = "", ""
        if "," in loc:
            city, state_full = [x.strip() for x in loc.split(",", 1)]
        else:
            city = loc.strip()
        state = st_abbr(state_full, a.get("data-attr-state"))
        lat, lng = a.get("data-attr-lat"), a.get("data-attr-lng")
        lat = float(lat) if lat not in (None, "") else None
        lng = float(lng) if lng not in (None, "") else None
        # Never trust an out-of-bounds source coord; drop it to NULL so geocode/flag handles it.
        if lat is not None and lng is not None and not common.in_bounds(lat, lng):
            lat = lng = None
        rows.append({
            "name": name, "city": city or None, "state": state, "network": net,
            "brand": a.get("data-attr-brand"), "lat": lat, "lng": lng,
            "source_url": a.get("href") or SOURCE_URL,
        })
    return rows


def dedupe(rows):
    seen, out = set(), []
    for r in rows:
        k = common.natural_key(r["network"], r["name"], r["city"], r["state"])
        if k in seen:
            continue
        seen.add(k)
        out.append(r)
    return out


def main():
    sess = requests.Session()
    sess.headers.update(common.BROWSER_HEADERS)
    html = common.polite_get(sess, SOURCE_URL)
    rows = dedupe(parse(html))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({"source_url": SOURCE_URL, "parks": rows},
              open(OUT, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    by = {}
    for r in rows:
        by[r["network"]] = by.get(r["network"], 0) + 1
    missing = sum(1 for r in rows if r["lat"] is None)
    print(f"ELS scrape -> {OUT}")
    for net in ("tt", "enc", "dc"):
        print(f"  {net}: {by.get(net, 0)}")
    print(f"  total: {len(rows)}  coords_missing: {missing}")
    return rows


if __name__ == "__main__":
    main()
