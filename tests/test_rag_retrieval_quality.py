"""Retrieval quality: relevance of hybrid search on a small gold set.

A lightweight, dependency-free stand-in for a full Ragas-style evaluation: for a
set of known questions we assert that the *top* hit is semantically on-topic and
that a relevant authorised claim is present in the top-k. Uses the isolated test
database (deterministic subset) — fast, no LLM needed for these checks.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

pytestmark = pytest.mark.integration

# (question, expected on-topic keyword, expected authorised code when present)
GOLD = [
    ("vitamin C immune system", "immun", "POL-HC-6510"),
    ("omega 3 heart", "heart", "POL-HC-6368"),
    ("probiotic gut health", "probiotic", "POL-HC-7424"),
    ("vitamin a", "immune", "POL-HC-6480"),
]


def test_top_hit_is_on_topic(retrieve_module):
    for question, keyword, _ in GOLD:
        res = retrieve_module.hybrid_search(question, top_k=5)
        assert res["results"], f"no results for '{question}'"
        top_text = res["results"][0]["claim_text"].lower()
        assert keyword in top_text, f"top hit for '{question}' is off-topic: {top_text[:100]}"


def test_authorised_code_present_in_top_k(retrieve_module):
    for question, _, code in GOLD:
        if not code:
            continue
        res = retrieve_module.hybrid_search(question, top_k=5)
        codes = [r["policy_item_code"] for r in res["results"]]
        assert code in codes, f"expected {code} in top-5 for '{question}', got {codes}"


def test_fts_prefers_exact_wording(retrieve_module):
    """An exact-phrase query should rank the exact claim above fuzzy matches."""
    res = retrieve_module.hybrid_search("Vitamin C contributes to the normal function of the immune system", top_k=5)
    assert res["results"][0]["policy_item_code"] == "POL-HC-6510"
