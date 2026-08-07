#!/usr/bin/env node
/**
 * Record the demo video: runs the scene actions (from demo-script.ts) in a real
 * Chromium with Playwright recordVideo, producing one .webm per scene.
 *
 * Prereq: the demo must be running (bash scripts/demo.sh) — API :8000, web :3000.
 *
 * Usage: node scripts/record_demo.mjs
 */
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
// playwright lives in this module's own node_modules (standalone video system)
const { chromium } = require(resolve(ROOT, "node_modules", "@playwright/test"));

const RAW_DIR = resolve(ROOT, "dist", "raw");
const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3000";

// Load the scene definitions from the TS source-of-truth.
const scriptModule = await import(`${ROOT}/scripts/demo-script.ts`);
const SCENES = scriptModule.SCENES;

mkdirSync(RAW_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function runStep(page, step) {
  switch (step.type) {
    case "goto":
      await page.goto(`${BASE}${step.target}`, { waitUntil: "networkidle" });
      break;
    case "click": {
      const loc = page.locator(step.target).first();
      await loc.waitFor({ state: "visible", timeout: 20000 });
      await loc.click();
      break;
    }
    case "type":
      await page.locator(step.target).first().fill(step.value ?? "");
      break;
    case "press":
      await page.keyboard.press(step.target);
      break;
    case "scroll":
      await page.locator(step.target).first().scrollIntoViewIfNeeded();
      break;
    case "wait":
    default:
      break;
  }
  if (step.waitMs) await page.waitForTimeout(step.waitMs);
}

for (const scene of SCENES) {
  console.log(`[record] scene: ${scene.id} (${scene.durationSec}s)`);

  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir: RAW_DIR, size: { width: 1920, height: 1080 } },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  });

  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);

  for (const step of scene.actions) {
    try {
      await runStep(page, step);
    } catch (err) {
      console.error(`         ✗ step failed (${step.type}: ${step.target}): ${err.message}`);
    }
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: resolve(RAW_DIR, `scene-${scene.id}.png`) });

  await ctx.close(); // flushes the per-scene video

  // the recorder names files page@<hash>.webm — rename to scene-<id>.webm
  const fresh = readdirSync(RAW_DIR).filter((f) => f.endsWith(".webm") && f.startsWith("page@"));
  if (fresh.length === 1) {
    renameSync(resolve(RAW_DIR, fresh[0]), resolve(RAW_DIR, `scene-${scene.id}.webm`));
  }
}

await browser.close();

console.log("[record] done — check video/dist/raw/ for the .webm + preview PNGs");

