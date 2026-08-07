#!/usr/bin/env python3
"""Enrich demo: map demo SKUs to real claims and create a few anomalies.

This wires the 6 demo products to actual EU claims so the dashboard can show
compliance verdicts (compliant / non_compliant) and a human-in-the-loop queue.
"""

from __future__ import annotations

import os

import psycopg

DSN = os.environ.get(
    "SKU_DB_DSN",
    "host=localhost port=55432 dbname=sku_regulator user=sku password=sku",
)

# product_sku -> (claim keywords to match, verdict)
PLAN = {
    "SKU-OMEGA-3-FR-001": ("dha", "compliant"),
    "SKU-OMEGA-3-DE-002": ("dha", "compliant"),
    "SKU-VITC-FR-003": ("vitamin c", "compliant"),
    "SKU-VITC-GB-004": ("vitamin c", "compliant"),
    "SKU-GLUC-FR-005": ("glucomannan", "compliant"),
    "SKU-PROB-ES-006": ("lactobacillus", "review"),
}


def find_claim_id(conn, keyword: str, status: str = "authorised") -> int | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT c.id FROM claims c
            WHERE c.status = %s
              AND (c.claim_text ILIKE %s OR c.health_relationship ILIKE %s)
            ORDER BY length(c.claim_text) ASC
            LIMIT 1
            """,
            (status, f"%{keyword}%", f"%{keyword}%"),
        )
        row = cur.fetchone()
        return row[0] if row else None


def add_product_claims(conn) -> None:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM product_claims")
        cur.execute("DELETE FROM anomalies")
        conn.commit()
    for sku, (kw, verdict) in PLAN.items():
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM products WHERE sku=%s", (sku,))
            prod = cur.fetchone()
        if not prod:
            print(f"  ! missing product {sku}")
            continue
        want_status = "authorised" if verdict == "compliant" else "non_authorised"
        claim_id = find_claim_id(conn, kw, want_status)
        if not claim_id:
            print(f"  ! no {want_status} claim for keyword '{kw}'")
            continue
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO product_claims (product_id, claim_id, verdict, confidence)
                   VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING""",
                (prod[0], claim_id, verdict, 0.97),
            )
        conn.commit()
        print(f"  + {sku} -> claim #{claim_id} ({verdict})")

    # Probiotic SKU: non-authorised claim => flag as compliance anomaly
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM products WHERE sku='SKU-PROB-ES-006'")
        prob = cur.fetchone()
    if prob:
        claim_id = find_claim_id(conn, "lactobacillus", "non_authorised")
        if claim_id:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO anomalies (claim_id, product_id, reason, severity)
                       VALUES (%s, %s,
                       'Claim is NOT authorised at EU level — product label may be non-compliant',
                       'high')""",
                    (claim_id, prob[0]),
                )
            conn.commit()
            print("  + probiotic compliance anomaly seeded")

    # A few anomalies: one high-confidence mismatch, one low-confidence claim
    with conn.cursor() as cur:
        # a "non_compliant" product: put an authorised-in-DE product with a
        # claim that is actually not allowed in FR (mock: reuse a non-authorised claim)
        cur.execute(
            """
            INSERT INTO anomalies (claim_id, product_id, reason, severity)
            SELECT c.id, p.id, 'Claim wording differs from authorised text — marketing variant detected',
                   'high'
            FROM claims c, products p
            WHERE p.sku='SKU-VITC-FR-003'
              AND c.status='non_authorised'
              AND c.claim_text ILIKE '%immune%'
            LIMIT 1
            """
        )
        cur.execute(
            """
            INSERT INTO anomalies (claim_id, product_id, reason, severity)
            SELECT c.id, p.id, 'Low extraction confidence (0.61) — OCR artifact suspected',
                   'medium'
            FROM claims c, products p
            WHERE p.sku='SKU-GLUC-FR-005'
              AND c.status='authorised'
              AND c.claim_text ILIKE '%glucomannan%'
            LIMIT 1
            """
        )
        conn.commit()
    print("  + anomalies seeded")


def main() -> None:
    with psycopg.connect(DSN) as conn:
        add_product_claims(conn)
    print("demo enrichment done")


if __name__ == "__main__":
    main()
