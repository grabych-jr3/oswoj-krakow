import { fade } from "@remotion/transitions/fade";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { Fragment } from "react";
import { AbsoluteFill, Audio, interpolate, staticFile } from "remotion";
import { S1Arrival, S2Problem, S3Reveal, S4Assistant, S5Fifteen, S6City, S7Data, S8End } from "./scenes";
import { C } from "./theme";
import { TIMELINE, TOTAL_FRAMES, TRANSITION, type SceneTiming } from "./timeline";

const SCENES: Record<string, (p: { scene: SceneTiming }) => React.ReactNode> = {
  "s1-arrival": S1Arrival,
  "s2-problem": S2Problem,
  "s3-reveal": S3Reveal,
  "s4-assistant": S4Assistant,
  "s5-fifteen": S5Fifteen,
  "s6-city": S6City,
  "s7-data": S7Data,
  "s8-end": S8End,
};

export function Main() {
  return (
    <AbsoluteFill style={{ background: C.cream }}>
      <TransitionSeries>
        {TIMELINE.map((scene, i) => {
          const Scene = SCENES[scene.id];
          return (
            <Fragment key={scene.id}>
              {i > 0 && <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION })} />}
              <TransitionSeries.Sequence durationInFrames={scene.frames}>
                <Scene scene={scene} />
              </TransitionSeries.Sequence>
            </Fragment>
          );
        })}
      </TransitionSeries>
      {/* Quiet music under the voice; fades in and out. */}
      <Audio
        src={staticFile("music/bed.mp3")}
        volume={(f) => interpolate(f, [0, 30, TOTAL_FRAMES - 75, TOTAL_FRAMES - 5], [0, 0.13, 0.13, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      />
    </AbsoluteFill>
  );
}
