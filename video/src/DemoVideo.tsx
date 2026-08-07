import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { wipe } from "@remotion/transitions/wipe";
import { iris } from "@remotion/transitions/iris";
import { fade } from "@remotion/transitions/fade";
import type { TransitionPresentation } from "@remotion/transitions";

import { SCENES, VIDEO } from "../scripts/demo-script";
import { SceneOverlay } from "./SceneOverlay";
import type { DemoVideoProps } from "./schema";

/**
 * Root composition: the 5 recorded scenes back-to-back with professional
 * transitions (wipe / iris / fade via @remotion/transitions), each scene with
 * title card, word-level karaoke captions and a subtle Ken-Burns zoom.
 */

const INK = "#18211d";
const TRANSITION_FRAMES = Math.round(VIDEO.fps * 0.6); // 0.6s

/** Iris on the transition into the compliance/policy scenes, wipe elsewhere. */
function sceneTransition(index: number) {
  if (index === 2) return iris({ width: VIDEO.width, height: VIDEO.height });
  return wipe({ direction: "from-left" });
}

/** Slow push-in toward the scene's focus point (Ken Burns, subtle). */
const SceneVideo: React.FC<{ scene: (typeof SCENES)[number]; file: string }> = ({ scene, file }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const focus = scene.focus ?? { x: 0.5, y: 0.5, scale: 1.06 };
  const zoom = interpolate(frame, [0, scene.durationSec * fps], [1, focus.scale], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: `scale(${zoom})`,
          transformOrigin: `${focus.x * 100}% ${focus.y * 100}%`,
        }}
      >
        <OffthreadVideo src={file} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </div>
    </AbsoluteFill>
  );
};

const SceneClip: React.FC<{ scene: (typeof SCENES)[number]; index: number }> = ({ scene, index }) => {
  const file = staticFile(`raw/scene-${scene.id}.webm`);
  return (
    <AbsoluteFill style={{ backgroundColor: "#f7f8f6" }}>
      <SceneVideo scene={scene} file={file} />
      <SceneOverlay scene={scene} index={index} />
    </AbsoluteFill>
  );
};

export const DemoVideo: React.FC<DemoVideoProps> = ({ endCard }) => {
  // end card duration (2.5s)
  const END_FRAMES = Math.round(VIDEO.fps * 2.5);

  return (
    <AbsoluteFill style={{ backgroundColor: "#f7f8f6", fontFamily: "Inter, sans-serif" }}>
      <TransitionSeries>
        {SCENES.map((scene, i) => {
          const isLast = i === SCENES.length - 1;
          return (
            <React.Fragment key={scene.id}>
              <TransitionSeries.Sequence durationInFrames={Math.round(scene.durationSec * VIDEO.fps)}>
                <SceneClip scene={scene} index={i} />
              </TransitionSeries.Sequence>
              {!isLast && (
                <TransitionSeries.Transition
                  presentation={sceneTransition(i) as TransitionPresentation<Record<string, unknown>>}
                  timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANSITION_FRAMES })}
                />
              )}
            </React.Fragment>
          );
        })}

        {/* fade into the end card */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />
        <TransitionSeries.Sequence durationInFrames={END_FRAMES}>
          <EndCard endCard={endCard} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

const EndCard: React.FC<{ endCard: DemoVideoProps["endCard"] }> = ({ endCard }) => (
  <AbsoluteFill
    style={{
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: INK,
      color: "#fff",
      textAlign: "center",
      padding: 60,
    }}
  >
    <div style={{ fontSize: 44, fontWeight: 700, marginBottom: 20 }}>{endCard.title}</div>
    <div style={{ fontSize: 24, opacity: 0.9, marginBottom: 40, maxWidth: 800 }}>
      {endCard.tagline}
    </div>
    <div style={{ fontSize: 16, opacity: 0.7 }}>github.com/guillaume-flambard/sku-regulator</div>
    <div style={{ fontSize: 12, opacity: 0.5, marginTop: 40, maxWidth: 900 }}>{endCard.credit}</div>
  </AbsoluteFill>
);

export { staticFile };
