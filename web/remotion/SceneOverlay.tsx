import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Scene } from "../../scripts/demo-script";

/**
 * Overlay rendered on top of each recorded scene:
 *  - a title card (short lead-in) with the scene title,
 *  - animated subtitle captions at the bottom (burn-in),
 *  - an optional slow zoom-in toward a focus point.
 */

const ACCENT = "#0f6b4f";
const INK = "#18211d";

const TITLE_LEAD_IN_FRAMES = 60; // 2s at 30fps

export const SceneOverlay: React.FC<{ scene: Scene; index: number }> = ({ scene, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // caption cycle: each subtitle shows for a slice of the scene duration
  const captions = scene.subtitles.length ? scene.subtitles : [scene.title];
  const captionDuration = Math.max(2, Math.floor(scene.durationSec / captions.length)) * fps;
  const captionIndex = Math.min(
    captions.length - 1,
    Math.floor((frame - TITLE_LEAD_IN_FRAMES) / captionDuration),
  );
  const showCaption = frame >= TITLE_LEAD_IN_FRAMES;

  // fade in/out for each caption
  const local = (frame - TITLE_LEAD_IN_FRAMES) % captionDuration;
  const captionOpacity = showCaption ? interpolate(local, [0, 12, captionDuration - 12, captionDuration], [0, 1, 1, 0]) : 0;

  // title card fades out as the caption comes in
  const titleOpacity = interpolate(frame, [0, TITLE_LEAD_IN_FRAMES * 0.6, TITLE_LEAD_IN_FRAMES], [1, 1, 0]);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* title card */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-start",
          alignItems: "center",
          paddingTop: 140,
          opacity: titleOpacity,
        }}
      >
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

      {/* bottom subtitle captions (burn-in) */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 90,
        }}
      >
        {showCaption && (
          <div style={{ opacity: captionOpacity }}>
            <div
              style={{
                fontSize: 34,
                fontWeight: 600,
                color: "#fff",
                backgroundColor: "rgba(24,33,29,0.82)",
                padding: "14px 28px",
                borderRadius: 12,
                maxWidth: 1500,
                textAlign: "center",
              }}
            >
              {captions[captionIndex]}
            </div>
          </div>
        )}
      </AbsoluteFill>

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
