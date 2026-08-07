#!/usr/bin/env python3
"""FastAPI backend for the sku-regulator demo.

Endpoints:
  GET  /api/health               liveness
  GET  /api/stats                dataset overview (claims, products, countries)
  GET  /api/claims?q=&country=   hybrid RAG retrieval + country status
  POST /api/ask                  LLM-grounded answer with citations
  GET  /api/countries            EU market list
  GET  /api/anomalies            human-in-the-loop queue
  POST /api/anomalies/{id}/resolve
  GET  /api/products?country=    demo SKUs with compliance verdicts
"""

from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from rag.answer import answer_question
from rag.retrieve import country_lookup, hybrid_search

# Keep the DB open per-request via a connection helper that matches rag.retrieve
import psycopg

DSN = os.environ.get(
    "SKU_DB_DSN",
    "host=localhost port=55432 dbname=sku_regulator user=sku password=sku",
)

app = FastAPI(title="sku-regulator API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # demo only
    allow_methods=["*"],
    allow_headers=["*"],
)


class AskRequest(BaseModel):
    question: str
    country: str = "FR"


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/stats")
def stats() -> dict:
    with psycopg.connect(DSN) as conn, conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM claims")
        claims = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM claims WHERE status='authorised'")
        authorised = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM ingredients")
        ingredients = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM products")
        products = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM sources")
        sources = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM anomalies WHERE status='open'")
        anomalies = cur.fetchone()[0]
    return {
        "claims": claims,
        "authorised": authorised,
        "non_authorised": claims - authorised,
        "ingredients": ingredients,
        "products": products,
        "sources": sources,
        "open_anomalies": anomalies,
    }


@app.get("/api/countries")
def countries() -> dict:
    with psycopg.connect(DSN) as conn, conn.cursor() as cur:
        cur.execute("SELECT code, name FROM countries ORDER BY name")
        rows = cur.fetchall()
    return {"countries": [{"code": c, "name": n} for c, n in rows]}


@app.get("/api/claims")
def claims(q: str, country: str = "FR", top_k: int = 5) -> dict:
    try:
        retrieval = hybrid_search(q, top_k=top_k)
    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err)) from err
    codes = [r["policy_item_code"] for r in retrieval["results"]]
    cs = country_lookup(codes, country)
    for r in retrieval["results"]:
        r["country_status"] = cs.get(r["policy_item_code"], {}).get("status")
    return {"query": q, "country": country, "results": retrieval["results"]}


@app.post("/api/ask")
def ask(req: AskRequest) -> dict:
    try:
        return answer_question(req.question, req.country)
    except Exception as err:  # LLM/Ollama may be down — give a clean error
        raise HTTPException(status_code=500, detail=f"LLM unavailable: {err}") from err


@app.get("/api/anomalies")
def anomalies() -> dict:
    with psycopg.connect(DSN) as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT a.id, a.reason, a.severity, a.status, a.created_at,
                   c.policy_item_code, c.claim_text, p.sku, p.name
            FROM anomalies a
            LEFT JOIN claims c ON c.id = a.claim_id
            LEFT JOIN products p ON p.id = a.product_id
            ORDER BY a.created_at DESC
            LIMIT 50
            """
        )
        rows = cur.fetchall()
    return {
        "anomalies": [
            {
                "id": r[0],
                "reason": r[1],
                "severity": r[2],
                "status": r[3],
                "created_at": r[4].isoformat() if r[4] else None,
                "claim_code": r[5],
                "claim_text": r[6],
                "product_sku": r[7],
                "product_name": r[8],
            }
            for r in rows
        ]
    }


@app.post("/api/anomalies/{anomaly_id}/resolve")
def resolve_anomaly(anomaly_id: int) -> dict:
    with psycopg.connect(DSN) as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE anomalies SET status='resolved', resolved_at=now() WHERE id=%s",
            (anomaly_id,),
        )
        conn.commit()
    return {"ok": True, "id": anomaly_id}


@app.get("/api/products")
def products(country: str | None = None) -> dict:
    q = """
        SELECT p.sku, p.name, p.brand, p.country_code,
               count(pc.id) FILTER (WHERE pc.verdict='compliant') AS compliant,
               count(pc.id) FILTER (WHERE pc.verdict='non_compliant') AS non_compliant
        FROM products p
        LEFT JOIN product_claims pc ON pc.product_id = p.id
        WHERE (%s::text IS NULL OR p.country_code = %s)
        GROUP BY p.id
        ORDER BY p.sku
        """
    with psycopg.connect(DSN) as conn, conn.cursor() as cur:
        cur.execute(q, (country, country))
        rows = cur.fetchall()
    return {
        "products": [
            {
                "sku": r[0],
                "name": r[1],
                "brand": r[2],
                "country_code": r[3],
                "compliant": r[4],
                "non_compliant": r[5],
            }
            for r in rows
        ]
    }
