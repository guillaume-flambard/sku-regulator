#!/usr/bin/env python3
"""T3 — Seed: load parsed claims + demo products into Postgres.

Pipeline:
  1. apply schema.sql
  2. load EU member states
  3. load parsed claims (claims.jsonl)
  4. derive country_status from claim status (EU-wide compliance pivot)
  5. load a few demo SKUs + product_claims + a couple of anomalies
  6. (optional) compute embeddings into claims.embedding
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import psycopg

REPO_ROOT = Path(__file__).resolve().parent.parent
SCHEMA = REPO_ROOT / "store/schema.sql"
CLAIMS_JSONL = REPO_ROOT / "data/parsed/claims.jsonl"
DEFAULT_DSN = "host=localhost port=55432 dbname=sku_regulator user=sku password=sku"

# ISO-3166 alpha-2 for EU member states (27) — used as the multi-market layer.
EU_COUNTRIES = [
    ("AT", "Austria"), ("BE", "Belgium"), ("BG", "Bulgaria"), ("HR", "Croatia"),
    ("CY", "Cyprus"), ("CZ", "Czechia"), ("DK", "Denmark"), ("EE", "Estonia"),
    ("FI", "Finland"), ("FR", "France"), ("DE", "Germany"), ("GR", "Greece"),
    ("HU", "Hungary"), ("IE", "Ireland"), ("IT", "Italy"), ("LV", "Latvia"),
    ("LT", "Lithuania"), ("LU", "Luxembourg"), ("MT", "Malta"), ("NL", "Netherlands"),
    ("PL", "Poland"), ("PT", "Portugal"), ("RO", "Romania"), ("SK", "Slovakia"),
    ("SI", "Slovenia"), ("ES", "Spain"), ("SE", "Sweden"),
    # United Kingdom — no longer an EU member state, but still a real market
    # for the same products. Included here because the EU Register remains the
    # reference for UK labelling (EU-derived rules were retained post-Brexit).
    ("GB", "United Kingdom"),
]

INGREDIENT_KEYWORDS = {
    "vitamin c": "Vitamin C",
    "ascorbic": "Vitamin C",
    "vitamin d": "Vitamin D",
    "calcium": "Calcium",
    "omega-3": "Omega-3 fatty acids",
    "omega 3": "Omega-3 fatty acids",
    "epa": "Omega-3 (EPA)",
    "dha": "Omega-3 (DHA)",
    "probiotic": "Probiotics",
    "lactobacillus": "Probiotics",
    "bifidobacterium": "Probiotics",
    "glucomannan": "Glucomannan",
    "magnesium": "Magnesium",
    "iron": "Iron",
    "zinc": "Zinc",
    "collagen": "Collagen",
    "melatonin": "Melatonin",
    "caffeine": "Caffeine",
    "coenzyme": "Coenzyme Q10",
    "q10": "Coenzyme Q10",
    "folate": "Folate",
    "folic": "Folate",
    "beta-glucan": "Beta-glucan",
    "lutein": "Lutein",
    "beta-sitosterol": "Plant sterols",
    "plant sterol": "Plant sterols",
    "flavonoid": "Flavonoids",
}


def detect_ingredients(claim_text: str) -> list[str]:
    """Best-effort ingredient extraction from the claim text."""
    found = []
    low = (claim_text or "").lower()
    for pattern, canonical in INGREDIENT_KEYWORDS.items():
        if re.search(rf"\b{pattern}\b", low) and canonical not in found:
            found.append(canonical)
    return found


def apply_schema(conn: psycopg.Connection) -> None:
    sql = SCHEMA.read_text()
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()
    print("[seed] schema applied")


def load_countries(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        for code, name in EU_COUNTRIES:
            cur.execute(
                "INSERT INTO countries (code, name) VALUES (%s, %s) ON CONFLICT (code) DO NOTHING",
                (code, name),
            )
    conn.commit()
    print(f"[seed] {len(EU_COUNTRIES)} countries loaded")


def load_claims(conn: psycopg.Connection, with_embeddings: bool) -> dict[str, int]:
    """Load claims, link ingredients, sources, and derive country_status."""
    embed_fn = None
    if with_embeddings:
        try:
            import ollama  # local Ollama client

            def _embed(texts: list[str], retries: int = 3) -> list[list[float]]:
                for attempt in range(1, retries + 1):
                    try:
                        return ollama.embed(model="nomic-embed-text", input=texts)["embeddings"]
                    except Exception as err:  # Ollama sometimes drops long-running batches
                        if attempt == retries:
                            raise
                        import time
                        print(f"[seed] embed retry {attempt}/{retries}: {err}")
                        time.sleep(2 ** attempt)
                return []

            embed_fn = _embed
        except ImportError:
            print("[seed] 'ollama' python package missing — embeddings skipped")

    counts = {"ingredients": 0, "sources": 0, "country_status": 0}
    records = []
    with CLAIMS_JSONL.open("r", encoding="utf-8") as fh:
        for line in fh:
            if line.strip():
                records.append(json.loads(line))

    # Pre-compute ingredients + embeddings (batched to keep Ollama happy)
    ingredient_ids: dict[str, int] = {}
    rows_for_claims = []
    for rec in records:
        ing_names = detect_ingredients(rec.get("claim_text") or "")
        rows_for_claims.append((rec, ing_names))

    with conn.cursor() as cur:
        # ingredient lookup table
        for _, names in rows_for_claims:
            for name in names:
                if name not in ingredient_ids:
                    cur.execute(
                        "INSERT INTO ingredients (name) VALUES (%s) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id",
                        (name,),
                    )
                    ingredient_ids[name] = cur.fetchone()[0]
                    counts["ingredients"] += 1

        # embeddings (batch of 16)
        batch_size = 16
        embedding_by_code: dict[str, list[float]] = {}
        if embed_fn:
            batch_texts, batch_codes = [], []
            for rec, _ in rows_for_claims:
                text = f"{rec.get('claim_text') or ''} — {rec.get('health_relationship') or ''}"
                if not text.strip():
                    continue
                batch_texts.append(text)
                batch_codes.append(rec["policy_item_code"])
                if len(batch_texts) >= batch_size:
                    for code, emb in zip(batch_codes, embed_fn(batch_texts)):
                        embedding_by_code[code] = emb
                    batch_texts, batch_codes = [], []
            if batch_texts:
                for code, emb in zip(batch_codes, embed_fn(batch_texts)):
                    embedding_by_code[code] = emb
            print(f"[seed] computed {len(embedding_by_code)} embeddings (Ollama nomic-embed-text)")

        # insert claims
        for rec, ing_names in rows_for_claims:
            cur.execute(
                """INSERT INTO claims
                     (policy_item_code, claim_text, health_relationship, status, claim_type,
                      conditions_of_use, restriction_of_use, nutrient_food_cat,
                      reasons_for_non_auth, data_protection, embedding)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                   ON CONFLICT (policy_item_code) DO UPDATE
                     SET claim_text=EXCLUDED.claim_text, status=EXCLUDED.status
                   RETURNING id""",
                (
                    rec["policy_item_code"],
                    rec["claim_text"],
                    rec.get("health_relationship"),
                    rec["status"],
                    rec.get("claim_type"),
                    rec.get("conditions_of_use"),
                    rec.get("restriction_of_use"),
                    rec.get("nutrient_food_cat"),
                    rec.get("reasons_for_non_auth") or [],
                    True if rec.get("data_protection") == "yes" else False,
                    embedding_by_code.get(rec["policy_item_code"]),
                ),
            )
            claim_id = cur.fetchone()[0]

            # link ingredients
            for name in ing_names:
                cur.execute(
                    "INSERT INTO claim_ingredients (claim_id, ingredient_id) VALUES (%s, %s)",
                    (claim_id, ingredient_ids[name]),
                )

            # sources: eu_register + EFSA opinions + legislation
            cur.execute(
                "INSERT INTO sources (claim_id, source_type, reference, url) VALUES (%s,'eu_register',%s,NULL)",
                (claim_id, rec["policy_item_code"]),
            )
            counts["sources"] += 1
            for ref in rec.get("efsa_references") or []:
                cur.execute(
                    "INSERT INTO sources (claim_id, source_type, reference, url) VALUES (%s,'efsa_opinion',%s,%s)",
                    (claim_id, ref.get("reference"), ref.get("url")),
                )
                counts["sources"] += 1
            for leg in rec.get("legislation") or []:
                cur.execute(
                    "INSERT INTO sources (claim_id, source_type, reference, url) VALUES (%s,'legislation',%s,%s)",
                    (claim_id, leg.get("legislation"), leg.get("eurlex_url")),
                )
                counts["sources"] += 1

            # country_status pivot: EU-wide by claim status
            for code, _ in EU_COUNTRIES:
                if rec["status"] == "authorised":
                    country_status = "allowed"
                    note = None
                elif rec["status"] == "revoked":
                    country_status = "not_allowed"
                    note = "Claim revoked at EU level"
                else:
                    country_status = "not_allowed"
                    note = "Not authorised at EU level"
                cur.execute(
                    """INSERT INTO country_status (claim_id, country_code, status, note)
                       VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING""",
                    (claim_id, code, country_status, note),
                )
                counts["country_status"] += 1

    conn.commit()
    print(f"[seed] {len(records)} claims loaded "
          f"({counts['ingredients']} ingredients, {counts['sources']} sources, {counts['country_status']} country_status)")
    return counts


def load_demo_products(conn: psycopg.Connection) -> None:
    """A few realistic demo SKUs so the dashboard has products to show."""
    with conn.cursor() as cur:
        demo = [
            # sku, name, brand, country
            ("SKU-OMEGA-3-FR-001", "Omega-3 Daily 1000mg", "NaturaLab", "FR"),
            ("SKU-OMEGA-3-DE-002", "Omega-3 Triple Strength", "VitaNord", "DE"),
            ("SKU-VITC-FR-003", "Vitamin C 1000mg Effervescent", "Civital", "FR"),
            ("SKU-VITC-GB-004", "Vitamin C Immune Support", "LiftWell", "GB"),
            ("SKU-GLUC-FR-005", "Glucomannan Slim Shot", "SlimCare", "FR"),
            ("SKU-PROB-ES-006", "Probiotic 12 Strains", "GutBalance", "ES"),
        ]
        for sku, name, brand, country in demo:
            cur.execute(
                """INSERT INTO products (sku, name, brand, country_code)
                   VALUES (%s,%s,%s,%s) ON CONFLICT (sku) DO NOTHING""",
                (sku, name, brand, country),
            )
        conn.commit()
    print(f"[seed] {len(demo)} demo SKUs loaded")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dsn", default=DEFAULT_DSN)
    parser.add_argument("--no-embeddings", action="store_true", help="skip Ollama embeddings")
    args = parser.parse_args()

    with psycopg.connect(args.dsn) as conn:
        apply_schema(conn)
        load_countries(conn)
        load_claims(conn, with_embeddings=not args.no_embeddings)
        load_demo_products(conn)

    print("[seed] done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
