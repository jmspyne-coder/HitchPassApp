"""Shared helpers for the Hitch Pass parks pipeline.

Connection, isolation guard, natural key, and small HTTP utilities. Writes ONLY to the
MotherDuck database `hitchpass`. Rootwork's `my_db` is off-limits and the connect helper
HALTS if this token can see rems/Rootwork data unless HITCHPASS_ALLOW_SHARED_ACCOUNT=1.
"""
import os
import re
import sys
import time

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

# Continental North America bounds — any coordinate outside these is rejected as impossible.
LAT_MIN, LAT_MAX = 14.0, 72.0
LNG_MIN, LNG_MAX = -170.0, -50.0

NETWORKS = ("tt", "enc", "dc", "c2c", "rpi")


def token():
    """MotherDuck token. Prefer the directive's MOTHERDUCK_TOKEN; fall back to the recon name."""
    t = (os.environ.get("MOTHERDUCK_TOKEN")
         or os.environ.get("HITCHPASS_MOTHERDUCK_TOKEN") or "").strip()
    if not t:
        sys.exit("ERROR: MOTHERDUCK_TOKEN is not set. Add it as a repo secret (see pipeline/README).")
    return t


def connect():
    """Connect to MotherDuck with NO default database, then USE hitchpass. Isolation-guarded."""
    import duckdb
    con = duckdb.connect(f"md:?motherduck_token={token()}")
    dbs = [r[0] for r in con.execute("SHOW DATABASES").fetchall()]
    risky = [d for d in dbs if d.lower() in ("my_db", "odoo_crm", "sample_data")
             or "rootwork" in d.lower() or "rems" in d.lower()]
    if risky and os.environ.get("HITCHPASS_ALLOW_SHARED_ACCOUNT") != "1":
        print("\n*** HALT - DATA SEPARATION ***")
        print("This MotherDuck token can also see:", risky)
        print("The pipeline writes ONLY to `hitchpass`, but per policy this shared-account run is a")
        print("deliberate choice. Re-run with HITCHPASS_ALLOW_SHARED_ACCOUNT=1 to proceed, or supply")
        print("a token scoped to a separate Hitch Pass MotherDuck account.")
        sys.exit(2)
    con.execute("CREATE DATABASE IF NOT EXISTS hitchpass")
    con.execute("USE hitchpass")
    active = con.execute("SELECT current_database()").fetchone()[0]
    if active != "hitchpass":
        sys.exit(f"HALT: active database resolved to '{active}', not 'hitchpass'.")
    return con


def norm(s):
    return re.sub(r"\s+", " ", (s or "").strip()).lower()


def natural_key(network, name, city, state):
    """Stable per-park identity used for upsert and id carry-forward. Never depends on row order."""
    return (network, norm(name), norm(city), (state or "").strip().upper()[:2])


def in_bounds(lat, lng):
    try:
        lat = float(lat); lng = float(lng)
    except (TypeError, ValueError):
        return False
    return LAT_MIN <= lat <= LAT_MAX and LNG_MIN <= lng <= LNG_MAX


def haversine_km(a_lat, a_lng, b_lat, b_lng):
    from math import radians, sin, cos, asin, sqrt
    a_lat, a_lng, b_lat, b_lng = map(radians, (a_lat, a_lng, b_lat, b_lng))
    d_lat, d_lng = b_lat - a_lat, b_lng - a_lng
    h = sin(d_lat / 2) ** 2 + cos(a_lat) * cos(b_lat) * sin(d_lng / 2) ** 2
    return 2 * 6371.0088 * asin(sqrt(h))


def polite_get(session, url, params=None, tries=3, pause=1.2):
    """One robots-respecting GET with light retry. Callers own the throttle between calls."""
    import requests
    last = None
    for i in range(tries):
        try:
            r = session.get(url, params=params, timeout=30)
            if r.status_code == 200:
                return r.text
            last = f"HTTP {r.status_code}"
        except Exception as e:  # noqa: BLE001
            last = str(e)
        time.sleep(pause * (i + 1))
    raise RuntimeError(f"GET failed for {url} ({params}): {last}")
