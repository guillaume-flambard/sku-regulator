# Demo video pipeline

A one-shot pipeline that turns the running demo into a polished video with
animated overlays, burned-in subtitles, and a background music track — driven by
an LLM-maintained script (`scripts/demo-script.ts`).

## Flow

```
make demo            # boot the app (db + api + web)
make demo-video      # 4 steps below
```

| # | Script | What it does |
|---|---|---|
| 1 | `scripts/fetch_music.mjs` | Downloads the background track (CC BY 4.0) into `audio/` |
| 2 | `scripts/record_demo.mjs` | Plays the scene actions in real Chromium, `recordVideo` → `video/raw/scene-*.webm` |
| 3 | `npx remotion render` | Composes the scenes: title cards, subtitle captions, Ken-Burns zooms, fade transitions → `video/final/composed.mp4` |
| 4 | `scripts/assemble_video.mjs` | Mixes the music at low volume with fades → `video/final/sku-regulator-demo.mp4` |

Output: **`video/final/sku-regulator-demo.mp4`** (1080p, H.264 + AAC).

## The source of truth

`scripts/demo-script.ts` defines the 5 scenes (one per demo page) with:

- `title` — the animated title card.
- `subtitles` — short burn-in captions shown during the scene (kept terse so
  they read as labels over the live UI, not narration).
- `actions` — the Playwright steps (goto / click / type / press / wait) that
  drive the recording.
- `durationSec` + `focus` — scene length and the Ken-Burns zoom target.

Keep it in sync with `docs/demo-runbook.md` whenever the demo changes: update
the actions, subtitles, and durations, then re-run `make demo-video`.

## Music & licensing

- Track: **"Airplane Mode"** by Josh Woodward, from *The Beautiful Machine*
  (2014). Download: <https://www.joshwoodward.com/mp3/JoshWoodward-TheBeautifulMachine-11-AirplaneMode.mp3>
- License: **Creative Commons Attribution 4.0** — free to use, attribution required.
- Attribution (include in any distributed video):
  *Music: "Airplane Mode" by Josh Woodward (https://www.joshwoodward.com), CC BY 4.0.*
- Also shown in the video's end card.

The MP3 is not committed (binary); `fetch_music.mjs` downloads it on demand.

## Subtitles

Subtitles are **burned in** during the Remotion render (they are part of the
composed frames), so the final MP4 carries them visibly on any player. To change
wording, edit `subtitles` in `scripts/demo-script.ts` and re-render.

## Artifacts & gitignore

```
video/raw/     per-scene recordings + preview PNGs (gitignored)
video/final/   composed.mp4 + sku-regulator-demo.mp4 (gitignored)
audio/         background track (gitignored)
web/remotion-public/  webm copies served to Remotion (gitignored)
```

The scripts and the scene definition **are committed**; the binary artifacts
(video + audio) are regenerated on demand.
