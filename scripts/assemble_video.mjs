#!/usr/bin/env node
/**
 * Assemble the final video: composed scenes (from Remotion) + background music.
 *
 * Subtitles are already burned in by the Remotion composition (SceneOverlay);
 * this step only mixes the CC BY 4.0 background track at low volume with fades.
 *
 * Usage: node scripts/assemble_video.mjs
 */
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const COMPOSED = resolve(ROOT, "video", "final", "composed.mp4");
const MUSIC = resolve(ROOT, "audio", "Inspired-KevinMacLeod.mp3");
const OUT = resolve(ROOT, "video", "final", "sku-regulator-demo.mp4");

if (!existsSync(COMPOSED)) throw new Error(`composed video missing: ${COMPOSED}. Run the Remotion render first.`);
if (!existsSync(MUSIC)) throw new Error(`music missing: ${MUSIC}. Run scripts/fetch_music.mjs.`);

console.log("[assemble] mixing background music (fade in/out, low volume)…");

// read the composed video duration so the music fade-out lands near the end
const durOut = execSync(
  `ffprobe -v error -show_entries format=duration -of csv=p=0 ${JSON.stringify(COMPOSED)}`,
  { encoding: "utf8" },
).trim();
const dur = parseFloat(durOut) || 60;
const fadeOutStart = Math.max(0, dur - 3);

// -stream_loop -1: loop the track; fade in 2s, fade out last 3s; volume ~35%
// -shortest: end when the video ends
const cmd = [
  "ffmpeg -y",
  `-i ${JSON.stringify(COMPOSED)}`,
  `-i ${JSON.stringify(MUSIC)}`,
  "-filter_complex",
  JSON.stringify(
    `[1:a]afade=t=in:st=0:d=2,afade=t=out:st=${fadeOutStart}:d=3,volume=0.5[bg];` +
    "[0:a][bg]amix=inputs=2:duration=shortest:dropout_transition=2[aout]",
  ),
  "-map 0:v:0 -map [aout]",
  "-c:v copy -c:a aac -b:a 192k -movflags +faststart",
  JSON.stringify(OUT),
].join(" ");

execSync(cmd, { stdio: "inherit", cwd: ROOT });
console.log(`[assemble] final video: ${OUT}`);
