#!/usr/bin/env python3
"""T1 — Ingest: fetch the EU Register of Nutrition & Health Claims.

The official web UI (https://ec.europa.eu/food/food-feed-portal/screen/health-claims/eu-register)
is a JS single-page app. The underlying data is served by the FIP backend API.

Endpoint discovered by reverse-engineering the portal's network traffic:
    GET /backend/api/policy-items?foodDomain=nut&authorisationType=nut_auth

The response is a recursive "value tree" — one object per claim (2337 entries).
This script downloads it and stores the raw payload for the parsing step.

This is deliberately NOT using a polite public bulk-export: we want to show the
real "stubborn portal" fetch. We add a crawl delay and honest User-Agent.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlencode

import requests

FIP_API_BASE = "https://ec.europa.eu/food/food-feed-portal/backend/api"
DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 "
    "(sku-regulator demo; contact: <your-email>)"
)

POLICY_ITEMS_QUERY = {
    "foodDomain": "nut",  # nutrition / health claims domain
    "authorisationType": "nut_auth",  # EU health-claim authorisations
}


def fetch_json(url: str, session: requests.Session, retries: int = 3) -> dict | list:
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            resp = session.get(url, timeout=60)
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, ValueError) as err:
            last_err = err
            wait = 2**attempt
            print(f"    [retry {attempt}/{retries}] {type(err).__name__}: {err} — waiting {wait}s")
            time.sleep(wait)
    raise RuntimeError(f"Failed to fetch {url}: {last_err}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "data/raw/policy_items.json",
        help="output path for the raw JSON payload",
    )
    args = parser.parse_args()

    url = f"{FIP_API_BASE}/policy-items?{urlencode(POLICY_ITEMS_QUERY)}"
    args.out.parent.mkdir(parents=True, exist_ok=True)

    print("[ingest] fetching EU health-claims register")
    print(f"    url: {url}")

    session = requests.Session()
    session.headers.update({"User-Agent": DEFAULT_UA})

    t0 = time.time()
    payload = fetch_json(url, session)
    elapsed = time.time() - t0

    items = payload if isinstance(payload, list) else payload.get("content", payload)
    with args.out.open("w", encoding="utf-8") as fh:
        json.dump(items, fh, ensure_ascii=False)

    print(f"[ingest] done — {len(items)} policy items saved to {args.out} ({elapsed:.1f}s)")
    print(f"[ingest] size: {args.out.stat().st_size / 1e6:.1f} MB")
    print(f"[ingest] fetched_at: {datetime.now(UTC).isoformat()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
