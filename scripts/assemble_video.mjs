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
const MUSIC = resolve(ROOT, "audio", "AirplaneMode-JoshWoodward.mp3");
const OUT = resolve(ROOT, "video", "final", "sku-regulator-demo.mp4");

if (!existsSync(COMPOSED)) throw new Error(`composed video missing: ${COMPOSED}. Run the Remotion render first.`);
if (!existsSync(MUSIC)) throw new Error(`music missing: ${MUSIC}. Run scripts/fetch_music.mjs.`);

console.log("[assemble] mixing background music (fade in/out, low volume)…");

// -stream_loop -1: loop the track; fade in 2s, fade out last 3s; volume ~14%
// -shortest: end when the video ends
const cmd = [
  "ffmpeg -y",
  `-i ${JSON.stringify(COMPOSED)}`,
  `-i ${JSON.stringify(MUSIC)}`,
  "-filter_complex",
  JSON.stringify(
    "[1:a]afade=t=in:st=0:d=2,afade=t=out:st=55:d=3,volume=0.14[bg];" +
    "[0:a][bg]amix=inputs=2:duration=shortest:dropout_transition=2[aout]",
  ),
  "-map 0:v:0 -map [aout]",
  "-c:v copy -c:a aac -b:a 192k -movflags +faststart",
  JSON.stringify(OUT),
].join(" ");

execSync(cmd, { stdio: "inherit", cwd: ROOT });
console.log(`[assemble] final video: ${OUT}`);
