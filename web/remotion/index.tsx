import React from "react";
import { Composition, registerRoot } from "remotion";

import { DemoVideo } from "./DemoVideo";
import { SCENES, VIDEO } from "../../scripts/demo-script";

const totalFrames = SCENES.reduce((acc, s) => acc + s.durationSec, 0) * VIDEO.fps + VIDEO.fps * 2.5;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DemoVideo"
      component={DemoVideo}
      durationInFrames={Math.round(totalFrames)}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
    />
  );
};

registerRoot(RemotionRoot);
