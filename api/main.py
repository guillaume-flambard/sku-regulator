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
from pydantic import BaseModel, Field

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
    question: str = Field(min_length=1, description="The compliance question")
    country: str = Field(default="FR", min_length=2, max_length=2)


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
    if not q.strip():
        return {"query": q, "country": country, "results": []}
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


@app.get("/api/graph")
def graph() -> dict:
    """Knowledge graph for the demo: products -> claims -> ingredients."""
    nodes: list[dict] = []
    edges: list[dict] = []
    node_ids: set[tuple[str, int | str]] = set()

    def add_node(kind: str, ident: str, label: str, meta: dict | None = None) -> str:
        nid = f"{kind}:{ident}"
        if nid not in node_ids:
            node_ids.add(nid)
            nodes.append({"id": nid, "kind": kind, "label": label, **(meta or {})})
        return nid

    with psycopg.connect(DSN) as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT p.sku, p.name, p.brand, p.country_code,
                   c.policy_item_code, c.claim_text, c.status
            FROM products p
            JOIN product_claims pc ON pc.product_id = p.id
            JOIN claims c ON c.id = pc.claim_id
            """
        )
        for psku, pname, pbrand, pcountry, ccode, ctext, cstatus in cur.fetchall():
            pid = add_node("product", psku, pname, {"brand": pbrand, "country": pcountry})
            cid = add_node("claim", ccode, ctext[:90], {"status": cstatus})
            edges.append({"source": pid, "target": cid, "type": "carries"})

        cur.execute(
            """
            SELECT i.name, c.policy_item_code
            FROM ingredients i
            JOIN claim_ingredients ci ON ci.ingredient_id = i.id
            JOIN claims c ON c.id = ci.claim_id
            """
        )
        seen = set()
        for iname, ccode in cur.fetchall():
            iid = add_node("ingredient", iname, iname, {"category": "substance"})
            cid = f"claim:{ccode}"
            if cid in node_ids and (iid, cid) not in seen:
                seen.add((iid, cid))
                edges.append({"source": iid, "target": cid, "type": "in"})

    return {"nodes": nodes, "edges": edges}


@app.get("/api/anomalies")
def anomalies(status: str = "open") -> dict:
    with psycopg.connect(DSN) as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT a.id, a.reason, a.severity, a.status, a.created_at,
                   c.policy_item_code, c.claim_text, p.sku, p.name
            FROM anomalies a
            LEFT JOIN claims c ON c.id = a.claim_id
            LEFT JOIN products p ON p.id = a.product_id
            WHERE a.status = %s
            ORDER BY a.created_at DESC
            LIMIT 50
            """,
            (status,),
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


@app.post("/api/anomalies/{anomaly_id}/undo")
def undo_anomaly(anomaly_id: int) -> dict:
    """Reopen a resolved anomaly (undo)."""
    with psycopg.connect(DSN) as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE anomalies SET status='open', resolved_at=NULL WHERE id=%s",
            (anomaly_id,),
        )
        conn.commit()
    return {"ok": True, "id": anomaly_id}


@app.get("/api/products")
def products(country: str | None = None) -> dict:
    q = """
        SELECT p.sku, p.name, p.brand, p.country_code,
               count(pc.id) FILTER (WHERE pc.verdict='compliant') AS compliant,
               count(pc.id) FILTER (WHERE pc.verdict='non_compliant') AS non_compliant,
               count(pc.id) FILTER (WHERE pc.verdict='review') AS review,
               round(avg(pc.confidence)::numeric, 3) AS confidence
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
                "review": r[6],
                "confidence": float(r[7]) if r[7] is not None else None,
            }
            for r in rows
        ]
    }
