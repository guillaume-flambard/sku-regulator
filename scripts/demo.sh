#!/usr/bin/env bash
# Boot the whole sku-regulator demo with one command.
#
#   scripts/demo.sh          start everything (db + api + web)
#   scripts/demo.sh --build  run the web server in production mode (next build)
#
# Idempotent: safe to run repeatedly. Verifies each layer and tells you
# exactly what's missing instead of failing silently.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PYTHON="$ROOT/.venv/bin/python"
MODE="dev"
[ "${1:-}" = "--build" ] && MODE="prod"

step()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }
ok()    { printf '\033[32m  ✓ %s\033[0m\n' "$1"; }
warn()  { printf '\033[33m  ⚠ %s\033[0m\n' "$1"; }
fail()  { printf '\033[31m  ✗ %s\033[0m\n' "$1"; }

step "1/6  Python venv"
if [ ! -x "$PYTHON" ]; then
  fail "no venv at $PYTHON — run: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi
ok "venv present"

step "2/6  Database (docker compose)"
if ! docker info >/dev/null 2>&1; then
  fail "Docker daemon is not running — open Docker Desktop first."
  exit 1
fi
docker compose up -d db >/dev/null
for i in $(seq 1 20); do
  if docker exec sku-regulator-db pg_isready -U sku -d sku_regulator >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec sku-regulator-db pg_isready -U sku -d sku_regulator >/dev/null 2>&1 \
  || { fail "database did not become ready"; exit 1; }
ok "postgres healthy on :55432"

step "3/6  Ollama models"
if ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
  warn "Ollama is not running — embeddings/LLM will be unavailable. Start it: ollama serve"
else
  have() { curl -s http://localhost:11434/api/tags | grep -q "\"name\":\"$1\""; }
  for m in "nomic-embed-text:latest" "llama3.2:3b"; do
    if have "$m"; then ok "model $m"; else warn "model $m missing — run: ollama pull $m"; fi
  done
fi

step "4/6  Seed data (idempotent)"
"$PYTHON" store/seed.py >/dev/null
"$PYTHON" store/demo_enrich.py >/dev/null
ok "claims + demo SKUs + anomaly queue seeded"

step "5/6  API"
if curl -s http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
  ok "API already running on :8000"
else
  (cd "$ROOT" && nohup "$PYTHON" -m uvicorn api.main:app --host 127.0.0.1 --port 8000 >/tmp/sku-api.log 2>&1 &)
  for i in $(seq 1 15); do
    curl -s http://127.0.0.1:8000/api/health >/dev/null 2>&1 && break
    sleep 1
  done
  curl -s http://127.0.0.1:8000/api/health >/dev/null 2>&1 \
    || { fail "API failed to start — see /tmp/sku-api.log"; exit 1; }
  ok "API started on :8000"
fi

step "6/6  Web"
cd "$ROOT/web"
if curl -s http://localhost:3000/ >/dev/null 2>&1; then
  ok "web already running on :3000"
else
  if [ "$MODE" = "prod" ]; then
    if [ ! -d "$ROOT/web/.next" ]; then
      npm run build >/tmp/sku-web-build.log 2>&1
    fi
    (nohup npm run start >/tmp/sku-web.log 2>&1 &)
  else
    (nohup npm run dev >/tmp/sku-web.log 2>&1 &)
  fi
  for i in $(seq 1 30); do
    curl -s http://localhost:3000/ >/dev/null 2>&1 && break
    sleep 1
  done
  curl -s http://localhost:3000/ >/dev/null 2>&1 \
    || { fail "web failed to start — see /tmp/sku-web.log"; exit 1; }
  ok "web started on :3000"
fi

step "✔ Demo is up"
printf '  \033[1mDashboard:\033[0m  http://localhost:3000\n'
printf '  \033[1mAPI:\033[0m         http://127.0.0.1:8000/api/health\n'
printf '  \033[1mDemo script:\033[0m docs/demo-runbook.md\n'
