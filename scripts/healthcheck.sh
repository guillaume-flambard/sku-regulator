#!/usr/bin/env bash
# Pre-demo health check. Verifies every layer the demo depends on and exits
# non-zero if anything critical is missing. Run this right before the demo.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FAILED=0
ok()   { printf '\033[32m  ✓ %s\033[0m\n' "$1"; }
warn() { printf '\033[33m  ⚠ %s\033[0m\n' "$1"; }
fail() { printf '\033[31m  ✗ %s\033[0m\n' "$1"; FAILED=1; }

echo "sku-regulator — pre-demo health check"

echo "Database"
if docker exec sku-regulator-db pg_isready -U sku -d sku_regulator >/dev/null 2>&1; then
  ok "postgres :55432"
else
  fail "postgres not ready — run scripts/demo.sh"
fi

echo "Data"
COUNT=$(docker exec sku-regulator-db psql -U sku -d sku_regulator -tAc "SELECT count(*) FROM claims" 2>/dev/null || echo "0")
if [ "$COUNT" -ge 1000 ]; then ok "claims seeded ($COUNT)"; else fail "claims missing ($COUNT) — run scripts/demo.sh"; fi
ANOM=$(docker exec sku-regulator-db psql -U sku -d sku_regulator -tAc "SELECT count(*) FROM anomalies WHERE status='open'" 2>/dev/null || echo "0")
if [ "$ANOM" -ge 1 ]; then ok "anomaly queue populated ($ANOM open)"; else warn "no open anomalies — the human-in-the-loop demo needs them"; fi

echo "Ollama (local AI)"
if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
  ok "ollama reachable"
  have() { curl -s http://localhost:11434/api/tags | grep -q "\"name\":\"$1\""; }
  have "nomic-embed-text:latest" && ok "nomic-embed-text" || warn "nomic-embed-text missing (embeddings/search degraded)"
  have "llama3.2:3b" && ok "llama3.2:3b" || warn "llama3.2:3b missing (grounded-answer will fail)"
else
  fail "ollama not running — embeddings and the grounded answer need it"
fi

echo "API"
if curl -s http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
  ok "api :8000"
else
  fail "api not running — run scripts/demo.sh"
fi

echo "Web"
if curl -s http://localhost:3000/ >/dev/null 2>&1; then
  ok "web :3000"
else
  fail "web not running — run scripts/demo.sh"
fi

echo
if [ "$FAILED" -eq 1 ]; then
  echo "\033[31mFix the ✗ items above, then re-run: scripts/demo.sh && scripts/healthcheck.sh\033[0m"
  exit 1
else
  echo "\033[32mAll critical layers healthy. You're ready to demo.\033[0m"
fi
