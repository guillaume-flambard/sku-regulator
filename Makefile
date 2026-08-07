# sku-regulator — test orchestration
#
#   make test-unit         pure Python unit tests (parser, ingredients, RRF)
#   make test-integration  Python tests against the test Postgres DB
#   make test-api          FastAPI endpoint tests (uses test DB)
#   make test-python       all Python tests (unit + integration + api)
#   make test-e2e          Playwright E2E (needs API :8000 + web :3000 running)
#   make test              everything

PYTHON   ?= .venv/bin/python
E2E_DIR  := web

.PHONY: test-unit test-integration test-api test-python test-e2e test

test-unit:
	$(PYTHON) -m pytest -m "not integration and not slow" tests

test-integration:
	$(PYTHON) -m pytest -m integration tests

test-api:
	$(PYTHON) -m pytest tests/test_api.py

test-python:
	$(PYTHON) -m pytest -m "not slow" tests

test-e2e:
	cd $(E2E_DIR) && npx playwright test

test: test-python
	cd $(E2E_DIR) && npx playwright test
