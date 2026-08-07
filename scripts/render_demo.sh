#!/usr/bin/env bash
# One-shot demo video pipeline:
#   1. fetch background music (CC BY 4.0, Josh Woodward)
#   2. record the 5 scenes (Playwright recordVideo)
#   3. render the Remotion composition (titles, subtitles, zooms, transitions)
#   4. mix the music and produce the final mp4
#
# Prereq: the demo is running (bash scripts/demo.sh) — API :8000, web :3000.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }

step "1/4  Music (CC BY 4.0)"
node scripts/fetch_music.mjs

step "2/4  Record scenes (Playwright)"
rm -f video/raw/*.webm video/raw/*.png
node --experimental-strip-types scripts/record_demo.mjs

step "3/4  Render composition (Remotion)"
cd web
rm -rf remotion-public/raw
mkdir -p remotion-public/raw
cp ../video/raw/scene-*.webm remotion-public/raw/
npx remotion render remotion/index.tsx DemoVideo ../video/final/composed.mp4

step "4/4  Mix music + finalize (ffmpeg)"
cd ..
node scripts/assemble_video.mjs

printf '\n\033[1;32m✔ Final video:\033[0m  video/final/sku-regulator-demo.mp4\n'
