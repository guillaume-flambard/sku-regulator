#!/usr/bin/env node
/**
 * Fetch the demo background music (CC BY 4.0, attribution required).
 *
 * Source: "Inspired" by Kevin MacLeod (incompetech.com).
 *   URL: https://incompetech.com/music/royalty-free/mp3-royaltyfree/Inspired.mp3
 *   License: Creative Commons Attribution 4.0 — free use with attribution.
 *   Attribution to include in any video derived from this music:
 *     Music: "Inspired" by Kevin MacLeod (incompetech.com), CC BY 4.0.
 *
 * The MP3 is not committed to the repo (binary); this script fetches it so the
 * video pipeline is reproducible.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "audio", "Inspired-KevinMacLeod.mp3");
const SRC = "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Inspired.mp3";

mkdirSync(dirname(OUT), { recursive: true });

if (existsSync(OUT) && process.env.FORCE !== "1") {
  console.log(`[music] already present: ${OUT}`);
  process.exit(0);
}

console.log(`[music] downloading ${SRC}`);
const res = await fetch(SRC, { headers: { "User-Agent": "Mozilla/5.0 (sku-regulator demo)" } });
if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
writeFileSync(OUT, Buffer.from(await res.arrayBuffer()));
console.log(`[music] saved ${OUT}`);

