#!/usr/bin/env python3
"""T4 — RAG retrieval over the EU health-claims register.

Two retrievers over Postgres:
  1. Full-text search (Postgres tsvector) — exact wording, legal terms
  2. Vector search (pgvector, nomic-embed-text embeddings) — semantic

The retriever returns claim records + their provenance (EU register code,
EFSA opinion, legislation) + a per-country compliance note.

This module is framework-agnostic SQL (FastAPI/React talk to it via HTTP).
LangChain is used at the LLM/QA layer (see rag/answer.py).
"""

from __future__ import annotations

import argparse
import os

import psycopg

DSN = os.environ.get(
    "SKU_DB_DSN",
    "host=localhost port=55432 dbname=sku_regulator user=sku password=sku",
)

TOP_K_DEFAULT = 5

# vector-only hits below this cosine score are treated as noise, not matches.
# Tuned on the full register: real queries score 0.65+, gibberish tops out ~0.55.
VECTOR_MIN_SCORE = 0.6

# Query-expansion synonyms: the register words claims in legal/EFSA language
# ("EPA and DHA") that consumers phrase differently ("omega 3"). Expanding the
# query before FTS + embedding recovers those matches.
SYNONYMS = {
    "omega 3": "EPA DHA omega-3 omega3",
    "omega-3": "EPA DHA omega-3 omega3",
    "vitamin c": "vitamin c ascorbic",
    "immunity": "immune immunity defence defences",
    "probiotic": "probiotic lactobacillus bifidobacterium bacteria flora",
    "gut": "gut intestinal intestine flora",
    "bones": "bone bones calcium skeletal",
}


def expand_query(query: str) -> str:
    """Replace known consumer phrases with their regulatory synonyms."""
    low = query.lower()
    for phrase, replacement in SYNONYMS.items():
        if phrase in low:
            query = f"{query} {replacement}"
    return query


def _connect():
    return psycopg.connect(DSN)


def _row_to_dict(row: psycopg.rows.Row) -> dict:
    return {
        "policy_item_code": row[0],
        "claim_text": row[1],
        "health_relationship": row[2],
        "status": row[3],
        "claim_type": row[4],
        "score": row[5],
    }


def fts_search(query: str, top_k: int = TOP_K_DEFAULT) -> list[dict]:
    """Postgres full-text search (ts_rank)."""
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT policy_item_code, claim_text, health_relationship, status, claim_type,
                   ts_rank(to_tsvector('english', claim_text || ' ' || coalesce(health_relationship,'')),
                           plainto_tsquery('english', %s)) AS score
            FROM claims
            WHERE to_tsvector('english', claim_text || ' ' || coalesce(health_relationship,''))
                  @@ plainto_tsquery('english', %s)
            ORDER BY score DESC
            LIMIT %s
            """,
            (query, query, top_k),
        )
        return [_row_to_dict(r) for r in cur.fetchall()]


def vector_search(query: str, top_k: int = TOP_K_DEFAULT) -> list[dict]:
    """pgvector cosine similarity (needs a pre-computed query embedding)."""
    try:
        import ollama

        emb = ollama.embed(model="nomic-embed-text", input=query)["embeddings"][0]
    except Exception as err:
        raise RuntimeError(f"Ollama embedding failed: {err}") from err

    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT policy_item_code, claim_text, health_relationship, status, claim_type,
                   1 - (embedding <=> %s::vector) AS score
            FROM claims
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> %s::vector
            LIMIT %s
            """,
            (emb, emb, top_k),
        )
        return [_row_to_dict(r) for r in cur.fetchall()]


def hybrid_search(query: str, top_k: int = TOP_K_DEFAULT) -> dict:
    """Fuse FTS + vector via reciprocal-rank fusion (RRF).

    A fused result is only kept when at least one retriever is confident:
      - full-text hits always qualify (an exact wording match is meaningful),
      - vector-only hits require a cosine score above VECTOR_MIN_SCORE.
    This keeps meaningless queries from surfacing low-score noise.

    The query is expanded with regulatory synonyms first (e.g. "omega 3" ->
    "EPA DHA") so consumer phrasing matches the register's wording.
    """
    expanded = expand_query(query)
    fts = fts_search(expanded, top_k=top_k * 3)
    vec = vector_search(expanded, top_k=top_k * 3)

    fused: dict[str, dict] = {}
    for source, results in (("fts", fts), ("vector", vec)):
        for rank, rec in enumerate(results):
            code = rec["policy_item_code"]
            score = rec["score"] or 0.0
            if source == "vector" and score < VECTOR_MIN_SCORE:
                continue
            entry = fused.setdefault(code, {**rec, "matches": {}})
            entry["matches"][source] = round(score, 4)
            entry["matches"]["_rank"] = entry["matches"].get("_rank", 0) + 1 / (60 + rank)

    ranked = sorted(
        fused.values(),
        key=lambda r: r["matches"].get("_rank", 0),
        reverse=True,
    )[:top_k]
    return {"query": query, "results": ranked}


def country_lookup(claim_codes: list[str], country: str = "FR") -> dict[str, str]:
    """Per-country status for a set of claims."""
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT c.policy_item_code, cs.status, cs.note
            FROM claims c
            JOIN country_status cs ON cs.claim_id = c.id AND cs.country_code = %s
            WHERE c.policy_item_code = ANY(%s)
            """,
            (country, claim_codes),
        )
        return {row[0]: {"status": row[1], "note": row[2]} for row in cur.fetchall()}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--query", default="vitamin C immune system")
    ap.add_argument("--top-k", type=int, default=TOP_K_DEFAULT)
    ap.add_argument("--country", default="FR")
    args = ap.parse_args()

    res = hybrid_search(args.query, args.top_k)
    print(f'\n=== Hybrid search: "{args.query}" (top {len(res["results"])}) ===')
    codes = [r["policy_item_code"] for r in res["results"]]
    countries = country_lookup(codes, args.country)

    for r in res["results"]:
        cs = countries.get(r["policy_item_code"], {})
        print(f"\n• {r['policy_item_code']} [{r['status']}] {args.country}: {cs.get('status')}")
        print(f"  {r['claim_text'][:180]}")
        print(f"  matches: {r['matches']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
