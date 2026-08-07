# Demo video pipeline

A one-shot pipeline that turns the running demo into a polished video with
animated overlays, burned-in subtitles, and a background music track — driven by
an LLM-maintained script (`video/scripts/demo-script.ts`).

The video system is a **standalone module** (`video/`), external to the app
core: it has its own `package.json` (Remotion, Playwright), source, scripts and
artifacts. It only needs the app to be running at `DEMO_BASE_URL`.

## Flow

```
make demo            # boot the app (db + api + web)
make demo-video      # cd video && bash scripts/render.sh
```

## The module

```
video/
  package.json          standalone deps (remotion, @remotion/transitions, playwright, zod)
  tsconfig.json         typecheck for src/ + demo-script.ts
  remotion.config.ts    entry point + publicDir
  src/                  Remotion composition (DemoVideo, SceneOverlay, Captions, schema)
  scripts/
    demo-script.ts      the scene script (source of truth)
    record.mjs          Playwright recordVideo → dist/raw/scene-*.webm
    fetch-music.mjs     download the CC BY 4.0 track → dist/audio/
    render.sh           one-shot orchestration (install → fetch → record → compose → mix)
    assemble.mjs        ffmpeg mix music → dist/final/sku-regulator-demo.mp4
  public/raw/           webm copies served to Remotion (gitignored)
  dist/                 recordings, composed.mp4, final mp4, audio (all gitignored)
  docs/                 this file
```

Output: **`video/dist/final/sku-regulator-demo.mp4`** (1080p, H.264 + AAC).

## Video quality (best practices applied)

- **Transitions** (`@remotion/transitions`): `wipe` between scenes, `iris` into
  the compliance scene, `fade` into the end card — no hand-rolled fades.
- **Lower-third captions** (not karaoke): one short phrase at a time in a
  discreet bottom pill — the professional product-demo look (Screen Studio
  style), not TikTok-style word-by-word. A single accent word (brand green)
  guides the eye. Timings are derived from each scene's `durationSec`.
- **Motion restraint**: Ken-Burns zooms stay subtle (scale ~1.06–1.08) and every
  easing uses `Easing.out(Easing.quad)`; captions hold ≥2.5s (readable twice).
- **Editable props**: the Composition exposes a Zod `schema` +
  `defaultProps` (`video/src/schema.ts`) so an agent can regenerate the video
  with new text/durations without touching the React code.

## The source of truth

`video/scripts/demo-script.ts` defines the 5 scenes (one per demo page) with:

- `title` — the animated title card.
- `subtitles` — short burn-in captions shown during the scene (kept terse so
  they read as labels over the live UI, not narration).
- `actions` — the Playwright steps (goto / click / type / press / wait) that
  drive the recording.
- `durationSec` + `focus` — scene length and the Ken-Burns zoom target.

Keep it in sync with `docs/demo-runbook.md` whenever the demo changes: update
the actions, subtitles, and durations, then re-run `make demo-video`.

## Music & licensing

- Track: **"Inspired"** by Kevin MacLeod (incompetech.com). Download:
  <https://incompetech.com/music/royalty-free/mp3-royaltyfree/Inspired.mp3>
- License: **Creative Commons Attribution 4.0** — free to use, attribution required.
- Attribution (include in any distributed video):
  *Music: "Inspired" by Kevin MacLeod (https://incompetech.com), CC BY 4.0.*
- Also shown in the video's end card.

The MP3 is not committed (binary); `fetch-music.mjs` downloads it on demand.

## Artifacts & gitignore

```
video/dist/raw/    per-scene recordings + preview PNGs (gitignored)
video/dist/final/  composed.mp4 + sku-regulator-demo.mp4 (gitignored)
video/dist/audio/  background track (gitignored)
video/public/raw/  webm copies served to Remotion (gitignored)
video/node_modules/ (gitignored)
```

The module source (src/, scripts/, package.json, docs) **is committed**; the
binary artifacts (video + audio) are regenerated on demand.
