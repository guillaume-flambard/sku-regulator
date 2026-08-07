"""Unit tests for hybrid retrieval (reciprocal-rank fusion), DB mocked out."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from rag import retrieve


def make_result(code, status="authorised"):
    return {
        "policy_item_code": code,
        "claim_text": f"claim {code}",
        "health_relationship": None,
        "status": status,
        "claim_type": "Art. 13(1)",
        "score": 1.0,
    }


def test_hybrid_search_merges_both_sources(monkeypatch):
    fts = [make_result("A"), make_result("B")]
    vec = [make_result("B"), make_result("C")]
    monkeypatch.setattr(retrieve, "fts_search", lambda q, top_k: fts)
    monkeypatch.setattr(retrieve, "vector_search", lambda q, top_k: vec)

    out = retrieve.hybrid_search("query", top_k=5)
    codes = [r["policy_item_code"] for r in out["results"]]
    assert "A" in codes and "B" in codes and "C" in codes


def test_hybrid_search_prefers_present_in_both(monkeypatch):
    # B appears in both lists; A only in fts; C only in vector.
    fts = [make_result("A"), make_result("B")]
    vec = [make_result("B"), make_result("C")]
    monkeypatch.setattr(retrieve, "fts_search", lambda q, top_k: fts)
    monkeypatch.setattr(retrieve, "vector_search", lambda q, top_k: vec)

    out = retrieve.hybrid_search("query", top_k=3)
    # B must rank above both singletons (higher RRF weight).
    assert out["results"][0]["policy_item_code"] == "B"
    assert out["results"][0]["matches"]["fts"] is not None
    assert out["results"][0]["matches"]["vector"] is not None


def test_hybrid_search_records_match_scores(monkeypatch):
    fts = [make_result("A")]
    vec = [make_result("A")]
    monkeypatch.setattr(retrieve, "fts_search", lambda q, top_k: fts)
    monkeypatch.setattr(retrieve, "vector_search", lambda q, top_k: vec)

    out = retrieve.hybrid_search("query", top_k=1)
    assert out["query"] == "query"
    assert out["results"][0]["matches"]["fts"] == pytest.approx(1.0)
    assert out["results"][0]["matches"]["vector"] == pytest.approx(1.0)


def test_hybrid_search_empty_inputs(monkeypatch):
    monkeypatch.setattr(retrieve, "fts_search", lambda q, top_k: [])
    monkeypatch.setattr(retrieve, "vector_search", lambda q, top_k: [])

    out = retrieve.hybrid_search("nothing", top_k=5)
    assert out["results"] == []


def test_row_to_dict_shape():
    row = ("POL-HC-1", "text", "rel", "authorised", "Art. 13(1)", 0.9)
    d = retrieve._row_to_dict(row)
    assert d == {
        "policy_item_code": "POL-HC-1",
        "claim_text": "text",
        "health_relationship": "rel",
        "status": "authorised",
        "claim_type": "Art. 13(1)",
        "score": 0.9,
    }


def test_hybrid_search_drops_low_vector_noise(monkeypatch):
    # FTS empty, vector returns low-confidence noise -> nothing surfaces
    fts = []
    vec = [make_result("A")]
    vec[0]["score"] = 0.3  # below VECTOR_MIN_SCORE
    monkeypatch.setattr(retrieve, "fts_search", lambda q, top_k: fts)
    monkeypatch.setattr(retrieve, "vector_search", lambda q, top_k: vec)

    out = retrieve.hybrid_search("gibberish", top_k=5)
    assert out["results"] == []


def test_hybrid_search_drops_borderline_noise(monkeypatch):
    # a 0.55 vector-only hit is still noise on the full corpus
    fts = []
    vec = [make_result("A")]
    vec[0]["score"] = 0.55
    monkeypatch.setattr(retrieve, "fts_search", lambda q, top_k: fts)
    monkeypatch.setattr(retrieve, "vector_search", lambda q, top_k: vec)

    out = retrieve.hybrid_search("gibberish", top_k=5)
    assert out["results"] == []


def test_hybrid_search_keeps_strong_vector_hit(monkeypatch):
    fts = []
    vec = [make_result("B")]
    vec[0]["score"] = 0.85  # above threshold -> kept even without FTS
    monkeypatch.setattr(retrieve, "fts_search", lambda q, top_k: fts)
    monkeypatch.setattr(retrieve, "vector_search", lambda q, top_k: vec)

    out = retrieve.hybrid_search("vitamin c", top_k=5)
    assert [r["policy_item_code"] for r in out["results"]] == ["B"]


def test_hybrid_search_fts_always_qualifies(monkeypatch):
    # even a weak FTS hit is a real wording match -> kept
    fts = [make_result("C")]
    fts[0]["score"] = 0.1
    vec = []
    monkeypatch.setattr(retrieve, "fts_search", lambda q, top_k: fts)
    monkeypatch.setattr(retrieve, "vector_search", lambda q, top_k: vec)

    out = retrieve.hybrid_search("exact wording", top_k=5)
    assert [r["policy_item_code"] for r in out["results"]] == ["C"]
