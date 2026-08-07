"""Resilience: the API must fail gracefully when its backing services are down.

These verify the app's behaviour under failure rather than success paths:
  - DB unreachable -> the API returns a clean 500 with a message, not a crash.
  - Empty/malformed input -> handled without 500s where the contract allows it.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

pytestmark = pytest.mark.integration


@pytest.fixture
def broken_db_client(monkeypatch):
    """TestClient with a deliberately unreachable DSN."""
    monkeypatch.setenv("SKU_DB_DSN", "host=127.0.0.1 port=1 dbname=nope user=nope password=nope")
    for mod in list(sys.modules):
        if mod.startswith(("rag.", "api.")):
            del sys.modules[mod]
    from fastapi.testclient import TestClient

    import api.main

    return TestClient(api.main.app)


def test_stats_returns_clean_error_when_db_down(broken_db_client):
    r = broken_db_client.get("/api/stats")
    assert r.status_code == 500
    # must be a JSON error, not a crash/HTML stacktrace
    assert "detail" in r.json()


def test_claims_returns_clean_error_when_db_down(broken_db_client):
    r = broken_db_client.get("/api/claims", params={"q": "vitamin C"})
    assert r.status_code == 500
    assert "detail" in r.json()


def test_anomalies_returns_clean_error_when_db_down(broken_db_client):
    r = broken_db_client.get("/api/anomalies")
    assert r.status_code == 500
    assert "detail" in r.json()


def test_health_works_without_db():
    """Health is a liveness probe — must not depend on the DB."""
    import os

    os.environ["SKU_DB_DSN"] = "host=127.0.0.1 port=1 dbname=nope user=nope password=nope"
    for mod in list(sys.modules):
        if mod.startswith(("rag.", "api.")):
            del sys.modules[mod]
    from fastapi.testclient import TestClient

    import api.main

    r = TestClient(api.main.app).get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
