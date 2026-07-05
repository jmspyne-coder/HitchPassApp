"""Scrape Coast to Coast from the coastresorts.com directory (live, robots-allowed).

/directory/ and /directory/_results.cfm are not disallowed by robots. One polite GET per state
against _results.cfm?State=<XX>, ~1.2s apart. C2C exposes NO coordinates, so rows land with
lat/lng NULL and are geocoded downstream (delta-only) or carried forward from prior staging.

Output: pipeline/_staged/parks-c2c.json  (list of normalized rows). No MotherDuck writes here.
"""
import json
import os
import re
import sys
import time

from bs4 import BeautifulSoup
import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

DIRECTORY = "https://www.coastresorts.com/directory/"
RESULTS = "https://www.coastresorts.com/directory/_results.cfm"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_staged", "parks-c2c.json")

# Fallback state/province list if the directory form cannot be read (form is preferred).
FALLBACK_STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
    "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT",
    "VA", "WA", "WV", "WI", "WY", "DC", "AB", "BC", "MB", "NB", "NS", "ON", "QC", "SK",
]


def state_codes(session):
    try:
        html = common.polite_get(session, DIRECTORY)
        sel = BeautifulSoup(html, "lxml").find("select", {"name": "State"})
        codes = []
        for o in sel.find_all("option"):
            v = (o.get("value") or "").strip()
            if v and len(v) == 2:
                codes.append(v.upper())
        if codes:
            return codes
    except Exception as e:  # noqa: BLE001
        print(f"  (directory form unreadable: {e}; using fallback state list)")
    return FALLBACK_STATES


def parse_state(html, st):
    soup = BeautifulSoup(html, "lxml")
    rows = []
    for td in soup.select("td.resort-name"):
        a = td.find("a", href=True)
        name = (a.get_text(strip=True) if a else td.get_text(strip=True)).strip()
        if not name:
            continue
        rcode = None
        if a:
            m = re.search(r"RCODE-(\d+)", a["href"])
            if m:
                rcode = m.group(1)
        tds = td.find_parent("tr").find_all("td")
        idx = tds.index(td)
        city = tds[idx + 1].get_text(strip=True) if idx + 1 < len(tds) else ""
        stt = tds[idx + 2].get_text(strip=True) if idx + 2 < len(tds) else st
        stt = (stt or st).strip().upper()[:2]
        rows.append({
            "name": name, "city": city or None, "state": stt, "network": "c2c",
            "brand": None, "lat": None, "lng": None, "rcode": rcode,
            "source_url": ("https://www.coastresorts.com" + a["href"]) if a else RESULTS + "?State=" + st,
        })
    return rows


def main():
    sess = requests.Session()
    sess.headers["User-Agent"] = common.UA
    codes = state_codes(sess)
    print(f"C2C: enumerating {len(codes)} states")
    all_rows = []
    for st in codes:
        try:
            html = common.polite_get(
                sess, RESULTS, params={"State": st, "zip": "", "park_name": "", "resort_code": ""})
            rows = parse_state(html, st)
        except Exception as e:  # noqa: BLE001
            print(f"  {st}: ERROR {e}")
            rows = []
        all_rows.extend(rows)
        if rows:
            print(f"  {st}: {len(rows)}")
        time.sleep(1.2)
    seen, dedup = set(), []
    for r in all_rows:
        k = r["rcode"] or common.natural_key("c2c", r["name"], r["city"], r["state"])
        if k in seen:
            continue
        seen.add(k)
        dedup.append(r)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({"source_url": RESULTS, "parks": dedup},
              open(OUT, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"C2C scrape -> {OUT}  raw={len(all_rows)} deduped={len(dedup)}")
    return dedup


if __name__ == "__main__":
    main()
