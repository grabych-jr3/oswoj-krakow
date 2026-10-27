import { useCurrentFrame } from "remotion";
import { C } from "./theme";

/**
 * Hand-drawn flat characters for the video. Limbs are two segments (shoulder → elbow → hand,
 * hip → knee → foot), so poses read naturally; both arms always sit outside the torso, so no
 * arm ever disappears behind it. Feet stand at y = 0; the figure is ~350 units tall.
 */
export type Pose = "stand" | "walk" | "point" | "wave" | "think" | "phone" | "present" | "cheer";

type Look = {
  skin: string;
  hair: string;
  hairStyle: "short" | "long" | "bun" | "curly" | "bald";
  top: string;
  topDark: string;
  bottom: string;
  shoes: string;
  glasses?: boolean;
  beard?: boolean;
  skirt?: boolean;
};

export const LOOKS = {
  newcomer: { skin: "#f1c3a1", hair: "#3a2522", hairStyle: "short", top: C.red, topDark: "#a50c15", bottom: "#33415f", shoes: "#2a1a19" },
  mum: { skin: "#e9b48d", hair: "#5a3324", hairStyle: "long", top: "#ffffff", topDark: "#e9dcd9", bottom: "#8d1019", shoes: "#2a1a19", skirt: true },
  student: { skin: "#a8724d", hair: "#1f1412", hairStyle: "curly", top: "#2b2f3a", topDark: "#1d2029", bottom: "#c9b8a6", shoes: "#ffffff", glasses: true },
  clerk: { skin: "#f3cfb3", hair: "#9b9b9b", hairStyle: "short", top: "#3a3f4b", topDark: "#262a33", bottom: "#3a3f4b", shoes: "#1a1a1a", glasses: true, beard: true },
  guide: { skin: "#f1c3a1", hair: "#2a1a19", hairStyle: "bun", top: C.red, topDark: "#a50c15", bottom: "#2a1a19", shoes: "#2a1a19" },
} satisfies Record<string, Look>;

type Angles = { shL: number; elL: number; shR: number; elR: number; hipL: number; kneeL: number; hipR: number; kneeR: number; tilt: number };

function pose(p: Pose, f: number): Angles {
  const s = Math.sin(f / 4.6);
  const idle = Math.sin(f / 24);
  switch (p) {
    case "walk":
      return { shL: -24 * s, elL: -18, shR: 24 * s, elR: -18, hipL: 24 * s, kneeL: s > 0 ? 0 : 26 * -s, hipR: -24 * s, kneeR: s < 0 ? 0 : 26 * s, tilt: 0 };
    case "point":
      return { shL: 10, elL: 6, shR: -96, elR: -6, hipL: 5, kneeL: 0, hipR: -5, kneeR: 0, tilt: 0 };
    case "present":
      return { shL: 12, elL: 8, shR: -58 + idle * 4, elR: -32, hipL: 5, kneeL: 0, hipR: -5, kneeR: 0, tilt: -2 };
    case "wave":
      return { shL: 10, elL: 6, shR: -150, elR: -25 + Math.sin(f / 3.5) * 22, hipL: 5, kneeL: 0, hipR: -5, kneeR: 0, tilt: 2 };
    case "think":
      return { shL: 18, elL: -96, shR: -24, elR: -128, hipL: 4, kneeL: 0, hipR: -4, kneeR: 0, tilt: 5 + idle * 2 };
    case "phone":
      return { shL: 8, elL: 6, shR: -18, elR: -112, hipL: 4, kneeL: 0, hipR: -4, kneeR: 0, tilt: 7 };
    case "cheer":
      return { shL: 150 + idle * 6, elL: 18, shR: -150 - idle * 6, elR: -18, hipL: 6, kneeL: 0, hipR: -6, kneeR: 0, tilt: 0 };
    default:
      return { shL: 8 + idle * 2, elL: 8, shR: -8 - idle * 2, elR: -8, hipL: 4, kneeL: 0, hipR: -4, kneeR: 0, tilt: idle };
  }
}

/** A limb from its joint: upper part, then the lower part bent at the middle joint, then the end. */
function Limb({ x, y, a, b, len1, len2, w, color, lower, end }: { x: number; y: number; a: number; b: number; len1: number; len2: number; w: number; color: string; lower?: string; end: React.ReactNode }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${a})`}>
      <rect x={-w / 2} y={-w / 2} width={w} height={len1 + w / 2} rx={w / 2} fill={color} />
      <g transform={`translate(0 ${len1}) rotate(${b})`}>
        <rect x={-w / 2 + 1} y={-w / 2} width={w - 2} height={len2 + w / 2} rx={(w - 2) / 2} fill={lower ?? color} />
        <g transform={`translate(0 ${len2})`}>{end}</g>
      </g>
    </g>
  );
}

export function Character({
  x,
  y,
  scale = 1,
  pose: p = "stand",
  look = LOOKS.newcomer,
  flip = false,
  suitcase = false,
  phone = false,
  start = 0,
}: {
  x: number;
  y: number;
  scale?: number;
  pose?: Pose;
  look?: Look;
  flip?: boolean;
  suitcase?: boolean;
  phone?: boolean;
  start?: number;
}) {
  const f = useCurrentFrame() - start;
  const a = pose(p, f);
  const walking = p === "walk";
  const bob = walking ? -Math.abs(Math.sin(f / 4.6)) * 7 : Math.sin(f / 24) * 1.5;
  const blink = f % 110 > 104 ? 0.15 : 1;
  const hand = (r = 11) => <circle r={r} fill={look.skin} />;
  const shoe = <path d="M-12 -4 Q-12 -14 0 -14 Q22 -14 26 -2 L26 6 L-12 6 Z" fill={look.shoes} />;

  return (
    <g transform={`translate(${x} ${y}) scale(${(flip ? -1 : 1) * scale} ${scale})`}>
      <ellipse cx="0" cy="4" rx="58" ry="9" fill="rgba(42,26,25,0.13)" />
      <g transform={`translate(0 ${bob})`}>
        {/* legs (back one first) */}
        <Limb x={-14} y={-128} a={a.hipR} b={a.kneeR} len1={62} len2={58} w={26} color={look.bottom} end={shoe} />
        {/* suitcase, held by the back hand */}
        {suitcase && (
          <g transform={`translate(-82 -100) rotate(${walking ? Math.sin(f / 4.6) * 3 : 0})`}>
            <rect x="-4" y="-22" width="36" height="16" rx="7" fill="none" stroke={C.ink} strokeWidth="6" />
            <rect x="-26" y="-8" width="80" height="104" rx="14" fill={C.redStrong} />
            <rect x="-26" y="24" width="80" height="9" fill="rgba(255,255,255,0.3)" />
            <rect x="-6" y="-8" width="9" height="104" fill="rgba(0,0,0,0.12)" />
            <circle cx="-10" cy="102" r="7" fill={C.ink} />
            <circle cx="38" cy="102" r="7" fill={C.ink} />
          </g>
        )}
        {/* back arm: outside the torso, behind it */}
        <Limb x={-46} y={-238} a={suitcase ? 14 : a.shL} b={suitcase ? 2 : a.elL} len1={56} len2={52} w={22} color={look.topDark} lower={look.topDark} end={hand()} />
        <Limb x={14} y={-128} a={a.hipL} b={a.kneeL} len1={62} len2={58} w={26} color={look.bottom} end={shoe} />
        {/* skirt */}
        {look.skirt && <path d="M-44 -150 L44 -150 L60 -80 Q0 -66 -60 -80 Z" fill={look.bottom} />}
        {/* torso */}
        <g transform={`rotate(${a.tilt * 0.3} 0 -128)`}>
          <path d="M-48 -244 Q0 -262 48 -244 L52 -132 Q0 -118 -52 -132 Z" fill={look.top} />
          <path d="M-14 -256 L0 -232 L14 -256" fill="none" stroke={look.topDark} strokeWidth="5" strokeLinejoin="round" />
          <path d="M-52 -150 Q0 -136 52 -150 L52 -132 Q0 -118 -52 -132 Z" fill={look.topDark} opacity={look.skirt ? 0 : 0.8} />
          {/* front arm */}
          <Limb
            x={46}
            y={-238}
            a={a.shR}
            b={a.elR}
            len1={56}
            len2={52}
            w={22}
            color={look.top}
            end={
              <>
                {phone && <rect x="-12" y="-6" width="24" height="40" rx="6" fill={C.ink} transform="rotate(-20)" />}
                {hand()}
              </>
            }
          />
          {/* neck + head */}
          <g transform={`rotate(${a.tilt} 0 -258)`}>
            <rect x="-10" y="-270" width="20" height="22" rx="8" fill={look.skin} />
            <Head look={look} blink={blink} smile={p !== "think"} />
          </g>
        </g>
      </g>
    </g>
  );
}

function Head({ look, blink, smile }: { look: Look; blink: number; smile: boolean }) {
  const cy = -304;
  return (
    <g>
      {/* hair behind the head */}
      {look.hairStyle === "long" && <path d={`M-40 ${cy - 6} Q-46 ${cy - 52} 0 ${cy - 46} Q46 ${cy - 52} 40 ${cy - 6} L44 ${cy + 64} Q30 ${cy + 72} 26 ${cy + 30} L-26 ${cy + 30} Q-30 ${cy + 72} -44 ${cy + 64} Z`} fill={look.hair} />}
      {look.hairStyle === "bun" && <circle cx="0" cy={cy - 48} r="18" fill={look.hair} />}
      <ellipse cx="-36" cy={cy + 4} rx="7" ry="10" fill={look.skin} />
      <ellipse cx="36" cy={cy + 4} rx="7" ry="10" fill={look.skin} />
      <ellipse cx="0" cy={cy} rx="36" ry="40" fill={look.skin} />
      {/* hair on top */}
      {look.hairStyle === "short" && <path d={`M-37 ${cy - 4} Q-40 ${cy - 46} 0 ${cy - 44} Q38 ${cy - 46} 37 ${cy - 6} Q34 ${cy - 26} 12 ${cy - 26} Q-14 ${cy - 22} -37 ${cy - 4} Z`} fill={look.hair} />}
      {(look.hairStyle === "long" || look.hairStyle === "bun") && <path d={`M-37 ${cy - 2} Q-38 ${cy - 44} 0 ${cy - 42} Q38 ${cy - 44} 37 ${cy - 2} Q20 ${cy - 30} -4 ${cy - 26} Q-26 ${cy - 22} -37 ${cy - 2} Z`} fill={look.hair} />}
      {look.hairStyle === "curly" &&
        [-30, -15, 0, 15, 30].map((dx, i) => <circle key={i} cx={dx} cy={cy - 34 + Math.abs(dx) * 0.35} r="15" fill={look.hair} />)}
      {/* face */}
      <path d={`M-20 ${cy - 14} Q-12 ${cy - 19} -5 ${cy - 14}`} stroke={look.hair === "#9b9b9b" ? "#6f6f6f" : look.hair} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d={`M5 ${cy - 14} Q12 ${cy - 19} 20 ${cy - 14}`} stroke={look.hair === "#9b9b9b" ? "#6f6f6f" : look.hair} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <ellipse cx="-12" cy={cy - 3} rx="4" ry={4.6 * blink} fill={C.ink} />
      <ellipse cx="12" cy={cy - 3} rx="4" ry={4.6 * blink} fill={C.ink} />
      {look.glasses && (
        <g fill="none" stroke={C.ink} strokeWidth="2.6">
          <circle cx="-12" cy={cy - 3} r="10" />
          <circle cx="12" cy={cy - 3} r="10" />
          <path d={`M-2 ${cy - 3} L2 ${cy - 3}`} />
        </g>
      )}
      <path d={`M-3 ${cy + 4} Q0 ${cy + 10} 3 ${cy + 4}`} stroke="rgba(120,60,40,0.45)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {look.beard && <path d={`M-26 ${cy + 6} Q-24 ${cy + 40} 0 ${cy + 42} Q24 ${cy + 40} 26 ${cy + 6} Q14 ${cy + 22} 0 ${cy + 22} Q-14 ${cy + 22} -26 ${cy + 6} Z`} fill="#b9b9b9" />}
      <path
        d={smile ? `M-10 ${cy + 16} Q0 ${cy + 25} 10 ${cy + 16}` : `M-8 ${cy + 19} Q0 ${cy + 16} 8 ${cy + 19}`}
        stroke={C.ink}
        strokeWidth="3.4"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="-22" cy={cy + 10} r="6" fill="rgba(201,15,26,0.16)" />
      <circle cx="22" cy={cy + 10} r="6" fill="rgba(201,15,26,0.16)" />
    </g>
  );
}
