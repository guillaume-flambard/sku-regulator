import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import type { Scene } from "../scripts/demo-script";
import { Captions } from "./Captions";

/**
 * Overlay on each recorded scene:
 *  - a title card (short lead-in) with the scene title,
 *  - word-level karaoke captions (burn-in) via Captions,
 *  - a scene index chip (top-right).
 */

const ACCENT = "#0f6b4f";
const INK = "#18211d";

const TITLE_LEAD_IN_FRAMES = 60; // 2s at 30fps

export const SceneOverlay: React.FC<{ scene: Scene; index: number }> = ({ scene, index }) => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, TITLE_LEAD_IN_FRAMES * 0.6, TITLE_LEAD_IN_FRAMES], [1, 1, 0], {
    easing: Easing.out(Easing.quad),
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* title card */}
      <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 140, opacity: titleOpacity }}>
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: "#fff",
            backgroundColor: INK,
            padding: "14px 34px",
            borderRadius: 14,
            letterSpacing: "-0.5px",
          }}
        >
          {scene.title}
        </div>
      </AbsoluteFill>

      {/* word-level karaoke captions (burn-in) */}
      <Captions scene={scene} />

      {/* scene index chip */}
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "flex-end", padding: 40 }}>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 20,
            color: ACCENT,
            backgroundColor: "rgba(255,255,255,0.85)",
            padding: "6px 14px",
            borderRadius: 20,
            border: `1px solid ${ACCENT}40`,
          }}
        >
          {String(index + 1).padStart(2, "0")} / {SCENE_TOTAL}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const SCENE_TOTAL = 5;
