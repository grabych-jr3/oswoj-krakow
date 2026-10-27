import { Composition } from "remotion";
import { CharacterSheet } from "./CharacterSheet";
import { Main } from "./Main";
import { FPS, HEIGHT, WIDTH } from "./theme";
import { TOTAL_FRAMES } from "./timeline";

export function Root() {
  return (
    <>
      <Composition id="Main" component={Main} durationInFrames={TOTAL_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
      <Composition id="Characters" component={CharacterSheet} durationInFrames={120} fps={FPS} width={WIDTH} height={HEIGHT} />
    </>
  );
}
