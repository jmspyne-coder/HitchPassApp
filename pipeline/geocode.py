"""Free-tier geocoder: US Census onelineaddress -> Nominatim fallback. Delta-only, never fabricates.

Only rows with a NULL coordinate are geocoded (existing coords are carried forward by upsert, so
this is a small delta on each run). A candidate coordinate is ACCEPTED only if:
  * it is within continental bounds, AND
  * its resolved state matches the row's expected state, AND
  * it lands within ~40 km of the row's city centroid (when the city can be resolved).
Otherwise the row keeps a NULL coordinate and is reported as flagged. No coordinate is ever invented.

Free only. Census has no key. Nominatim requires a descriptive User-Agent and <=1 req/sec; we honor
both. Results are cached to pipeline/_staged/geocode_cache.json so unchanged rows never re-hit a service.
"""
import json
import os
import sys
import time

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

CACHE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_staged", "geocode_cache.json")
NOMINATIM = "https://nominatim.openstreetmap.org/search"
CENSUS = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
CONTACT_UA = "HitchPassParksPipeline/1.0 (contact: hitch-pass-app.vercel.app)"
MAX_CITY_KM = 40.0

_cache = None


def _load_cache():
    global _cache
    if _cache is None:
        try:
            _cache = json.load(open(CACHE_PATH, encoding="utf-8"))
        except Exception:  # noqa: BLE001
            _cache = {}
    return _cache


def _save_cache():
    if _cache is not None:
        os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
        json.dump(_cache, open(CACHE_PATH, "w", encoding="utf-8"), indent=0)


def _census(session, address):
    try:
        r = session.get(CENSUS, params={"address": address, "benchmark": "Public_AR_Current",
                                         "format": "json"}, timeout=30)
        matches = r.json().get("result", {}).get("addressMatches", [])
        if matches:
            c = matches[0]["coordinates"]
            st = matches[0].get("addressComponents", {}).get("state")
            return float(c["y"]), float(c["x"]), st
    except Exception:  # noqa: BLE001
        pass
    return None


def _nominatim(session, query):
    # 1 req/sec throttle is the caller's responsibility (we sleep after each Nominatim call).
    try:
        r = session.get(NOMINATIM, params={"q": query, "format": "jsonv2", "limit": 1,
                                            "addressdetails": 1, "countrycodes": "us,ca"}, timeout=30)
        data = r.json()
        if data:
            d = data[0]
            st = (d.get("address", {}) or {}).get("state")
            return float(d["lat"]), float(d["lon"]), st
    finally:
        time.sleep(1.05)
    return None


# US/CA state name -> abbreviation for verifying the resolved state.
_ST = {
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
    "quebec": "QC", "quebec ": "QC", "manitoba": "MB", "saskatchewan": "SK", "nova scotia": "NS",
    "new brunswick": "NB",
}


def _st_abbr(name):
    if not name:
        return None
    n = name.strip().lower()
    if n in _ST:
        return _ST[n]
    if len(name.strip()) == 2:
        return name.strip().upper()
    return None


def _city_centroid(session, city, state):
    if not city:
        return None
    cache = _load_cache()
    key = "city::" + common.norm(city) + "::" + (state or "")
    if key in cache:
        v = cache[key]
        return (v[0], v[1]) if v else None
    hit = _nominatim(session, f"{city}, {state}, USA")
    cache[key] = [hit[0], hit[1]] if hit else None
    return (hit[0], hit[1]) if hit else None


def geocode_rows(rows):
    """Fill lat/lng for rows whose coordinate is NULL. Returns (filled_count, flagged_list)."""
    cache = _load_cache()
    session = requests.Session()
    session.headers["User-Agent"] = CONTACT_UA
    filled, flagged = 0, []
    todo = [r for r in rows if r.get("lat") is None or r.get("lng") is None]
    print(f"geocode: {len(todo)} row(s) need coordinates (delta only)")
    for r in todo:
        exp_state = (r.get("state") or "").strip().upper()[:2]
        key = "park::" + "::".join(common.natural_key(
            r["network"], r["name"], r.get("city"), r.get("state")))
        if key in cache:
            cand = cache[key]
        else:
            query = ", ".join(x for x in [r["name"], r.get("city"), exp_state, "USA"] if x)
            cand = _census(session, query) or _nominatim(session, query)
            cache[key] = cand
        if not cand:
            flagged.append({**_slim(r), "reason": "no_geocoder_match"})
            continue
        lat, lng, resolved_state = cand
        if not common.in_bounds(lat, lng):
            flagged.append({**_slim(r), "reason": "out_of_bounds"})
            continue
        rs = _st_abbr(resolved_state)
        if exp_state and rs and rs != exp_state:
            flagged.append({**_slim(r), "reason": f"state_mismatch(exp={exp_state},got={rs})"})
            continue
        centroid = _city_centroid(session, r.get("city"), exp_state)
        if centroid:
            dist = common.haversine_km(lat, lng, centroid[0], centroid[1])
            if dist > MAX_CITY_KM:
                flagged.append({**_slim(r), "reason": f"far_from_city({dist:.0f}km)"})
                continue
        r["lat"], r["lng"] = lat, lng
        filled += 1
    _save_cache()
    print(f"geocode: filled={filled} flagged={len(flagged)}")
    return filled, flagged


def _slim(r):
    return {"name": r["name"], "city": r.get("city"), "state": r.get("state"), "network": r["network"]}
