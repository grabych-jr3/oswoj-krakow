import type { LucideIcon } from "lucide-react";
import {
  Baby,
  Blocks,
  BookOpen,
  BusFront,
  Clock,
  FileText,
  Footprints,
  GraduationCap,
  Landmark,
  MapPin,
  School,
  Search,
  Send,
  ToyBrick,
  TreePine,
  Users,
} from "lucide-react";
import { Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { LogoMark } from "./components";
import mock from "./mock.json";
import { C, FONT, MONO } from "./theme";

/**
 * Animated mock-ups of the app, drawn over clean map images captured from the real app
 * (scripts/capture.mjs). Every element moves on its own smooth curve, so the result reads like
 * a polished product animation rather than a screen recording.
 */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const smooth = Easing.bezier(0.33, 1, 0.68, 1);
const inOut = Easing.bezier(0.65, 0, 0.35, 1);

/** 0 → 1 between two frames, eased. */
const ramp = (f: number, a: number, b: number, e = smooth) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: e });

/** A gentle spring without overshoot (for UI elements). */
function useSoft(delay: number, stiffness = 70) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config: { damping: 22, stiffness, mass: 1 } });
}

const CATS: Record<string, { color: string; icon: LucideIcon }> = {
  zlobek: { color: "#ab3276", icon: Baby },
  klub_dzieciecy: { color: "#8a3d9a", icon: ToyBrick },
  przedszkole: { color: "#af4000", icon: Blocks },
  szkola_podstawowa: { color: "#2559b0", icon: School },
  szkola_ponadpodstawowa: { color: "#483a9a", icon: GraduationCap },
  klub_rodzica: { color: "#6b46a0", icon: Users },
  biblioteka: { color: "#006d78", icon: BookOpen },
  park: { color: "#207029", icon: TreePine },
  przystanek: { color: "#414f5d", icon: BusFront },
  urzad: { color: "#c90f1a", icon: Landmark },
};

/** Typewriter: how many characters of `text` are visible at frame f. */
const typed = (text: string, f: number, start: number, cps = 26) => text.slice(0, Math.max(0, Math.floor(((f - start) / 30) * cps)));

// ------------------------------------------------------------------------------------------
// 1. Assistant on a laptop screen (1320 × 825)

const QUESTION = "Gdzie mogę uzyskać PESEL i co muszę zabrać?";

export function AssistantMock({ ask, answer, docs, map }: { ask: number; answer: number; docs: number; map: number }) {
  const f = useCurrentFrame();
  const m = mock.assistant;
  const [W, H] = m.size;
  const chatW = 470;
  const sent = ask + Math.ceil((QUESTION.length / 26) * 30) + 8;
  const thinking = f >= sent + 4 && f < answer;
  const card = useSoft(answer, 60);
  // the camera drifts slowly over the map, and settles on the offices when they appear
  const cam = ramp(f, map - 10, map + 50, inOut);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: C.cream, fontFamily: FONT }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${1.04 - cam * 0.04}) translate(${-8 + cam * 8}px, 0)`, transformOrigin: "30% 50%" }}>
        <Img src={staticFile("mock/map-assistant.png")} style={{ width: W, height: H }} />
        {/* offices drop in one by one, numbered like in the app */}
        <svg viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
          {m.offices.map((o, i) => {
            if (!o.px) return null;
            const t = ramp(f, map + i * 9, map + i * 9 + 18, Easing.out(Easing.back(1.8)));
            const [x, y] = o.px;
            return (
              <g key={o.label} transform={`translate(${x} ${y - (1 - t) * 40}) scale(${t})`} opacity={Math.min(1, t * 2)}>
                <circle r={34 * ramp(f, map + i * 9 + 12, map + i * 9 + 40)} fill="rgba(201,15,26,0.18)" />
                <circle r="20" fill={C.red} stroke="#fff" strokeWidth="5" />
                <text y="7" textAnchor="middle" fill="#fff" fontFamily={FONT} fontWeight={800} fontSize="20">
                  {o.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {/* app top bar */}
      <div style={{ position: "absolute", left: 18, top: 16, display: "flex", alignItems: "center", gap: 10, padding: "9px 16px 9px 10px", borderRadius: 16, background: "#fff", boxShadow: "0 10px 30px -14px rgba(80,10,10,.4)" }}>
        <LogoMark size={34} />
        <span style={{ fontWeight: 800, fontSize: 19, color: C.ink }}>Oswój Kraków</span>
      </div>
      {/* chat column */}
      <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: chatW, background: C.red, display: "flex", flexDirection: "column", color: "#fff" }}>
        <div style={{ padding: "22px 24px 10px" }}>
          <div style={{ fontWeight: 800, fontSize: 26 }}>Asystent</div>
          <div style={{ fontSize: 14, opacity: 0.85 }}>Odpowiedzi z kart usług BIP Kraków</div>
        </div>
        <div style={{ flex: 1, padding: "8px 20px", display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
          {f >= sent && (
            <div style={{ alignSelf: "flex-end", maxWidth: 360, padding: "12px 16px", borderRadius: "18px 18px 4px 18px", background: C.redStrong, fontSize: 16, lineHeight: 1.35, opacity: ramp(f, sent, sent + 8), transform: `translateY(${(1 - ramp(f, sent, sent + 10)) * 12}px)` }}>
              {QUESTION}
            </div>
          )}
          {thinking && (
            <div style={{ alignSelf: "flex-start", display: "flex", gap: 6, padding: "14px 16px", borderRadius: 16, background: "#fff" }}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{ width: 9, height: 9, borderRadius: 9, background: C.red, opacity: 0.35 + 0.65 * Math.abs(Math.sin((f - i * 5) / 7)) }} />
              ))}
            </div>
          )}
          {f >= answer && (
            <div style={{ alignSelf: "stretch", borderRadius: 18, background: "#fff", color: C.ink, padding: 16, opacity: card, transform: `translateY(${(1 - card) * 24}px)`, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 13, color: C.red, fontWeight: 600 }}>
                <FileText size={15} /> {m.symbol} · URZĄD MIASTA KRAKOWA
              </div>
              <div style={{ fontWeight: 800, fontSize: 19, lineHeight: 1.2 }}>{m.title}</div>
              <Row show={ramp(f, answer + 10, answer + 22)} icon={Clock} label="Termin" text="do 30 dni od złożenia wniosku" tint />
              <div style={{ opacity: ramp(f, docs, docs + 10), fontWeight: 700, fontSize: 15 }}>Dokumenty</div>
              {m.docs.map((d, i) => (
                <div key={d} style={{ display: "flex", gap: 8, fontSize: 14.5, lineHeight: 1.3, opacity: ramp(f, docs + 6 + i * 10, docs + 16 + i * 10), transform: `translateX(${(1 - ramp(f, docs + 6 + i * 10, docs + 18 + i * 10)) * 14}px)` }}>
                  <span style={{ color: C.red, fontWeight: 700 }}>{i + 1}.</span> {d}
                </div>
              ))}
              <Row show={ramp(f, docs + 34, docs + 46)} label="Opłata" text={m.fee} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6, opacity: ramp(f, map, map + 14), maxHeight: 150 * ramp(f, map - 6, map + 16, inOut), overflow: "hidden" }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Gdzie załatwić</div>
                {m.offices.map((o, i) => (
                  <div key={o.label} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, opacity: ramp(f, map + i * 9, map + i * 9 + 12) }}>
                    <span style={{ display: "grid", placeItems: "center", width: 22, height: 22, borderRadius: 22, background: C.red, color: "#fff", fontWeight: 800, fontSize: 12 }}>{o.label}</span>
                    {o.address}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* input: the question is typed here, then sent */}
        <div style={{ margin: "12px 18px 20px", display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 16, padding: "8px 8px 8px 16px", color: C.ink }}>
          <span style={{ flex: 1, fontSize: 15.5, color: f < sent && f >= ask ? C.ink : C.muted, whiteSpace: "nowrap", overflow: "hidden" }}>
            {f >= ask && f < sent ? typed(QUESTION, f, ask) : "Napisz pytanie…"}
            {f >= ask && f < sent && <span style={{ opacity: f % 16 < 8 ? 1 : 0 }}>|</span>}
          </span>
          <span style={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: 12, background: C.red, color: "#fff", transform: `scale(${f >= sent - 4 && f < sent + 4 ? 0.88 : 1})` }}>
            <Send size={18} />
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({ show, icon: Icon, label, text, tint }: { show: number; icon?: LucideIcon; label: string; text: string; tint?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: tint ? "8px 10px" : 0, borderRadius: 10, background: tint ? C.redSoft : "none", fontSize: 14.5, lineHeight: 1.3, opacity: show, transform: `translateY(${(1 - show) * 8}px)` }}>
      {Icon && <Icon size={16} color={C.red} style={{ marginTop: 2, flexShrink: 0 }} />}
      <span>
        <b>{label}:</b> {text}
      </span>
    </div>
  );
}

// ------------------------------------------------------------------------------------------
// 2. "Kraków w 15 minut" on a phone screen (390 × 844)

const ADDRESS = "Wielicka 28";

export function FifteenMock({ type, zone, transit }: { type: number; zone: number; transit: number }) {
  const f = useCurrentFrame();
  const m = mock.fifteen;
  const [W, H] = m.size;
  const typedEnd = type + Math.ceil((ADDRESS.length / 12) * 30);
  const pick = typedEnd + 14;
  const showList = f >= typedEnd - 6 && f < pick;
  const draw = ramp(f, zone, zone + 40, inOut);
  const toTransit = ramp(f, transit, transit + 30, inOut);
  const sheet = useSoft(zone + 20, 55);
  const zoom = 1 + ramp(f, pick, zone + 30, inOut) * 0.06;
  const pin = ramp(f, pick, pick + 16, Easing.out(Easing.back(2)));
  const score = Math.round(m.walk.score * ramp(f, zone + 26, zone + 60));
  const placesOf = (set: typeof m.walk.places, start: number) =>
    set.map((p, i) => {
      const c = CATS[p.category] ?? { color: C.red, icon: MapPin };
      const t = ramp(f, start + i * 1.6, start + i * 1.6 + 14, Easing.out(Easing.back(2.2)));
      const Icon = c.icon;
      return (
        <g key={`${p.category}-${i}`} transform={`translate(${p.px[0]} ${p.px[1]}) scale(${t})`} opacity={Math.min(1, t * 2)}>
          <circle r="14" fill={c.color} stroke="#fff" strokeWidth="3" />
          <foreignObject x="-8" y="-8" width="16" height="16">
            <Icon size={16} color="#fff" strokeWidth={2.4} />
          </foreignObject>
        </g>
      );
    });
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: C.cream, fontFamily: FONT }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom})`, transformOrigin: `${(m.origin[0] / W) * 100}% ${(m.origin[1] / H) * 100}%` }}>
        <Img src={staticFile("mock/map-phone.png")} style={{ width: W, height: H }} />
        <svg viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
          {/* walking zone draws itself, then the transit zone grows out of it */}
          <path d={m.walk.path} fill={`rgba(201,15,26,${0.13 * draw * (1 - toTransit)})`} stroke={C.red} strokeWidth="2.6" strokeDasharray="7 5" pathLength={1000} strokeDashoffset={0} style={{ clipPath: `inset(0 ${(1 - draw) * 100}% 0 0)` }} opacity={1 - toTransit} />
          <path d={m.transit.path} fill={`rgba(201,15,26,${0.13 * toTransit})`} stroke={C.red} strokeWidth="2.6" strokeDasharray="7 5" opacity={toTransit} transform={`translate(${m.origin[0]} ${m.origin[1]}) scale(${0.85 + 0.15 * toTransit}) translate(${-m.origin[0]} ${-m.origin[1]})`} />
          <g opacity={1 - toTransit}>{placesOf(m.walk.places, zone + 18)}</g>
          <g opacity={toTransit}>{placesOf(m.transit.places, transit + 6)}</g>
          {/* the address */}
          <g transform={`translate(${m.origin[0]} ${m.origin[1] - (1 - pin) * 50}) scale(${pin})`}>
            <circle r={26 * ramp(f, pick + 10, pick + 40)} fill="rgba(201,15,26,0.2)" />
            <circle r="11" fill={C.red} stroke="#fff" strokeWidth="4" />
          </g>
        </svg>
      </div>
      {/* address field with typing and one suggestion */}
      <div style={{ position: "absolute", left: 12, right: 12, top: 16, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, height: 46, borderRadius: 14, background: "#fff", padding: "0 6px 0 14px", boxShadow: "0 10px 30px -14px rgba(80,10,10,.4)" }}>
          <span style={{ width: 10, height: 10, borderRadius: 10, border: `2.5px solid ${C.red}` }} />
          <span style={{ flex: 1, fontSize: 15, color: f >= type ? C.ink : C.muted, whiteSpace: "nowrap", overflow: "hidden" }}>
            {f < type ? "Wpisz adres – Kraków w 15 minut" : f < pick ? typed(ADDRESS, f, type, 12) : "ul. Wielicka 28, Kraków"}
          </span>
          <span style={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 10, background: C.red, color: "#fff" }}>
            <Search size={17} />
          </span>
        </div>
        {showList && (
          <div style={{ borderRadius: 14, background: "#fff", padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, fontSize: 14.5, color: C.ink, opacity: ramp(f, typedEnd - 6, typedEnd + 2), boxShadow: "0 10px 30px -14px rgba(80,10,10,.4)", outline: f > pick - 6 ? `2px solid ${C.redMid}` : "none" }}>
            <MapPin size={16} color={C.red} />
            <span>
              ul. Wielicka 28, 30-552 Kraków
              <br />
              <span style={{ fontSize: 12.5, color: C.muted }}>Podgórze</span>
            </span>
          </div>
        )}
      </div>
      {/* bottom sheet with the index */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 210, borderRadius: "26px 26px 0 0", background: "#fff", boxShadow: "0 -12px 40px -16px rgba(80,10,10,.45)", transform: `translateY(${(1 - sheet) * 230}px)`, padding: "12px 18px", color: C.ink }}>
        <div style={{ width: 44, height: 5, borderRadius: 5, background: "#e9dcd9", margin: "0 auto 10px" }} />
        <div style={{ fontWeight: 800, fontSize: 16 }}>ul. Wielicka 28, Kraków</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, background: C.redSoft, borderRadius: 12, padding: 4, margin: "10px 0" }}>
          {[
            ["Pieszo", Footprints],
            ["Komunikacją", BusFront],
          ].map(([label, Icon], i) => {
            const on = i === 0 ? 1 - toTransit : toTransit;
            const I = Icon as LucideIcon;
            return (
              <div key={label as string} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 0", borderRadius: 9, fontSize: 14, fontWeight: 600, background: `rgba(201,15,26,${on})`, color: on > 0.5 ? "#fff" : C.ink }}>
                <I size={15} /> {label as string}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: 56, display: "grid", placeItems: "center", background: `conic-gradient(${C.red} ${score * 3.6}deg, #f1e7e5 0)` }}>
            <div style={{ width: 44, height: 44, borderRadius: 44, background: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 18, color: C.red }}>{score}</div>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Indeks 15 minut</div>
            <div style={{ fontSize: 13, color: C.muted }}>Brakuje: park lub zieleń, biblioteka</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------
// 3. City-wide "Indeks 15 minut": a slow, smooth push-in over Kraków

export function CityMock({ duration }: { duration: number }) {
  const f = useCurrentFrame();
  const [W, H] = mock.city.size;
  const t = interpolate(f, [0, duration], [0, 1], { ...clamp, easing: inOut });
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: C.cream }}>
      <Img src={staticFile("mock/map-city.png")} style={{ width: W, height: H, transform: `scale(${1 + t * 0.14}) translate(${-t * 20}px, ${t * 10}px)`, transformOrigin: "62% 52%" }} />
    </div>
  );
}
