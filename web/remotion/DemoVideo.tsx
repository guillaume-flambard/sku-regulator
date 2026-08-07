import React from "react";
import {
  AbsoluteFill,
  Sequence,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

import { SCENES, VIDEO } from "../../scripts/demo-script";
import { SceneOverlay } from "./SceneOverlay";

/**
 * Root composition: plays the 5 recorded scenes back-to-back, each with a
 * title card, animated subtitle captions, a zoom/focus effect, and a fade
 * transition between scenes. Renders the burn-in subtitles.
 */

const ACCENT = "#0f6b4f";
const INK = "#18211d";

function Fade({ children }: { children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const { fps } = VIDEO;
  const dur = fps * 0.5; // 0.5s fade
  const opacity = Math.min(frame / dur, 1);
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

export const DemoVideo: React.FC = () => {
  // cumulative start frame per scene (immutable)
  const segments = SCENES.reduce(
    (acc, scene) => {
      const start = acc.length === 0 ? 0 : acc[acc.length - 1].start + acc[acc.length - 1].frames;
      acc.push({ scene, start, frames: scene.durationSec * VIDEO.fps });
      return acc;
    },
    [] as { scene: (typeof SCENES)[number]; start: number; frames: number }[],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#f7f8f6", fontFamily: "Inter, sans-serif" }}>
      {segments.map(({ scene, start: segStart, frames }, i) => {
        const file = staticFile(`raw/scene-${scene.id}.webm`);
        return (
          <Sequence key={scene.id} from={segStart} durationInFrames={frames}>
            <Fade>
              <SceneVideo scene={scene} file={file} />
              <SceneOverlay scene={scene} index={i} />
            </Fade>
          </Sequence>
        );
      })}

      {/* end card */}
      <Sequence from={segments[segments.length - 1].start + segments[segments.length - 1].frames} durationInFrames={VIDEO.fps * 2.5}>
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
};

/** The recorded footage, with a slow zoom toward the scene's focus point. */
const SceneVideo: React.FC<{ scene: (typeof SCENES)[number]; file: string }> = ({ scene, file }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const focus = scene.focus ?? { x: 0.5, y: 0.5, scale: 1.06 };
  // slow push-in across the scene (Ken Burns) so the last frozen frames stay alive
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

const EndCard: React.FC = () => (
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
    <div style={{ fontSize: 44, fontWeight: 700, marginBottom: 20 }}>
      sku-regulator
    </div>
    <div style={{ fontSize: 24, opacity: 0.9, marginBottom: 40, maxWidth: 800 }}>
      From a stubborn EU portal to compliant, multi-country product data.
    </div>
    <div style={{ fontSize: 16, opacity: 0.7 }}>
      github.com/guillaume-flambard/sku-regulator
    </div>
    <div style={{ fontSize: 12, opacity: 0.5, marginTop: 40, maxWidth: 900 }}>
      Music: &quot;Airplane Mode&quot; by Josh Woodward (joshwoodward.com), CC BY 4.0.
    </div>
  </AbsoluteFill>
);

// re-export for the Remotion CLI entrypoint
export const accent = ACCENT;
export { staticFile };
