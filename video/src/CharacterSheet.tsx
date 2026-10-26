import { AbsoluteFill } from "remotion";
import { Character, LOOKS, type Pose } from "./characters";
import { C } from "./theme";

/** Model sheet to review the characters (studio only). */
export function CharacterSheet() {
  const poses: Pose[] = ["stand", "walk", "point", "present", "wave", "think", "phone", "cheer"];
  const looks = Object.entries(LOOKS);
  return (
    <AbsoluteFill style={{ background: C.cream }}>
      <svg viewBox="0 0 1920 1080" style={{ width: "100%", height: "100%" }}>
        {looks.map(([name, look], r) =>
          poses.slice(0, 8).map((p, c) => (
            <Character key={`${name}-${p}`} x={140 + c * 230} y={220 + r * 210} scale={0.52} pose={p} look={look} suitcase={name === "newcomer" && p === "walk"} phone={p === "phone"} />
          )),
        )}
      </svg>
    </AbsoluteFill>
  );
}
