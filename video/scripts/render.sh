#!/usr/bin/env bash
# One-shot demo video pipeline (standalone module, external to the app core):
#   1. fetch background music (CC BY 4.0, Kevin MacLeod)
#   2. record the 5 scenes (Playwright recordVideo)
#   3. render the Remotion composition (titles, lower-thirds, zooms, transitions)
#   4. mix the music and produce the final mp4
#
# Prereq: the demo app is running (bash ../..scripts/demo.sh from repo root).
# Run from the repo root: make demo-video  (or: cd video && npm run all)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }

# ensure module deps installed (playwright, remotion)
if [ ! -d node_modules ]; then
  echo "[video] installing deps…"
  npm install --legacy-peer-deps
fi

step "1/4  Music (CC BY 4.0)"
node scripts/fetch-music.mjs

step "2/4  Record scenes (Playwright)"
rm -f dist/raw/*.webm dist/raw/*.png
node --experimental-strip-types scripts/record.mjs

step "3/4  Render composition (Remotion)"
rm -rf public/raw
mkdir -p public/raw
cp dist/raw/scene-*.webm public/raw/
npx remotion render src/index.tsx DemoVideo dist/final/composed.mp4

step "4/4  Mix music + finalize (ffmpeg)"
node scripts/assemble.mjs

printf '\n\033[1;32m✔ Final video:\033[0m  %s\n' "$(pwd)/dist/final/sku-regulator-demo.mp4"
