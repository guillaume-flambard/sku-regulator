/**
 * demo-script.ts — single source of truth for the demo video pipeline.
 *
 * The LLM keeps this in sync with docs/demo-runbook.md. It drives:
 *   1. recording   (scripts/record_demo.mjs — Playwright actions per scene)
 *   2. overlays    (web/remotion — titles + lower-third subtitles)
 *   3. assembly    (scripts/assemble_video.mjs — concat + background music)
 *
 * Subtitles are deliberately SHORT (a few words each) so they read as caption
 * labels over the live UI, not narration paragraphs. The `focus` point drives
 * a subtle Ken-Burns zoom (scale > 1.0 = a real push-in toward the UI region
 * that matters in that scene).
 */

export interface Step {
  type: "goto" | "click" | "type" | "wait" | "scroll" | "press";
  /** CSS selector (goto: url path) */
  target: string;
  value?: string;
  /** settle time after the action, ms */
  waitMs: number;
}

export interface Scene {
  id: string;
  title: string;
  /** short overlay subtitle shown while the scene plays */
  subtitles: string[];
  durationSec: number;
  /** x:y focus point + zoom scale for the Ken-Burns push-in (scale > 1) */
  focus?: { x: number; y: number; scale: number };
  actions: Step[];
}

export const VIDEO = {
  width: 1920,
  height: 1080,
  fps: 30,
  /** seconds of the composed scene that precede the raw footage (title card) */
  titleLeadIn: 2,
};

export const SCENES: Scene[] = [
  {
    id: "home",
    title: "The pipeline",
    subtitles: ["The EU register decides what you may print on a label", "2,337 claims scraped — real data, not a mock", "Postgres + pgvector · 28 markets"],
    durationSec: 12,
    focus: { x: 0.55, y: 0.35, scale: 1.06 },
    actions: [
      { type: "goto", target: "/", waitMs: 2500 },
      { type: "click", target: 'button:has-text("04Retrieve")', waitMs: 1200 },
      { type: "click", target: 'button:has-text("05Verify")', waitMs: 1200 },
      { type: "click", target: 'button:has-text("01Ingest")', waitMs: 1200 },
      { type: "wait", target: "", waitMs: 1500 },
    ],
  },
  {
    id: "explore",
    title: "Ask the register",
    subtitles: ["Vitamin C immune claim — authorised", "hybrid FTS + vector search", "The grounded answer cites the register"],
    durationSec: 28,
    focus: { x: 0.4, y: 0.45, scale: 1.07 },
    actions: [
      { type: "goto", target: "/explore", waitMs: 3500 },
      { type: "wait", target: "", waitMs: 2500 },
      { type: "click", target: 'button:has-text("Read the grounded answer")', waitMs: 12000 },
      { type: "click", target: 'button:has-text("Back to matches")', waitMs: 800 },
      { type: "click", target: 'input[placeholder*="vitamin C supports"]', waitMs: 300 },
      { type: "type", target: 'input[placeholder*="vitamin C supports"]', value: "probiotic gut health", waitMs: 500 },
      { type: "press", target: "Enter", waitMs: 3500 },
    ],
  },
  {
    id: "portfolio",
    title: "Human-in-the-loop",
    subtitles: ["Six demo SKUs across markets", "Probiotic 12 Strains — needs review", "Resolve, then Undo — a human signs off"],
    durationSec: 10,
    focus: { x: 0.5, y: 0.42, scale: 1.08 },
    actions: [
      { type: "goto", target: "/portfolio", waitMs: 2500 },
      { type: "wait", target: "", waitMs: 2000 },
      { type: "click", target: 'button:has-text("Resolve")', waitMs: 900 },
      { type: "click", target: 'button:has-text("Undo")', waitMs: 1500 },
    ],
  },
  {
    id: "graph",
    title: "The architecture",
    subtitles: ["Products → claims → ingredients", "Same Postgres schema, rendered as a graph"],
    durationSec: 9,
    focus: { x: 0.5, y: 0.45, scale: 1.06 },
    actions: [
      { type: "goto", target: "/graph", waitMs: 2500 },
      { type: "wait", target: "", waitMs: 2000 },
    ],
  },
  {
    id: "close",
    title: "The thing that doesn't exist yet",
    subtitles: ["Five steps · real EU data · local AI · human sign-off", "Partially built"],
    durationSec: 8,
    actions: [
      { type: "goto", target: "/", waitMs: 1500 },
      { type: "scroll", target: "#pipeline", waitMs: 2500 },
    ],
  },
];

export function totalDurationSec(): number {
  return SCENES.reduce((acc, s) => acc + s.durationSec, 0);
}
