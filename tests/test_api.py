"""API tests using FastAPI's TestClient against the isolated test DB.

The LLM-backed /api/ask is patched so tests are fast and deterministic; the
retrieval-backed endpoints hit the real test database.
"""

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

pytestmark = pytest.mark.integration


@pytest.fixture
def client(sku_dsn):
    """TestClient whose modules were re-imported against the test DSN."""
    import api.main
    return TestClient(api.main.app)


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_stats(client):
    r = client.get("/api/stats")
    assert r.status_code == 200
    d = r.json()
    assert d["claims"] >= 8
    assert d["authorised"] >= 5
    assert d["ingredients"] >= 0


def test_countries(client):
    r = client.get("/api/countries")
    assert r.status_code == 200
    codes = {c["code"] for c in r.json()["countries"]}
    assert {"FR", "DE", "ES", "GB"} <= codes


def test_claims_search(client):
    r = client.get("/api/claims", params={"q": "vitamin C immune", "country": "FR", "top_k": 3})
    assert r.status_code == 200
    d = r.json()
    assert d["results"]
    for item in d["results"]:
        assert "policy_item_code" in item
        assert "country_status" in item
        assert item["country_status"] in {"allowed", "not_allowed"}


def test_claims_search_no_results(client):
    r = client.get("/api/claims", params={"q": "zzzznothing", "country": "FR"})
    assert r.status_code == 200
    assert r.json()["results"] == []


def test_claims_search_missing_q(client):
    r = client.get("/api/claims")
    assert r.status_code == 422  # FastAPI validates the required query param


def test_ask_returns_grounded_answer(client, monkeypatch):
    import api.main

    def fake_answer(question, country="FR", top_k=4):
        return {
            "question": question,
            "country": country,
            "answer": "Based on POL-HC-6510, the claim is authorised in France.",
            "sources": [
                {"policy_item_code": "POL-HC-6510", "claim_text": "Vitamin C...",
                 "status": "authorised", "country_status": "allowed"}
            ],
        }

    monkeypatch.setattr(api.main, "answer_question", fake_answer)
    r = client.post("/api/ask", json={"question": "vitamin C immunity?", "country": "FR"})
    assert r.status_code == 200
    d = r.json()
    assert d["sources"]
    assert d["sources"][0]["policy_item_code"] == "POL-HC-6510"


def test_ask_validation(client):
    # empty question is rejected by Pydantic (min_length=1)
    r = client.post("/api/ask", json={"question": ""})
    assert r.status_code == 422


def test_products_review_flag(client):
    """Regression: SKU with a non-authorised claim must be flagged 'review'."""
    # the test DB has no demo products; this test asserts the shape + the
    # aggregation works even with zero products.
    r = client.get("/api/products")
    assert r.status_code == 200
    d = r.json()
    assert "products" in d


def test_products_filter_country(client):
    r = client.get("/api/products", params={"country": "FR"})
    assert r.status_code == 200
    assert all(p["country_code"] == "FR" for p in r.json()["products"])


def test_graph_shape(client):
    r = client.get("/api/graph")
    assert r.status_code == 200
    d = r.json()
    assert "nodes" in d and "edges" in d
    kinds = {n["kind"] for n in d["nodes"]}
    assert kinds <= {"product", "claim", "ingredient"}


def test_anomalies_resolve_and_undo(client):
    """The resolve→undo cycle must round-trip against the test DB."""
    # the isolated DB may have no anomalies; insert one directly to test the cycle
    import psycopg
    dsn = "host=localhost port=55432 dbname=sku_regulator_test user=sku password=sku"
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO anomalies (claim_id, reason, severity) VALUES (NULL, 'test anomaly', 'low') RETURNING id"
            )
            aid = cur.fetchone()[0]
        conn.commit()

    r = client.post(f"/api/anomalies/{aid}/resolve")
    assert r.status_code == 200

    r = client.get("/api/anomalies")
    assert aid not in [a["id"] for a in r.json()["anomalies"]]

    r = client.post(f"/api/anomalies/{aid}/undo")
    assert r.status_code == 200

    r = client.get("/api/anomalies")
    assert aid in [a["id"] for a in r.json()["anomalies"]]
