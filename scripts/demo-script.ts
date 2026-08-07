/**
 * demo-script.ts — single source of truth for the demo video pipeline.
 *
 * The LLM keeps this in sync with docs/demo-runbook.md. It drives:
 *   1. recording   (scripts/record_demo.mjs — Playwright actions per scene)
 *   2. overlays    (web/remotion — titles + short subtitles)
 *   3. assembly    (scripts/assemble_video.mjs — concat + background music)
 *
 * Subtitles are deliberately SHORT (a few words each) so they read as caption
 * labels over the live UI, not narration paragraphs.
 */

export interface Step {
  type: "goto" | "click" | "type" | "wait" | "scroll" | "press";
  /** CSS selector (goto: url path) */
  target: string;
  value?: string;
  /** settle time after the action, ms */
  waitMs: number;
  /** subtitle caption while this step is happening */
  caption?: string;
}

export interface Scene {
  id: string;
  title: string;
  /** short overlay subtitle shown while the scene plays */
  subtitles: string[];
  durationSec: number;
  /** optional x:y focus point for the zoom-in effect */
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
    focus: { x: 0.5, y: 0.4, scale: 1.0 },
    actions: [
      { type: "goto", target: "/", waitMs: 2500, caption: "The EU register decides what goes on a label" },
      { type: "click", target: 'button:has-text("04Retrieve")', waitMs: 1200, caption: "Hybrid full-text + semantic retrieval" },
      { type: "click", target: 'button:has-text("05Verify")', waitMs: 1200, caption: "Human-in-the-loop compliance" },
      { type: "click", target: 'button:has-text("01Ingest")', waitMs: 1200, caption: "2,337 claims scraped from the register" },
      { type: "wait", target: "", waitMs: 1500, caption: "Postgres + pgvector · 28 markets" },
    ],
  },
  {
    id: "explore",
    title: "Ask the register",
    subtitles: ["Vitamin C immune claim — authorised", "hybrid FTS + vector search", "The grounded answer cites the register"],
    durationSec: 28,
    focus: { x: 0.5, y: 0.5, scale: 1.0 },
    actions: [
      { type: "goto", target: "/explore", waitMs: 3500, caption: "Vitamin C immune claim — authorised in FR" },
      { type: "wait", target: "", waitMs: 2500, caption: "Register code · status · fts/vec scores" },
      { type: "click", target: 'button:has-text("Read the grounded answer")', waitMs: 12000, caption: "Grounded answer — cites the register" },
      { type: "click", target: 'button:has-text("Back to matches")', waitMs: 800 },
      { type: "click", target: 'input[placeholder*="vitamin C supports"]', waitMs: 300 },
      { type: "type", target: 'input[placeholder*="vitamin C supports"]', value: "probiotic gut health", waitMs: 500 },
      { type: "press", target: "Enter", waitMs: 3500, caption: "Probiotic claim — not authorised" },
    ],
  },
  {
    id: "portfolio",
    title: "Human-in-the-loop",
    subtitles: ["Six demo SKUs across markets", "Probiotic 12 Strains — needs review", "Resolve, then Undo — a human signs off"],
    durationSec: 10,
    focus: { x: 0.5, y: 0.45, scale: 1.0 },
    actions: [
      { type: "goto", target: "/portfolio", waitMs: 2500, caption: "Six demo SKUs, four markets" },
      { type: "wait", target: "", waitMs: 2000, caption: "Probiotic 12 Strains — needs review" },
      { type: "click", target: 'button:has-text("Resolve")', waitMs: 900, caption: "Resolve — a person decides" },
      { type: "click", target: 'button:has-text("Undo")', waitMs: 1500, caption: "Undo — nothing auto-ships" },
    ],
  },
  {
    id: "graph",
    title: "The architecture",
    subtitles: ["Products → claims → ingredients", "Same Postgres schema, rendered as a graph"],
    durationSec: 9,
    focus: { x: 0.5, y: 0.5, scale: 1.0 },
    actions: [
      { type: "goto", target: "/graph", waitMs: 2500, caption: "Products → claims → ingredients" },
      { type: "wait", target: "", waitMs: 2000, caption: "Not a graph store — the same schema" },
    ],
  },
  {
    id: "close",
    title: "The thing that doesn't exist yet",
    subtitles: ["Five steps · real EU data · local AI · human sign-off", "Partially built"],
    durationSec: 8,
    actions: [
      { type: "goto", target: "/", waitMs: 1500, caption: "Five steps · real EU data · human sign-off" },
      { type: "scroll", target: "#pipeline", waitMs: 2500, caption: "The thing that doesn't exist yet — partially built" },
    ],
  },
];

export function totalDurationSec(): number {
  return SCENES.reduce((acc, s) => acc + s.durationSec, 0);
}
