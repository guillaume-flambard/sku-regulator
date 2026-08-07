# sku-regulator — test orchestration
#
#   make test-unit         pure Python unit tests (parser, ingredients, RRF)
#   make test-integration  Python tests against the test Postgres DB
#   make test-api          FastAPI endpoint tests (uses test DB)
#   make test-python       all Python tests (unit + integration + api)
#   make test-e2e          Playwright E2E (needs API :8000 + web :3000 running)
#   make test              everything
#
#   make demo              boot everything (db + seed + api + web)
#   make demo-prod         boot with a production web build (stable for demos)
#   make health            pre-demo health check
#   make reseed            reset the demo data (anomaly queue etc.)

PYTHON   ?= .venv/bin/python
E2E_DIR  := web

.PHONY: test-unit test-integration test-api test-python test-e2e test demo demo-prod health reseed

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

demo:
	bash scripts/demo.sh

demo-prod:
	bash scripts/demo.sh --build

health:
	bash scripts/healthcheck.sh

reseed:
	$(PYTHON) store/demo_enrich.py
