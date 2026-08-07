import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { createTikTokStyleCaptions, type Caption, type TikTokPage } from "@remotion/captions";
import { Easing } from "remotion";
import type { Scene } from "../../scripts/demo-script";

/**
 * Word-level karaoke captions (burn-in).
 *
 * There is no voiceover, so timings are synthesized from the scene duration:
 * each subtitle line is split into words and spread evenly across the caption
 * window. `combineTokensWithinMilliseconds` controls how many words appear per
 * page (500ms reads fast for a product demo).
 */

const ACCENT = "#0f6b4f";
const COMBINE_MS = 500;

/** Split one subtitle line into word-level Captions with synthetic timing. */
function lineToCaptions(line: string, startMs: number, durationMs: number): Caption[] {
  const words = line.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const per = durationMs / words.length;
  return words.map((word, i) => ({
    text: word,
    startMs: startMs + i * per,
    endMs: startMs + (i + 1) * per,
    timestampMs: startMs + i * per,
    confidence: 1,
  }));
}

/** Build all caption pages for a scene, timed across its full duration. */
export function sceneCaptions(scene: Scene): TikTokPage[] {
  const lines = scene.subtitles.length ? scene.subtitles : [scene.title];
  const totalMs = scene.durationSec * 1000;
  const chunk = Math.max(1000, Math.floor(totalMs / Math.max(1, lines.length)));
  const captions: Caption[] = [];
  lines.forEach((line, i) => {
    const start = (i * totalMs) / Math.max(1, lines.length);
    captions.push(...lineToCaptions(line, start, chunk));
  });
  return createTikTokStyleCaptions({
    captions,
    combineTokensWithinMilliseconds: COMBINE_MS,
  }).pages;
}

function CaptionPage({ page }: { page: TikTokPage }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = (frame / fps) * 1000;
  const absMs = page.startMs + nowMs;

  return (
    <div
      style={{
        fontSize: 40,
        fontWeight: 600,
        color: "#fff",
        backgroundColor: "rgba(24,33,29,0.82)",
        padding: "14px 28px",
        borderRadius: 12,
        maxWidth: 1500,
        textAlign: "center",
      }}
    >
      {page.tokens.map((token, i) => {
        const active = absMs >= token.fromMs && absMs < token.toMs;
        const appear = interpolate(
          frame,
          [0, Math.max(1, (token.fromMs / 1000) * fps)],
          [0.55, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) },
        );
        return (
          <span
            key={`${token.text}-${i}`}
            style={{
              opacity: appear,
              color: active ? ACCENT : "#fff",
              fontWeight: active ? 700 : 600,
              transform: active ? "scale(1.06)" : "scale(1)",
              display: "inline-block",
              marginRight: "0.35em",
            }}
          >
            {token.text}
          </span>
        );
      })}
    </div>
  );
}

/** Renders the active caption page (burn-in) at the bottom of the scene. */
export const Captions: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pages = sceneCaptions(scene);
  const nowMs = (frame / fps) * 1000;
  const page = pages.find((p) => nowMs >= p.startMs && nowMs < p.startMs + p.durationMs);

  if (!page) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 90, pointerEvents: "none" }}>
      <CaptionPage page={page} />
    </AbsoluteFill>
  );
};
