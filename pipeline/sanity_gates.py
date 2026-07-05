"""Data-sanity gates. Fail loud, publish nothing on any breach.

Abort the run (write nothing to the app file, exit non-zero) if ANY of:
  * any network's row count drops > 20% vs last-known-good, or
  * overall coordinate completeness falls below 98%, or
  * any coordinate is out of continental bounds, or
  * total row count falls below last-known-good minus a small tolerance.

`check_gates` is pure and unit-testable. It returns (ok, failures, stats).
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

DROP_FRACTION = 0.20          # a network may not shrink by more than 20%
MIN_COORD_COMPLETENESS = 0.98  # overall coords present
TOTAL_TOLERANCE = 10           # total may not fall below LKG total minus this


def _counts(rows):
    by = {}
    for r in rows:
        by[r["network"]] = by.get(r["network"], 0) + 1
    return by


def check_gates(candidate_rows, last_known_counts, last_known_total):
    failures, stats = [], {}
    new_counts = _counts(candidate_rows)
    stats["network_counts"] = new_counts

    # 1. per-network >20% drop
    for net, prev in (last_known_counts or {}).items():
        now = new_counts.get(net, 0)
        if prev > 0 and now < prev * (1 - DROP_FRACTION):
            failures.append(f"{net} dropped {prev}->{now} (> {int(DROP_FRACTION*100)}%)")

    # 2. overall coord completeness
    total = len(candidate_rows)
    have = sum(1 for r in candidate_rows if r.get("lat") is not None and r.get("lng") is not None)
    completeness = (have / total) if total else 0.0
    stats["coord_completeness"] = round(completeness, 4)
    stats["total"] = total
    if completeness < MIN_COORD_COMPLETENESS:
        failures.append(f"coord completeness {completeness:.3f} < {MIN_COORD_COMPLETENESS}")

    # 3. any out-of-bounds coordinate
    oob = [r for r in candidate_rows
           if r.get("lat") is not None and not common.in_bounds(r["lat"], r["lng"])]
    if oob:
        failures.append(f"{len(oob)} out-of-bounds coordinate(s), e.g. "
                        f"{oob[0]['name']} ({oob[0].get('lat')},{oob[0].get('lng')})")

    # 4. total below last-known-good minus tolerance
    if last_known_total and total < last_known_total - TOTAL_TOLERANCE:
        failures.append(f"total {total} < last-known-good {last_known_total} - {TOTAL_TOLERANCE}")

    return (len(failures) == 0), failures, stats
