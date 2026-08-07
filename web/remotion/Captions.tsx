import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import type { Scene } from "../../scripts/demo-script";

/**
 * Professional lower-third captions (burn-in).
 *
 * One short phrase at a time (not word-by-word karaoke — that reads as
 * TikTok/Shorts, not a product demo). Each subtitle appears as a discreet
 * pill at the bottom, fades/slides in subtly, and holds long enough to read
 * twice. An optional accent word (brand green) guides the eye without the
 * karaoke pop effect.
 */

const ACCENT = "#0f6b4f";
const FADE_IN_FRAMES = 12;
const FADE_OUT_FRAMES = 12;

/** Words worth highlighting in the brand accent (lowercased match). */
const ACCENT_WORDS = new Set([
  "authorised",
  "not authorised",
  "allowed",
  "not_allowed",
  "review",
  "needs review",
  "2,337",
  "real data",
  "human-in-the-loop",
  "not a mock",
]);

function accentify(line: string): React.ReactNode[] {
  // highlight any word that is part of an accent phrase; fall back to first
  // match within the line
  const lower = line.toLowerCase();
  const matched = Array.from(ACCENT_WORDS).find((w) => lower.includes(w));
  if (!matched) return [line];
  const idx = lower.indexOf(matched);
  const start = line.slice(0, idx);
  const mid = line.slice(idx, idx + matched.length);
  const end = line.slice(idx + matched.length);
  return [
    start,
    <span key="accent" style={{ color: ACCENT, fontWeight: 700 }}>
      {mid}
    </span>,
    end,
  ];
}

/** One lower-third caption pill for a single subtitle line. */
function CaptionLine({ line, appear }: { line: string; appear: number }) {
  return (
    <div
      style={{
        opacity: appear,
        transform: `translateY(${(1 - appear) * 14}px)`,
        fontSize: 38,
        fontWeight: 600,
        color: "#fff",
        backgroundColor: "rgba(24,33,29,0.82)",
        padding: "12px 26px",
        borderRadius: 12,
        maxWidth: 1500,
        textAlign: "center",
        letterSpacing: "-0.2px",
      }}
    >
      {accentify(line)}
    </div>
  );
}

/** Renders the active lower-third caption for the scene. */
export const Captions: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines = scene.subtitles.length ? scene.subtitles : [scene.title];

  // each line holds for a slice of the scene duration (min 2.5s, max ~6s)
  const holdSec = Math.min(6, Math.max(2.5, scene.durationSec / lines.length));
  const holdFrames = holdSec * fps;
  const index = Math.min(lines.length - 1, Math.floor(frame / holdFrames));
  const local = frame % holdFrames;

  const appear = interpolate(
    local,
    [0, FADE_IN_FRAMES, holdFrames - FADE_OUT_FRAMES, holdFrames],
    [0, 1, 1, 0],
    { easing: Easing.out(Easing.quad), extrapolateRight: "clamp" },
  );

  if (appear <= 0.01) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 90, pointerEvents: "none" }}>
      <CaptionLine line={lines[index]} appear={appear} />
    </AbsoluteFill>
  );
};
