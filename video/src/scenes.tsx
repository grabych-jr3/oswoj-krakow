import type { LucideIcon } from "lucide-react";
import { Baby, Banknote, Bus, CheckCircle2, Clock, ExternalLink, FileText, Footprints, Globe2, House, IdCard, Languages, Link2, MapPin, School, Smile, Trees } from "lucide-react";
import { AbsoluteFill, Audio, Easing, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Character, LOOKS } from "./characters";
import { Backdrop, BrowserCard, Counter, Laptop, LogoMark, Phone, Pill, Skyline, Subtitles, usePop } from "./components";
import { AssistantMock, CityMock, FifteenMock } from "./mockups";
import { C, FONT, MONO } from "./theme";
import { cue, type SceneTiming } from "./timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const smooth = Easing.bezier(0.33, 1, 0.68, 1);
const inOut = Easing.bezier(0.65, 0, 0.35, 1);
const ramp = (f: number, a: number, b: number, e = smooth) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: e });

/** Voice-over of the scene, starting after its lead-in. */
function Voice({ scene }: { scene: SceneTiming }) {
  return (
    <Sequence from={scene.lead}>
      <Audio src={staticFile(`voice/${scene.id}.mp3`)} />
    </Sequence>
  );
}

const Stage = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
    {children}
  </svg>
);

/** A label that floats in softly and bobs a little. */
function PillAt({ delay, icon, text, x, y, size = 40, tone }: { delay: number; icon?: LucideIcon; text: string; x: number; y: number; size?: number; tone?: "light" | "red" | "dark" }) {
  const p = usePop(delay);
  const frame = useCurrentFrame();
  return <Pill icon={icon} text={text} progress={p} size={size} tone={tone} style={{ left: x, top: y + Math.sin((frame + x) / 34) * 5 }} />;
}

/** Whole scene drifts very slowly, so nothing ever stands completely still. */
function Drift({ children, amount = 0.025 }: { children: React.ReactNode; amount?: number }) {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ transform: `scale(${1 + amount * Math.min(1, f / 300)})` }}>{children}</AbsoluteFill>;
}

// 1. A newcomer walks into Kraków; the things to sort out float up.
export function S1Arrival({ scene }: { scene: SceneTiming }) {
  const frame = useCurrentFrame();
  const rise = usePop(0);
  const arrive = cue(scene, /dziesiątki/, 100);
  const walkX = interpolate(frame, [0, arrive], [-180, 560], { ...clamp, easing: Easing.out(Easing.quad) });
  const pills = [
    { re: /zameldowanie/, icon: House, text: "Zameldowanie", x: 980, y: 250 },
    { re: /pesel/, icon: IdCard, text: "PESEL", x: 1310, y: 400 },
    { re: /przedszkole/, icon: Baby, text: "Przedszkole", x: 1020, y: 550 },
  ];
  return (
    <AbsoluteFill>
      <Backdrop />
      <Drift>
        <Stage>
          <Skyline rise={rise} />
          <Character x={walkX} y={940} scale={1.12} pose={frame < arrive - 4 ? "walk" : "think"} suitcase />
        </Stage>
        {pills.map((p, i) => (
          <PillAt key={p.text} delay={cue(scene, p.re, arrive + i * 15)} {...p} />
        ))}
      </Drift>
      <Voice scene={scene} />
      <Subtitles scene={scene} />
    </AbsoluteFill>
  );
}

// 2. Information is scattered: many portals, 639 service cards.
export function S2Problem({ scene }: { scene: SceneTiming }) {
  const frame = useCurrentFrame();
  const statAt = cue(scene, /sześćset/, 20);
  const scatterAt = cue(scene, /rozproszone/, 90);
  const lostAt = cue(scene, /zgubić/, 200);
  const cards = [
    { title: "umawianiewizyt…", x: 60, y: 40, r: 2, w: 330 },
    { title: "bip.krakow.pl", x: 120, y: 330, r: -6, w: 380 },
    { title: "otwartedane.um.krakow.pl", x: 1430, y: 300, r: 5, w: 380 },
    { title: "msip.krakow.pl", x: 210, y: 640, r: 4, w: 380 },
    { title: "ztp.krakow.pl", x: 1380, y: 620, r: -4, w: 380 },
  ];
  const stat = usePop(statAt);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Drift>
        {cards.map((c, i) => {
          const p = ramp(frame, scatterAt + i * 6, scatterAt + i * 6 + 22);
          const drift = Math.sin((frame + i * 40) / 46) * 9;
          return <BrowserCard key={c.title} title={c.title} x={c.x} y={c.y + drift + (1 - p) * 40} rotate={c.r + drift / 6} progress={0.9 + 0.1 * p} w={c.w} />;
        }).map((el, i) => (
          <div key={i} style={{ opacity: ramp(frame, scatterAt + i * 6, scatterAt + i * 6 + 18) }}>
            {el}
          </div>
        ))}
        <div style={{ position: "absolute", left: 620, top: 150, width: 680, textAlign: "center", fontFamily: FONT, color: C.ink, opacity: stat, transform: `translateY(${(1 - stat) * 24}px)` }}>
          <div style={{ fontSize: 190, fontWeight: 800, color: C.red, lineHeight: 1 }}>
            <Counter to={639} start={statAt} duration={36} />
          </div>
          <div style={{ fontSize: 46, fontWeight: 700 }}>kart usług w BIP</div>
        </div>
        <Stage>
          <Character x={960} y={1010} scale={1.02} pose="think" look={LOOKS.mum} />
          {[0, 1, 2].map((i) => {
            const p = ramp(frame, lostAt + i * 7, lostAt + i * 7 + 14);
            return (
              <text key={i} x={1040 + i * 46} y={560 - i * 40 - p * 10 + Math.sin((frame + i * 20) / 12) * 5} fontFamily={FONT} fontWeight={800} fontSize={70 + i * 10} fill={C.red} opacity={p}>
                ?
              </text>
            );
          })}
        </Stage>
      </Drift>
      <Voice scene={scene} />
      <Subtitles scene={scene} />
    </AbsoluteFill>
  );
}

// 3. The answer: Oswój Kraków.
export function S3Reveal({ scene }: { scene: SceneTiming }) {
  const f = useCurrentFrame();
  const logo = usePop(4);
  const title = usePop(14);
  const sub = usePop(cue(scene, /asystent/, 40));
  return (
    <AbsoluteFill>
      <Backdrop tone="red" />
      <Drift amount={0.035}>
        <Stage>
          <Skyline color="rgba(255,255,255,0.14)" back="rgba(255,255,255,0.06)" rise={usePop(0)} />
        </Stage>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 34, paddingBottom: 120 }}>
          <div style={{ opacity: logo, transform: `scale(${0.8 + 0.2 * logo}) translateY(${Math.sin(f / 26) * 4}px)` }}>
            <LogoMark size={210} inverted />
          </div>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 128, color: C.white, letterSpacing: -3, opacity: title, transform: `translateY(${(1 - title) * 30}px)` }}>Oswój Kraków</div>
          <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: 48, color: "rgba(255,255,255,0.9)", opacity: sub, transform: `translateY(${(1 - sub) * 24}px)` }}>
            asystent AI i mapa dla nowych mieszkańców
          </div>
        </AbsoluteFill>
      </Drift>
      <Voice scene={scene} />
      <Subtitles scene={scene} />
    </AbsoluteFill>
  );
}

// 4. The assistant on a laptop: an animated mock-up of the app answering about PESEL.
export function S4Assistant({ scene }: { scene: SceneTiming }) {
  const f = useCurrentFrame();
  const enter = usePop(0);
  const docs = cue(scene, /dokumenty/, 230);
  const map = cue(scene, /^mapa/, 400);
  // the camera leans gently towards the answer card, then back for the map
  const lean = ramp(f, docs - 30, docs + 10, inOut) * (1 - ramp(f, map - 20, map + 20, inOut));
  const callouts = [
    { re: /polsku/, icon: Languages, text: "PL · UA · EN", tone: "dark" as const },
    { re: /dokumenty/, icon: FileText, text: "Dokumenty" },
    { re: /zapłacić/, icon: Banknote, text: "Opłaty" },
    { re: /trwa/, icon: Clock, text: "Termin" },
    { re: /^mapa/, icon: MapPin, text: "Gdzie załatwić", tone: "red" as const },
  ];
  return (
    <AbsoluteFill>
      <Backdrop />
      <div style={{ position: "absolute", inset: 0, opacity: enter, transform: `translateY(${(1 - enter) * 60}px) scale(${1 + lean * 0.12})`, transformOrigin: "88% 45%" }}>
        <Laptop x={500} y={86} width={1320}>
          <AssistantMock ask={20} answer={cue(scene, /asystent/, 150)} docs={docs} map={map} />
        </Laptop>
      </div>
      <Stage>
        <Character x={250} y={1010} scale={0.95} pose={f < 40 ? "wave" : "present"} look={LOOKS.guide} />
      </Stage>
      {callouts.map((c, i) => (
        <PillAt key={c.text} delay={cue(scene, c.re, 40 + i * 60)} icon={c.icon} text={c.text} x={50} y={90 + i * 98} size={30} tone={c.tone} />
      ))}
      <Voice scene={scene} />
      <Subtitles scene={scene} />
    </AbsoluteFill>
  );
}

// 5. "Kraków w 15 minut" on a phone: an address, the walking zone, then the bigger zone by transit.
export function S5Fifteen({ scene }: { scene: SceneTiming }) {
  const enter = usePop(0);
  const walk = cue(scene, /pieszo/, 150);
  const transit = cue(scene, /komunikacją/, 190);
  const pills = [
    { re: /żłobki/, icon: Baby, text: "Żłobki", y: 300 },
    { re: /szkoły/, icon: School, text: "Szkoły", y: 410 },
    { re: /parki/, icon: Trees, text: "Parki", y: 520 },
    { re: /przystanki/, icon: Bus, text: "Przystanki", y: 630 },
  ];
  return (
    <AbsoluteFill>
      <Backdrop />
      <Drift>
        <Stage>
          <g transform={`translate(330 ${640 + (1 - enter) * 40})`} opacity={enter}>
            <rect x="-150" y="0" width="300" height="230" rx="14" fill={C.white} stroke={C.redMid} strokeWidth="6" />
            <path d="M-190 10 L0 -150 L190 10 Z" fill={C.red} />
            <rect x="-110" y="60" width="70" height="70" rx="8" fill={C.redSoft} />
            <rect x="40" y="60" width="70" height="70" rx="8" fill={C.redSoft} />
            <rect x="-30" y="140" width="60" height="90" rx="8" fill={C.redStrong} />
          </g>
          <Character x={580} y={1000} scale={0.95} pose="phone" phone look={LOOKS.student} />
        </Stage>
        <div style={{ opacity: enter, transform: `translateY(${(1 - enter) * 60}px)` }}>
          <Phone x={780} y={30} width={360}>
            <div style={{ position: "absolute", inset: 0, transform: `scale(${360 / 390})`, transformOrigin: "0 0", width: 390, height: 844 }}>
              <FifteenMock type={cue(scene, /wpisz/, 40)} zone={walk - 30} transit={transit} />
            </div>
          </Phone>
        </div>
        <PillAt delay={walk} icon={Footprints} text="15 min pieszo" x={1300} y={110} size={34} tone="red" />
        <PillAt delay={transit} icon={Bus} text="lub komunikacją" x={1340} y={200} size={28} tone="dark" />
        {pills.map((p) => (
          <PillAt key={p.text} delay={cue(scene, p.re, 250)} icon={p.icon} text={p.text} x={1320} y={p.y} size={38} />
        ))}
      </Drift>
      <Voice scene={scene} />
      <Subtitles scene={scene} />
    </AbsoluteFill>
  );
}

// 6. Value for the city: the 15-minute index over the whole of Kraków.
export function S6City({ scene }: { scene: SceneTiming }) {
  const enter = usePop(0);
  const legend = usePop(cue(scene, /brakuje/, 60));
  return (
    <AbsoluteFill>
      <Backdrop />
      <div style={{ position: "absolute", left: 90, top: 70, width: 1180, height: 737, borderRadius: 34, overflow: "hidden", boxShadow: "0 40px 80px -30px rgba(60,10,10,0.5)", opacity: enter, transform: `scale(${0.95 + 0.05 * enter})` }}>
        <div style={{ position: "absolute", inset: 0, transform: `scale(${1180 / 1600})`, transformOrigin: "0 0", width: 1600, height: 1000 }}>
          <CityMock duration={scene.frames} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 130, top: 690, padding: "16px 22px", borderRadius: 20, background: C.white, fontFamily: FONT, boxShadow: "0 18px 40px -18px rgba(80,10,10,0.4)", opacity: legend, transform: `translateY(${(1 - legend) * 20}px)` }}>
        <div style={{ fontWeight: 800, fontSize: 30, color: C.ink, marginBottom: 10 }}>Indeks 15 minut</div>
        <div style={{ display: "flex", width: 420, height: 18, borderRadius: 9, overflow: "hidden" }}>
          {["#9f1239", "#d9472b", "#ee8a3c", "#f4c25b", "#c3cf63", "#7eb356", "#2f8a4c"].map((c) => (
            <span key={c} style={{ flex: 1, background: c }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: C.muted, marginTop: 6 }}>
          <span>brakuje usług</span>
          <span>wszystko blisko</span>
        </div>
      </div>
      <Stage>
        <Character x={1560} y={1000} scale={1} pose="point" flip look={LOOKS.clerk} />
      </Stage>
      <PillAt delay={cue(scene, /mniej/, 150)} icon={CheckCircle2} text="Mniej wizyt bez dokumentów" x={1290} y={180} size={30} />
      <PillAt delay={cue(scene, /łatwiejszy/, 200)} icon={Smile} text="Łatwiejszy start" x={1360} y={290} size={30} tone="red" />
      <Voice scene={scene} />
      <Subtitles scene={scene} />
    </AbsoluteFill>
  );
}

// 7. Open data of Kraków, always with a link to the source.
export function S7Data({ scene }: { scene: SceneTiming }) {
  const frame = useCurrentFrame();
  const hub = usePop(4);
  const link = usePop(cue(scene, /linkiem/, 90));
  const sources = ["Otwarte Dane Miasta Krakowa", "BIP Kraków", "MSIP", "ZTP Kraków", "OpenStreetMap"];
  const spin = frame / 500;
  return (
    <AbsoluteFill>
      <Backdrop />
      <Stage>
        {sources.map((_, i) => {
          const a = (i / sources.length) * Math.PI * 2 - Math.PI / 2 + spin;
          const p = ramp(frame, 6 + i * 7, 26 + i * 7);
          return <line key={i} x1={960} y1={420} x2={960 + Math.cos(a) * 470 * p} y2={420 + Math.sin(a) * 250 * p} stroke={C.redMid} strokeWidth="4" strokeDasharray="10 12" />;
        })}
      </Stage>
      {sources.map((s, i) => {
        const a = (i / sources.length) * Math.PI * 2 - Math.PI / 2 + spin;
        const p = ramp(frame, 10 + i * 7, 30 + i * 7);
        return <Pill key={s} icon={Globe2} text={s} progress={p} size={30} style={{ left: 960 + Math.cos(a) * 470, top: 420 + Math.sin(a) * 250, translate: "-50% -50%" }} />;
      })}
      <div style={{ position: "absolute", left: 850, top: 310, width: 220, height: 220, borderRadius: 999, background: C.red, display: "grid", placeItems: "center", opacity: hub, transform: `scale(${0.85 + 0.15 * hub})`, boxShadow: "0 30px 60px -20px rgba(201,15,26,0.6)" }}>
        <Link2 size={110} color={C.white} strokeWidth={2.4} />
      </div>
      <div style={{ position: "absolute", left: 960, top: 800, translate: "-50% 0", display: "flex", alignItems: "center", gap: 14, padding: "18px 28px", borderRadius: 18, background: C.white, fontFamily: MONO, fontWeight: 600, fontSize: 32, color: C.redStrong, boxShadow: "0 18px 40px -18px rgba(80,10,10,0.4)", opacity: link, transform: `translateY(${(1 - link) * 20}px)` }}>
        Karta w BIP: SA-34 <ExternalLink size={30} />
      </div>
      <Voice scene={scene} />
      <Subtitles scene={scene} />
    </AbsoluteFill>
  );
}

// 8. End card.
export function S8End({ scene }: { scene: SceneTiming }) {
  const logo = usePop(0);
  const url = usePop(18);
  const badge = usePop(30);
  return (
    <AbsoluteFill>
      <Backdrop tone="red" />
      <Drift amount={0.03}>
        <Stage>
          <Skyline color="rgba(255,255,255,0.12)" back="rgba(255,255,255,0.05)" rise={usePop(0)} />
          <Character x={1640} y={960} scale={0.8} pose="wave" look={LOOKS.mum} />
        </Stage>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 30, paddingBottom: 140 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 36, opacity: logo, transform: `scale(${0.9 + 0.1 * logo})` }}>
            <LogoMark size={170} inverted />
            <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 120, color: C.white, letterSpacing: -3 }}>Oswój Kraków</span>
          </div>
          <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 52, color: C.white, opacity: url, padding: "14px 34px", borderRadius: 999, background: "rgba(255,255,255,0.14)" }}>oswoj-krakow.vercel.app</div>
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 34, color: "rgba(255,255,255,0.85)", opacity: badge }}>Open Data App 2026 · Kraków</div>
        </AbsoluteFill>
      </Drift>
      <Voice scene={scene} />
      <Subtitles scene={scene} />
    </AbsoluteFill>
  );
}
