import type { LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, FPS, MONO } from "./theme";
import type { SceneTiming } from "./timeline";

/** 0 → 1 spring that starts at `delay` frames. */
export function usePop(delay = 0, config: Partial<{ damping: number; stiffness: number; mass: number }> = {}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 120, mass: 0.8, ...config } });
}

// ------------------------------------------------------------------------------------------
// Brand

export function LogoMark({ size = 120, inverted = false }: { size?: number; inverted?: boolean }) {
  const bg = inverted ? C.white : C.red;
  const fg = inverted ? C.red : C.white;
  return (
    <svg viewBox="0 0 32 32" width={size} height={size}>
      <rect width="32" height="32" rx="9" fill={bg} />
      <path d="M16 6.5c-4.7 0-8.5 3.5-8.5 7.9 0 3.6 2.5 6.6 6 7.6L16 25.5l2.5-3.5c3.5-1 6-4 6-7.6 0-4.4-3.8-7.9-8.5-7.9Z" fill={fg} />
      <circle cx="16" cy="14.4" r="3.2" fill="none" stroke={bg} strokeWidth="2.4" />
    </svg>
  );
}

// ------------------------------------------------------------------------------------------
// People (flat vector, in the brand palette)

export type Pose = "walk" | "stand" | "point" | "think" | "wave" | "phone";

export function Person({
  x,
  y,
  scale = 1,
  pose = "stand",
  shirt = C.red,
  pants = C.denim,
  hair = C.hair,
  skin = C.skin,
  hairStyle = "short",
  suitcase = false,
  flip = false,
  start = 0,
}: {
  x: number;
  y: number;
  scale?: number;
  pose?: Pose;
  shirt?: string;
  pants?: string;
  hair?: string;
  skin?: string;
  hairStyle?: "short" | "long" | "bun";
  suitcase?: boolean;
  flip?: boolean;
  start?: number;
}) {
  const f = useCurrentFrame() - start;
  const walking = pose === "walk";
  const swing = walking ? Math.sin(f / 4.2) * 24 : 0;
  const bob = walking ? Math.abs(Math.sin(f / 4.2)) * -6 : Math.sin(f / 22) * 2;
  const breathe = 1 + Math.sin(f / 18) * 0.008;
  const armR = pose === "point" ? -118 : pose === "wave" ? -150 + Math.sin(f / 4) * 18 : pose === "think" ? -145 : pose === "phone" ? -125 : -swing * 0.8 + 8;
  const armL = suitcase ? 6 : pose === "think" ? 10 : swing * 0.8 - 8;
  const limb = (angle: number, ox: number, oy: number, len: number, w: number, color: string, end?: ReactNode) => (
    <g transform={`rotate(${angle} ${ox} ${oy})`}>
      <rect x={ox - w / 2} y={oy} width={w} height={len} rx={w / 2} fill={color} />
      {end}
    </g>
  );
  return (
    <g transform={`translate(${x} ${y + bob}) scale(${(flip ? -1 : 1) * scale} ${scale})`}>
      {/* shadow */}
      <ellipse cx="0" cy="2" rx="46" ry="8" fill="rgba(42,26,25,0.12)" />
      {/* legs */}
      {limb(swing, -14, -150, 128, 26, pants, <ellipse cx={-14 + 8} cy={-24} rx="20" ry="10" fill={C.ink} />)}
      {limb(-swing, 14, -150, 128, 26, pants, <ellipse cx={14 + 8} cy={-24} rx="20" ry="10" fill={C.ink} />)}
      {/* suitcase on the left hand */}
      {suitcase && (
        <g transform={`translate(-78 -128) rotate(${swing * 0.15})`}>
          <rect x="-6" y="-14" width="34" height="14" rx="6" fill="none" stroke={C.ink} strokeWidth="5" />
          <rect x="-26" y="0" width="74" height="96" rx="12" fill={C.redStrong} />
          <rect x="-26" y="30" width="74" height="8" fill="rgba(255,255,255,0.35)" />
          <circle cx="-12" cy="100" r="6" fill={C.ink} />
          <circle cx="34" cy="100" r="6" fill={C.ink} />
        </g>
      )}
      {/* back arm */}
      {limb(armL, -40, -262, 92, 22, shirt, <circle cx={-40} cy={-262 + 96} r="13" fill={skin} />)}
      {/* torso */}
      <g transform={`scale(${breathe})`}>
        <path d="M-50 -268 Q0 -296 50 -268 L54 -150 Q0 -136 -54 -150 Z" fill={shirt} />
        <path d="M-12 -282 L0 -262 L12 -282 Z" fill={skin} />
      </g>
      {/* phone in hand */}
      {pose === "phone" && (
        <g transform={`rotate(${armR} 40 -262)`}>
          <rect x="22" y="-170" width="30" height="52" rx="6" fill={C.ink} transform="rotate(180 37 -144)" />
        </g>
      )}
      {/* front arm */}
      {limb(armR, 40, -262, 92, 22, shirt, <circle cx={40} cy={-262 + 96} r="13" fill={skin} />)}
      {/* neck + head */}
      <rect x="-10" y="-300" width="20" height="26" rx="8" fill={skin} />
      <circle cx="0" cy="-330" r="38" fill={skin} />
      {/* hair */}
      {hairStyle === "short" && <path d="M-39 -334 Q-40 -378 0 -376 Q40 -378 39 -334 Q30 -356 0 -354 Q-26 -356 -39 -334 Z" fill={hair} />}
      {hairStyle === "long" && <path d="M-42 -326 Q-48 -384 0 -376 Q48 -384 42 -326 L46 -270 Q30 -262 30 -300 Q34 -344 0 -352 Q-34 -344 -30 -300 Q-30 -262 -46 -270 Z" fill={hair} />}
      {hairStyle === "bun" && (
        <>
          <circle cx="0" cy="-382" r="18" fill={hair} />
          <path d="M-39 -330 Q-40 -376 0 -374 Q40 -376 39 -330 Q28 -354 0 -352 Q-28 -354 -39 -330 Z" fill={hair} />
        </>
      )}
      {/* face */}
      <circle cx="-13" cy="-332" r="3.6" fill={C.ink} />
      <circle cx="13" cy="-332" r="3.6" fill={C.ink} />
      <path d={pose === "think" ? "M-9 -310 Q0 -314 9 -310" : "M-11 -314 Q0 -304 11 -314"} stroke={C.ink} strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <circle cx="-24" cy="-318" r="6" fill="rgba(201,15,26,0.18)" />
      <circle cx="24" cy="-318" r="6" fill="rgba(201,15,26,0.18)" />
    </g>
  );
}

// ------------------------------------------------------------------------------------------
// Kraków skyline: St Mary's Basilica, the Cloth Hall, Wawel hill. Simplified silhouettes.

export function Skyline({ color = C.red, back = C.redMid, y = 1080, rise = 1 }: { color?: string; back?: string; y?: number; rise?: number }) {
  const lift = (1 - rise) * 320;
  return (
    <g transform={`translate(0 ${y + lift})`}>
      {/* back layer: roofs */}
      <path
        d="M0 -150 L80 -150 L80 -205 L140 -240 L200 -205 L200 -160 L300 -160 L300 -230 L330 -260 L360 -230 L360 -170 L470 -170 L470 -210 L560 -210 L560 -175 L1380 -175 L1380 -220 L1440 -250 L1500 -220 L1500 -180 L1620 -180 L1620 -235 L1660 -270 L1700 -235 L1700 -170 L1920 -170 L1920 0 L0 0 Z"
        fill={back}
      />
      {/* Wawel hill with castle (left) */}
      <path d="M0 -40 Q220 -170 470 -80 L470 0 L0 0 Z" fill={color} />
      <path d="M90 -120 L90 -230 L110 -250 L130 -230 L130 -150 L190 -150 L190 -200 L250 -232 L310 -200 L310 -110 Z" fill={color} />
      <path d="M200 -232 L250 -300 L300 -232 Z" fill={color} />
      <rect x="236" y="-330" width="28" height="40" rx="4" fill={color} />
      <path d="M232 -330 L250 -362 L268 -330 Z" fill={color} />
      {/* Cloth Hall (Sukiennice) with attic and arcades (centre) */}
      <path d="M640 0 L640 -150 L1180 -150 L1180 0 Z" fill={color} />
      <path
        d="M640 -150 L640 -176 L660 -196 L680 -176 L700 -196 L720 -176 L740 -196 L760 -176 L780 -196 L800 -176 L820 -196 L840 -176 L860 -196 L880 -176 L900 -196 L920 -176 L940 -196 L960 -176 L980 -196 L1000 -176 L1020 -196 L1040 -176 L1060 -196 L1080 -176 L1100 -196 L1120 -176 L1140 -196 L1160 -176 L1180 -196 L1180 -150 Z"
        fill={color}
      />
      {Array.from({ length: 9 }, (_, i) => (
        <path key={i} d={`M${672 + i * 58} 0 L${672 + i * 58} -70 Q${694 + i * 58} -100 ${716 + i * 58} -70 L${716 + i * 58} 0 Z`} fill="rgba(255,255,255,0.22)" />
      ))}
      {/* St Mary's Basilica: two towers, the taller with the spire (right) */}
      <path d="M1250 0 L1250 -260 L1460 -260 L1460 0 Z" fill={color} />
      <path d="M1240 -260 L1355 -330 L1470 -260 Z" fill={color} />
      <rect x="1262" y="-420" width="58" height="200" fill={color} />
      <path d="M1256 -420 L1291 -468 L1326 -420 Z" fill={color} />
      <rect x="1390" y="-500" width="66" height="260" fill={color} />
      <path d="M1384 -500 L1423 -540 L1462 -500 Z" fill={color} />
      <path d="M1405 -540 L1423 -640 L1441 -540 Z" fill={color} />
      <circle cx="1423" cy="-648" r="7" fill={color} />
      <rect x="1404" y="-470" width="14" height="30" rx="7" fill="rgba(255,255,255,0.28)" />
      <rect x="1428" y="-470" width="14" height="30" rx="7" fill="rgba(255,255,255,0.28)" />
      <rect x="1279" y="-390" width="24" height="34" rx="12" fill="rgba(255,255,255,0.28)" />
      {/* houses + trees (right edge) */}
      <path d="M1520 0 L1520 -140 L1580 -190 L1640 -140 L1640 0 Z M1660 0 L1660 -120 L1740 -120 L1740 0 Z" fill={color} />
      <circle cx="1820" cy="-90" r="60" fill={color} />
      <rect x="1812" y="-40" width="16" height="40" fill={color} />
      <circle cx="560" cy="-70" r="48" fill={color} />
    </g>
  );
}

// ------------------------------------------------------------------------------------------
// Bits of UI

export function Pill({
  icon: Icon,
  text,
  progress,
  style,
  tone = "light",
  size = 34,
}: {
  icon?: LucideIcon;
  text: string;
  progress: number;
  style?: CSSProperties;
  tone?: "light" | "red" | "dark";
  size?: number;
}) {
  const colors = tone === "red" ? { bg: C.red, fg: C.white, chip: "rgba(255,255,255,0.18)" } : tone === "dark" ? { bg: C.ink, fg: C.white, chip: "rgba(255,255,255,0.14)" } : { bg: C.white, fg: C.ink, chip: C.redSoft };
  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        alignItems: "center",
        gap: size * 0.45,
        padding: `${size * 0.42}px ${size * 0.8}px ${size * 0.42}px ${size * 0.42}px`,
        borderRadius: 999,
        background: colors.bg,
        color: colors.fg,
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: size,
        boxShadow: "0 18px 40px -18px rgba(80,10,10,0.45)",
        transform: `scale(${progress}) translateY(${(1 - progress) * 30}px)`,
        opacity: Math.min(1, progress * 1.5),
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {Icon && (
        <span style={{ display: "grid", placeItems: "center", width: size * 1.6, height: size * 1.6, borderRadius: 999, background: colors.chip, color: tone === "light" ? C.red : C.white }}>
          <Icon size={size * 0.95} strokeWidth={2.4} />
        </span>
      )}
      {text}
    </div>
  );
}

export function Counter({ to, start, duration = 24, prefix = "", suffix = "" }: { to: number; start: number; duration?: number; prefix?: string; suffix?: string }) {
  const frame = useCurrentFrame();
  const v = Math.round(interpolate(frame, [start, start + duration], [0, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (t) => 1 - (1 - t) ** 3 }));
  return (
    <span>
      {prefix}
      {v.toLocaleString("pl-PL")}
      {suffix}
    </span>
  );
}

export function BrowserCard({ title, x, y, w = 360, h = 230, rotate = 0, progress = 1, children }: { title: string; x: number; y: number; w?: number; h?: number; rotate?: number; progress?: number; children?: ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 18,
        background: C.white,
        boxShadow: "0 24px 50px -20px rgba(80,10,10,0.4)",
        transform: `rotate(${rotate}deg) scale(${progress})`,
        opacity: Math.min(1, progress * 1.4),
        overflow: "hidden",
        fontFamily: FONT,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: C.redSoft }}>
        {[C.red, "#e8a19b", "#f0d0cc"].map((c) => (
          <span key={c} style={{ width: 12, height: 12, borderRadius: 99, background: c }} />
        ))}
        <span style={{ marginLeft: 10, fontFamily: MONO, fontSize: 18, color: C.redStrong, fontWeight: 600 }}>{title}</span>
      </div>
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
        {children ?? [0.9, 0.7, 0.8, 0.5].map((wPct, i) => <span key={i} style={{ height: 14, width: `${wPct * 100}%`, borderRadius: 7, background: i === 0 ? C.redMid : "#efe6e4" }} />)}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------
// Devices

export function Laptop({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const screenW = width;
  const screenH = width / 1.6;
  const bezel = width * 0.022;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: screenW + bezel * 2 }}>
      <div style={{ background: "#231615", borderRadius: bezel * 1.4, padding: bezel, boxShadow: "0 40px 80px -30px rgba(60,10,10,0.55)" }}>
        <div style={{ width: screenW, height: screenH, borderRadius: bezel * 0.5, overflow: "hidden", background: C.cream, position: "relative" }}>{children}</div>
      </div>
      <div style={{ height: bezel * 1.4, margin: `0 ${-bezel * 3}px`, background: "linear-gradient(#d9cfcd, #b9adab)", borderRadius: `0 0 ${bezel * 2}px ${bezel * 2}px` }} />
    </div>
  );
}

export function Phone({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const bezel = width * 0.045;
  const screenH = (width * 1688) / 780;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        padding: bezel,
        background: "#231615",
        borderRadius: width * 0.16,
        boxShadow: "0 40px 80px -30px rgba(60,10,10,0.55)",
      }}
    >
      <div style={{ width, height: screenH, borderRadius: width * 0.12, overflow: "hidden", position: "relative", background: C.cream }}>{children}</div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------
// Background: cream with slowly drifting soft red shapes

export function Backdrop({ tone = "cream" }: { tone?: "cream" | "red" }) {
  const f = useCurrentFrame();
  const base = tone === "red" ? C.red : C.cream;
  const blob = tone === "red" ? "rgba(255,255,255,0.08)" : "rgba(201,15,26,0.06)";
  return (
    <div style={{ position: "absolute", inset: 0, background: base, overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 900, height: 900, borderRadius: 999, background: blob, left: -260 + Math.sin(f / 90) * 40, top: -380 + Math.cos(f / 80) * 30 }} />
      <div style={{ position: "absolute", width: 700, height: 700, borderRadius: 999, background: blob, right: -200 + Math.cos(f / 70) * 40, bottom: -320 + Math.sin(f / 100) * 30 }} />
    </div>
  );
}

// ------------------------------------------------------------------------------------------
// Subtitles in sync with the voice (word timings from ElevenLabs)

/** Words grouped into short lines: break after punctuation or when a line gets long. */
function lines(words: SceneTiming["words"]) {
  const out: SceneTiming["words"][] = [];
  let cur: SceneTiming["words"] = [];
  for (const w of words) {
    cur.push(w);
    const len = cur.map((x) => x.text).join(" ").length;
    if (/[.?!:–]$/.test(w.text) || (/[,]$/.test(w.text) && len > 26) || len > 46) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

export function Subtitles({ scene, tone = "dark" }: { scene: SceneTiming; tone?: "dark" | "light" }) {
  const frame = useCurrentFrame();
  const t = (frame - scene.lead) / FPS;
  const ls = lines(scene.words);
  const line = ls.find((l, i) => t >= l[0].start - 0.05 && (t < (ls[i + 1]?.[0].start ?? Infinity) - 0.05)) ?? (t < 0 ? null : null);
  if (!line || t > line[line.length - 1].end + 0.6) return null;
  const appear = interpolate(t, [line[0].start - 0.05, line[0].start + 0.12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 54, display: "flex", justifyContent: "center", opacity: appear }}>
      <div
        style={{
          maxWidth: 1400,
          padding: "14px 30px",
          borderRadius: 18,
          background: tone === "dark" ? "rgba(42,26,25,0.82)" : "rgba(255,255,255,0.94)",
          color: tone === "dark" ? C.white : C.ink,
          fontFamily: FONT,
          fontWeight: 600,
          fontSize: 42,
          lineHeight: 1.25,
          textAlign: "center",
        }}
      >
        {line.map((w, i) => (
          <span key={i} style={{ opacity: t >= w.start ? 1 : 0.55 }}>
            {w.text}
            {i < line.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
