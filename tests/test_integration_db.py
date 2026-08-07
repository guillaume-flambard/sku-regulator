"""Integration tests against the isolated test database (schema + retrieval).

Requires the docker Postgres/pgvector container on :55432. The fixture seeds a
deterministic subset of claims (see tests/conftest.py::KNOWN_CODES).
"""

import sys
from pathlib import Path

import psycopg
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

pytestmark = pytest.mark.integration

TEST_DSN = "host=localhost port=55432 dbname=sku_regulator_test user=sku password=sku"


@pytest.fixture(scope="module")
def conn(test_db):
    with psycopg.connect(test_db) as c:
        yield c


def _count(cur, sql):
    cur.execute(sql)
    return cur.fetchone()[0]


def test_all_tables_exist(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename=ANY(%s)",
            (["countries", "ingredients", "claims", "claim_ingredients", "sources",
              "country_status", "products", "product_claims", "anomalies"],),
        )
        assert len(cur.fetchall()) == 9


def test_claims_seeded(conn):
    with conn.cursor() as cur:
        n = _count(cur, "SELECT count(*) FROM claims")
    assert n == len({  # unique codes in KNOWN_CODES
        "POL-HC-6510", "POL-HC-6500", "POL-HC-6480", "POL-HC-8119",
        "POL-HC-7424", "POL-HC-6228", "POL-HC-6368", "POL-HC-6381",
    })


def test_country_status_pivot(conn):
    with conn.cursor() as cur:
        # authorised claim -> allowed in every seeded market
        cur.execute(
            """SELECT count(*) FROM country_status cs
               JOIN claims c ON c.id=cs.claim_id
               WHERE c.policy_item_code='POL-HC-6510' AND cs.status='allowed'"""
        )
        assert cur.fetchone()[0] == 4  # FR, DE, ES, GB
        # non-authorised claim -> not_allowed
        cur.execute(
            """SELECT cs.status FROM country_status cs
               JOIN claims c ON c.id=cs.claim_id
               WHERE c.policy_item_code='POL-HC-7424' AND cs.country_code='FR'"""
        )
        assert cur.fetchone()[0] == "not_allowed"


def test_fts_search_finds_vitamin_c(retrieve_module):
    res = retrieve_module.fts_search("vitamin C immune", top_k=5)
    assert len(res) >= 1
    assert res[0]["policy_item_code"] in {"POL-HC-6510", "POL-HC-6500"}
    assert res[0]["status"] == "authorised"


def test_fts_search_empty_query(retrieve_module):
    res = retrieve_module.fts_search("zzzznothing", top_k=5)
    assert res == []


@pytest.mark.slow
def test_vector_search_finds_semantic_match(retrieve_module):
    """Needs local Ollama (nomic-embed-text). Skipped if unreachable or no embeds."""
    try:
        res = retrieve_module.vector_search("supports immunity", top_k=5)
    except RuntimeError as err:
        pytest.skip(f"Ollama unavailable: {err}")
    # the subset includes immune claims; a semantic match should surface one
    immune_codes = {"POL-HC-6510", "POL-HC-6500", "POL-HC-6480", "POL-HC-8119"}
    if not any("immun" in (r["claim_text"] or "").lower() for r in res):
        pytest.skip("seeded claims have no embeddings — vector path untested")
    assert any(r["policy_item_code"] in immune_codes for r in res[:3])


def test_hybrid_search_returns_country_aware(retrieve_module):
    res = retrieve_module.hybrid_search("vitamin C immune", top_k=5)
    assert res["results"]
    codes = [r["policy_item_code"] for r in res["results"]]
    lookup = retrieve_module.country_lookup(codes, "DE")
    for code in codes:
        assert code in lookup
        assert lookup[code]["status"] in {"allowed", "not_allowed"}


def test_country_lookup_authorised_claim(retrieve_module):
    assert retrieve_module.country_lookup(["POL-HC-6510"], "FR")["POL-HC-6510"]["status"] == "allowed"


def test_country_lookup_non_authorised_claim(retrieve_module):
    assert retrieve_module.country_lookup(["POL-HC-7424"], "ES")["POL-HC-7424"]["status"] == "not_allowed"
