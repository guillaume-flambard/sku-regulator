"""Shared pytest fixtures.

The integration/slow tests talk to a *separate* database (`sku_regulator_test`)
so they never touch the demo database used by the running app.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import psycopg
import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
TEST_DB = "sku_regulator_test"
ADMIN_DSN = "host=localhost port=55432 dbname=postgres user=sku password=sku"
TEST_DSN = "host=localhost port=55432 dbname=sku_regulator_test user=sku password=sku"

# small curated set of claim codes used by integration tests — chosen so the
# assertions match the real register (see tests/integration).
KNOWN_CODES = {
    "POL-HC-6510",  # Vitamin C immune (authorised)
    "POL-HC-6500",  # Vitamin C exercise (authorised)
    "POL-HC-6480",  # Vitamin A immune (authorised)
    "POL-HC-8119",  # multi-vitamins immune (non_authorised)
    "POL-HC-7424",  # probiotic (non_authorised)
    "POL-HC-6228",  # DHA infant vision (authorised)
    "POL-HC-6368",  # EPA+DHA heart (authorised)
    "POL-HC-6381",  # glucomannan weight loss (authorised)
}


def _ensure_test_db() -> None:
    """Create the test database once, if missing."""
    with psycopg.connect(ADMIN_DSN) as conn, conn.cursor() as cur:
        cur.execute("SELECT 1 FROM pg_database WHERE datname=%s", (TEST_DB,))
        if cur.fetchone() is None:
            conn.autocommit = True
            with conn.cursor() as cur2:
                cur2.execute(f'CREATE DATABASE "{TEST_DB}"')
    # schema
    schema = (REPO_ROOT / "store/schema.sql").read_text()
    with psycopg.connect(TEST_DSN) as conn:
        with conn.cursor() as cur:
            cur.execute(schema)
        conn.commit()


def _embed_texts(texts: list[str]) -> list[list[float]] | None:
    """Compute embeddings for the seeded claims. Returns None if Ollama is down."""
    try:
        import ollama

        return ollama.embed(model="nomic-embed-text", input=texts)["embeddings"]
    except Exception:
        return None


def _seed_test_db() -> None:
    """Load a small, deterministic subset of claims + countries into the test DB."""
    claims_path = REPO_ROOT / "data/parsed/claims.jsonl"
    rows = []
    with claims_path.open("r", encoding="utf-8") as fh:
        for line in fh:
            rec = json.loads(line)
            if rec["policy_item_code"] in KNOWN_CODES:
                rows.append(rec)

    # fall back to a keyword subset if a known code vanished upstream
    if not rows:
        keywords = ("vitamin c", "glucomannan", "lactobacillus", "dha")
        with claims_path.open("r", encoding="utf-8") as fh:
            for line in fh:
                rec = json.loads(line)
                text = (rec.get("claim_text") or "").lower()
                if any(k in text for k in keywords):
                    rows.append(rec)
                if len(rows) >= 40:
                    break

    # compute embeddings once for the subset (best-effort; None if Ollama down)
    embeds: dict[str, list[float]] = {}
    if rows:
        texts = [f"{r.get('claim_text') or ''} — {r.get('health_relationship') or ''}" for r in rows]
        vecs = _embed_texts(texts)
        if vecs:
            embeds = {r["policy_item_code"]: v for r, v in zip(rows, vecs, strict=True)}

    with psycopg.connect(TEST_DSN) as conn:
        with conn.cursor() as cur:
            for code, name in [
                ("FR", "France"),
                ("DE", "Germany"),
                ("ES", "Spain"),
                ("GB", "United Kingdom"),
            ]:
                cur.execute(
                    "INSERT INTO countries (code, name) VALUES (%s,%s) ON CONFLICT (code) DO NOTHING",
                    (code, name),
                )
            for rec in rows:
                cur.execute(
                    """INSERT INTO claims
                       (policy_item_code, claim_text, health_relationship, status, claim_type,
                        conditions_of_use, restriction_of_use, nutrient_food_cat,
                        reasons_for_non_auth, data_protection, embedding)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                       ON CONFLICT (policy_item_code) DO NOTHING
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
                        rec.get("data_protection") == "yes",
                        embeds.get(rec["policy_item_code"]),
                    ),
                )
                claim_id = cur.fetchone()
                if claim_id is None:  # already inserted previously
                    cur.execute(
                        "SELECT id FROM claims WHERE policy_item_code=%s",
                        (rec["policy_item_code"],),
                    )
                    claim_id = cur.fetchone()
                for cc in ("FR", "DE", "ES", "GB"):
                    status = "allowed" if rec["status"] == "authorised" else "not_allowed"
                    cur.execute(
                        """INSERT INTO country_status (claim_id, country_code, status, note)
                           VALUES (%s,%s,%s,NULL) ON CONFLICT DO NOTHING""",
                        (claim_id[0], cc, status),
                    )
        conn.commit()


@pytest.fixture(scope="session")
def test_db():
    """Isolated database with a small deterministic dataset (integration tests)."""
    _ensure_test_db()
    _seed_test_db()
    return TEST_DSN


@pytest.fixture
def sku_dsn(monkeypatch, test_db):
    """Point rag/retrieve at the test database for the duration of a test."""
    monkeypatch.setenv("SKU_DB_DSN", test_db)
    # force a fresh import so modules read the updated env var
    for mod in list(sys.modules):
        if mod.startswith(("rag.", "api.", "store.")):
            del sys.modules[mod]
    import rag.retrieve  # noqa: F401

    return test_db


@pytest.fixture
def retrieve_module(sku_dsn):
    """The freshly-imported rag.retrieve module bound to the test DSN."""
    import rag.retrieve

    return rag.retrieve
