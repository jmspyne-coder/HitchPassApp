"""KOA (Kampgrounds of America) source for the parks pipeline.

KOA's campground pages are listed in a public sitemap and each canonical campground page embeds a
schema.org `Campground`/`RVPark` JSON-LD block with a full postal address and geo coordinates. We
take the root campground URLs from the sitemap (`/campgrounds/<slug>/`, not the /reviews, /site-type,
/blog sub-pages) and read the JSON-LD, so coordinates come straight from KOA and need no geocoding.

KOA fronts its pages with Cloudflare, which serves a challenge to a bare client but real content to a
normal browser User-Agent (`common.BROWSER_HEADERS`), so a polite browser-style GET is sufficient; no
headless browser is required. robots.txt allows `/campgrounds/<slug>/`; only reservation/popup/query
sub-paths are disallowed and we never fetch those.

Progress is cached to `_staged/koa_rows.json` so an interrupted run resumes instead of refetching.
Returns pipeline staging rows: {name, city, state, network:"koa", brand, lat, lng, source_url,
geo_source}.
"""

import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

SITEMAP = "https://koa.com/sitemaps/campground-pages-sitemap.xml"
# The sitemap lists only per-campground SUB-pages (/reviews, /site-type/..., /blog/...); the canonical
# campground page is the first path segment. We derive the distinct roots from that segment.
SLUG_RE = re.compile(r"^https://koa\.com/campgrounds/([^/]+)/")
LD_RE = re.compile(
    r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>',
    re.DOTALL | re.IGNORECASE,
)
STAGED = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_staged")
CACHE = os.path.join(STAGED, "koa_rows.json")


def sitemap_roots(sess):
    xml = common.polite_get(sess, SITEMAP)
    locs = re.findall(r"<loc>\s*([^<]+?)\s*</loc>", xml)
    slugs = set()
    for u in locs:
        m = SLUG_RE.match(u)
        if m:
            slugs.add(m.group(1))
    return [f"https://koa.com/campgrounds/{s}/" for s in sorted(slugs)]


def _first_geo_ld(html):
    """Return the first JSON-LD node (searching @graph too) that carries a geo lat/lng."""
    for block in LD_RE.findall(html):
        block = block.strip()
        try:
            data = json.loads(block)
        except Exception:  # noqa: BLE001
            continue
        nodes = data.get("@graph", [data]) if isinstance(data, dict) else data
        if isinstance(nodes, dict):
            nodes = [nodes]
        for n in nodes:
            if (
                isinstance(n, dict)
                and isinstance(n.get("geo"), dict)
                and n["geo"].get("latitude") is not None
            ):
                return n
    return None


def parse_page(html, url):
    node = _first_geo_ld(html)
    if not node:
        return None
    geo = node.get("geo", {})
    try:
        lat = round(float(geo.get("latitude")), 6)
        lng = round(float(geo.get("longitude")), 6)
    except (TypeError, ValueError):
        return None
    if not common.in_bounds(lat, lng):
        return None
    addr = node.get("address") or {}
    if isinstance(addr, list):
        addr = addr[0] if addr else {}
    name = (node.get("name") or "").strip()
    city = (addr.get("addressLocality") or "").strip()
    state = (addr.get("addressRegion") or "").strip().upper()[:2]
    if not name:
        return None
    return {
        "name": name,
        "city": city,
        "state": state,
        "network": "koa",
        "brand": None,
        "lat": lat,
        "lng": lng,
        "source_url": url,
        "geo_source": "koa_jsonld",
    }


def main():
    import requests

    sess = requests.Session()
    sess.headers.update(common.BROWSER_HEADERS)
    roots = sitemap_roots(sess)
    print(f"koa: {len(roots)} campground root URLs in sitemap", file=sys.stderr)

    os.makedirs(STAGED, exist_ok=True)
    done = {}
    if os.path.exists(CACHE):
        try:
            for r in json.load(open(CACHE, encoding="utf-8")):
                done[r["source_url"]] = r
        except Exception:  # noqa: BLE001
            done = {}

    rows = dict(done)
    misses = 0
    for i, url in enumerate(roots, 1):
        if url in rows:
            continue
        try:
            html = common.polite_get(sess, url, tries=2, pause=1.0)
            rec = parse_page(html, url)
            if rec:
                rows[url] = rec
            else:
                misses += 1
        except Exception as e:  # noqa: BLE001
            misses += 1
            print(f"  miss {url}: {e}", file=sys.stderr)
        if i % 25 == 0:
            json.dump(
                list(rows.values()),
                open(CACHE, "w", encoding="utf-8"),
                ensure_ascii=False,
                indent=1,
            )
            print(
                f"  ...{i}/{len(roots)} fetched, {len(rows)} parsed, {misses} misses",
                file=sys.stderr,
            )
        time.sleep(0.7)

    out = list(rows.values())
    json.dump(out, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"koa: {len(out)} rows parsed ({misses} misses) -> {CACHE}", file=sys.stderr)
    return out


if __name__ == "__main__":
    out = main()
    print(f"wrote {len(out)} rows -> {CACHE}")
