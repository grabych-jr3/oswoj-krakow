import {
  Baby,
  Banknote,
  Bus,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Footprints,
  Globe2,
  House,
  IdCard,
  Languages,
  Link2,
  MapPin,
  School,
  Smile,
  Trees,
} from "lucide-react";
import { AbsoluteFill, Audio, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import clips from "./clips.json";
import { Backdrop, BrowserCard, Counter, Laptop, LogoMark, Person, Phone, Pill, Skyline, Subtitles, usePop } from "./components";
import { C, FONT, FPS, MONO } from "./theme";
import { cue, type SceneTiming } from "./timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (t: number) => 1 - (1 - t) ** 3;

/** Voice-over of the scene, starting after its lead-in. */
function Voice({ scene }: { scene: SceneTiming }) {
  return (
    <Sequence from={scene.lead}>
      <Audio src={staticFile(`voice/${scene.id}.mp3`)} />
    </Sequence>
  );
}

/** A screen recording slowed or sped up a little to fill `seconds`. */
function Clip({ name, seconds, start = 0 }: { name: keyof typeof clips; seconds: number; start?: number }) {
  const rate = Math.min(1.25, Math.max(0.7, clips[name] / seconds));
  return (
    <Sequence from={start}>
      <OffthreadVideo src={staticFile(`rec/${name}.mp4`)} playbackRate={rate} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </Sequence>
  );
}

const Stage = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
    {children}
  </svg>
);

// 1. A newcomer arrives in Kraków; the things to sort out pop up.
export function S1Arrival({ scene }: { scene: SceneTiming }) {
  const frame = useCurrentFrame();
  const rise = usePop(0, { damping: 18 });
  const arrive = cue(scene, /dziesiątki/, 90);
  const walkX = interpolate(frame, [0, arrive], [-160, 560], { ...clamp, easing: (t) => t });
  const pills = [
    { re: /zameldowanie/, icon: House, text: "Zameldowanie", x: 980, y: 250 },
    { re: /pesel/, icon: IdCard, text: "PESEL", x: 1300, y: 400 },
    { re: /przedszkole/, icon: Baby, text: "Przedszkole", x: 1020, y: 550 },
  ];
  return (
    <AbsoluteFill>
      <Backdrop />
      <Stage>
        <Skyline rise={rise} />
        <Person x={walkX} y={930} scale={1.15} pose={frame < arrive ? "walk" : "think"} suitcase shirt={C.red} hairStyle="short" />
      </Stage>
      {pills.map((p, i) => (
        <PillAt key={p.text} delay={cue(scene, p.re, arrive + i * 15)} {...p} />
      ))}
      <Voice scene={scene} />
      <Subtitles scene={scene} />
    </AbsoluteFill>
  );
}

function PillAt({ delay, icon, text, x, y, size = 40, tone }: { delay: number; icon: Parameters<typeof Pill>[0]["icon"]; text: string; x: number; y: number; size?: number; tone?: "light" | "red" | "dark" }) {
  const p = usePop(delay);
  const frame = useCurrentFrame();
  return <Pill icon={icon} text={text} progress={p} size={size} tone={tone} style={{ left: x, top: y + Math.sin((frame + x) / 30) * 6 }} />;
}

// 2. Information is scattered: many portals, 639 service cards.
export function S2Problem({ scene }: { scene: SceneTiming }) {
  const frame = useCurrentFrame();
  const statAt = cue(scene, /sześćset/, 20);
  const scatterAt = cue(scene, /rozproszone/, 90);
  const lostAt = cue(scene, /zgubić/, 200);
  const cards = [
    { title: "bip.krakow.pl", x: 120, y: 330, r: -6 },
    { title: "otwartedane.um.krakow.pl", x: 1430, y: 300, r: 5 },
    { title: "msip.krakow.pl", x: 210, y: 640, r: 4 },
    { title: "ztp.krakow.pl", x: 1380, y: 620, r: -4 },
    { title: "umawianiewizyt…", x: 60, y: 40, r: 2 },
  ];
  const stat = usePop(statAt);
  return (
    <AbsoluteFill>
      <Backdrop />
      {cards.map((c, i) => {
        const p = usePopSafe(scatterAt + i * 6);
        const drift = Math.sin((frame + i * 40) / 40) * 10;
        return <BrowserCard key={c.title} title={c.title} x={c.x} y={c.y + drift} rotate={c.r + drift / 6} progress={p} w={c.x === 60 ? 330 : 380} />;
      })}
      <div
        style={{
          position: "absolute",
          left: 620,
          top: 150,
          width: 680,
          textAlign: "center",
          fontFamily: FONT,
          color: C.ink,
          transform: `scale(${stat})`,
          opacity: stat,
        }}
      >
        <div style={{ fontSize: 190, fontWeight: 800, color: C.red, lineHeight: 1 }}>
          <Counter to={639} start={statAt} />
        </div>
        <div style={{ fontSize: 46, fontWeight: 700 }}>kart usług w BIP</div>
      </div>
      <Stage>
        <Person x={960} y={1010} scale={1.05} pose="think" shirt={C.redStrong} hairStyle="long" hair="#5a3324" />
        {[0, 1, 2].map((i) => {
          const p = interpolate(frame, [lostAt + i * 6, lostAt + i * 6 + 10], [0, 1], clamp);
          return (
            <text key={i} x={1040 + i * 46} y={560 - i * 40 + Math.sin((frame + i * 20) / 10) * 6} fontFamily={FONT} fontWeight={800} fontSize={70 + i * 10} fill={C.red} opacity={p}>
              ?
            </text>
          );
        })}
      </Stage>
      <Voice scene={scene} />
      <Subtitles scene={scene} />
    </AbsoluteFill>
  );
}

// usePop inside .map is fine in Remotion (fixed number of items), but keep the call order stable.
const usePopSafe = (delay: number) => usePop(delay);

// 3. The answer: Oswój Kraków.
export function S3Reveal({ scene }: { scene: SceneTiming }) {
  const logo = usePop(2, { damping: 11 });
  const title = usePop(10);
  const sub = usePop(cue(scene, /asystent/, 40));
  return (
    <AbsoluteFill>
      <Backdrop tone="red" />
      <Stage>
        <Skyline color="rgba(255,255,255,0.14)" back="rgba(255,255,255,0.06)" rise={usePop(0, { damping: 20 })} />
      </Stage>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 34, paddingBottom: 120 }}>
        <div style={{ transform: `scale(${logo}) rotate(${(1 - logo) * -20}deg)` }}>
          <LogoMark size={210} inverted />
        </div>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 128, color: C.white, letterSpacing: -3, opacity: title, transform: `translateY(${(1 - title) * 40}px)` }}>
          Oswój Kraków
        </div>
        <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: 48, color: "rgba(255,255,255,0.9)", opacity: sub, transform: `translateY(${(1 - sub) * 30}px)` }}>
          asystent AI i mapa dla nowych mieszkańców
        </div>
      </AbsoluteFill>
      <Voice scene={scene} />
      <Subtitles scene={scene} />
    </AbsoluteFill>
  );
}

// 4. The assistant on a laptop: the real app answering about PESEL; zoom on the card, then on the map.
export function S4Assistant({ scene }: { scene: SceneTiming }) {
  const frame = useCurrentFrame();
  const enter = usePop(0, { damping: 18 });
  const docs = cue(scene, /dokumenty/, 200);
  const map = cue(scene, /^mapa/, 380);
  // Camera on the laptop: wide → close-up of the answer card (right) → back out to the map.
  const zoom = interpolate(frame, [docs - 10, docs + 14, map - 6, map + 18], [1, 1.55, 1.55, 1], { ...clamp, easing: ease });
  const originX = interpolate(frame, [docs - 10, docs + 14], [50, 92], clamp);
  const seconds = scene.frames / FPS - 0.6;
  const callouts = [
    { re: /polsku/, icon: Languages, text: "PL · UA · EN" },
    { re: /dokumenty/, icon: FileText, text: "Dokumenty" },
    { re: /zapłacić/, icon: Banknote, text: "Opłaty" },
    { re: /trwa/, icon: Clock, text: "Termin" },
    { re: /^mapa/, icon: MapPin, text: "Gdzie załatwić" },
  ];
  return (
    <AbsoluteFill>
      <Backdrop />
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${(1 - enter) * 120}px)`, opacity: enter }}>
        <div style={{ position: "absolute", left: 470, top: 70, width: 1380, height: 900, transform: `scale(${zoom})`, transformOrigin: `${originX}% 30%` }}>
          <Laptop x={0} y={0} width={1320}>
            <Clip name="assistant" seconds={seconds} />
          </Laptop>
        </div>
      </div>
      <Stage>
        <Person x={250} y={1010} scale={0.95} pose="point" shirt={C.redStrong} hairStyle="bun" hair="#4a2a22" skin={C.skinDark} />
      </Stage>
      {callouts.map((c, i) => (
        <PillAt key={c.text} delay={cue(scene, c.re, 40 + i * 60)} icon={c.icon} text={c.text} x={50} y={90 + i * 102} size={32} tone={i === 0 ? "dark" : "light"} />
      ))}
      <Voice scene={scene} />
      <Subtitles scene={scene} />
    </AbsoluteFill>
  );
}

// 5. "Kraków w 15 minut" on a phone: an address, the zone, and the bigger zone by public transport.
export function S5Fifteen({ scene }: { scene: SceneTiming }) {
  const enter = usePop(0, { damping: 18 });
  const seconds = scene.frames / FPS - 0.6;
  const pills = [
    { re: /żłobki/, icon: Baby, text: "Żłobki", y: 250 },
    { re: /szkoły/, icon: School, text: "Szkoły", y: 370 },
    { re: /parki/, icon: Trees, text: "Parki", y: 490 },
    { re: /przystanki/, icon: Bus, text: "Przystanki", y: 610 },
  ];
  const walk = cue(scene, /pieszo/, 150);
  const transit = cue(scene, /komunikacją/, 190);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Stage>
        {/* a new flat: house with a red roof */}
        <g transform={`translate(330 ${640 + (1 - enter) * 60})`} opacity={enter}>
          <rect x="-150" y="0" width="300" height="230" rx="14" fill={C.white} stroke={C.redMid} strokeWidth="6" />
          <path d="M-190 10 L0 -150 L190 10 Z" fill={C.red} />
          <rect x="-110" y="60" width="70" height="70" rx="8" fill={C.redSoft} />
          <rect x="40" y="60" width="70" height="70" rx="8" fill={C.redSoft} />
          <rect x="-30" y="140" width="60" height="90" rx="8" fill={C.redStrong} />
        </g>
        <Person x={560} y={1000} scale={0.95} pose="phone" shirt={C.red} hairStyle="long" hair="#2f1c18" />
      </Stage>
      <div style={{ opacity: enter, transform: `translateY(${(1 - enter) * 80}px)` }}>
        <Phone x={780} y={34} width={360}>
          <Clip name="fifteen" seconds={seconds} />
        </Phone>
      </div>
      <PillAt delay={walk} icon={Footprints} text="15 min pieszo" x={1290} y={110} size={34} tone="red" />
      <PillAt delay={transit} icon={Bus} text="lub komunikacją" x={1330} y={0} size={28} tone="dark" />
      {pills.map((p) => (
        <PillAt key={p.text} delay={cue(scene, p.re, 250)} icon={p.icon} text={p.text} x={1320} y={p.y} size={38} />
      ))}
      <Voice scene={scene} />
      <Subtitles scene={scene} />
    </AbsoluteFill>
  );
}

// 6. Value for the city: the 15-minute index over the whole of Kraków.
export function S6City({ scene }: { scene: SceneTiming }) {
  const enter = usePop(0, { damping: 18 });
  const seconds = scene.frames / FPS - 0.6;
  const legend = usePop(cue(scene, /brakuje/, 60));
  return (
    <AbsoluteFill>
      <Backdrop />
      <div style={{ position: "absolute", left: 90, top: 70, width: 1180, height: 737, borderRadius: 34, overflow: "hidden", boxShadow: "0 40px 80px -30px rgba(60,10,10,0.5)", opacity: enter, transform: `scale(${0.9 + 0.1 * enter})` }}>
        <Clip name="city" seconds={seconds} />
      </div>
      <div style={{ position: "absolute", left: 130, top: 690, padding: "16px 22px", borderRadius: 20, background: C.white, fontFamily: FONT, boxShadow: "0 18px 40px -18px rgba(80,10,10,0.4)", opacity: legend, transform: `translateY(${(1 - legend) * 30}px)` }}>
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
        <Person x={1560} y={1000} scale={1} pose="point" flip shirt={C.ink} pants="#5b4b49" hairStyle="short" hair="#8a8a8a" />
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
  const hub = usePop(4, { damping: 12 });
  const link = usePop(cue(scene, /linkiem/, 90));
  const sources = ["Otwarte Dane Miasta Krakowa", "BIP Kraków", "MSIP", "ZTP Kraków", "OpenStreetMap"];
  return (
    <AbsoluteFill>
      <Backdrop />
      <Stage>
        {sources.map((_, i) => {
          const a = (i / sources.length) * Math.PI * 2 - Math.PI / 2 + frame / 400;
          return <line key={i} x1={960} y1={420} x2={960 + Math.cos(a) * 470} y2={420 + Math.sin(a) * 250} stroke={C.redMid} strokeWidth="4" strokeDasharray="10 12" opacity={hub} />;
        })}
      </Stage>
      {sources.map((s, i) => {
        const a = (i / sources.length) * Math.PI * 2 - Math.PI / 2 + frame / 400;
        const p = usePopSafe(6 + i * 7);
        return <Pill key={s} icon={Globe2} text={s} progress={p} size={30} style={{ left: 960 + Math.cos(a) * 470, top: 420 + Math.sin(a) * 250, translate: "-50% -50%" }} />;
      })}
      <div style={{ position: "absolute", left: 960 - 110, top: 420 - 110, width: 220, height: 220, borderRadius: 999, background: C.red, display: "grid", placeItems: "center", transform: `scale(${hub})`, boxShadow: "0 30px 60px -20px rgba(201,15,26,0.6)" }}>
        <Link2 size={110} color={C.white} strokeWidth={2.4} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 960,
          top: 800,
          translate: "-50% 0",
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "18px 28px",
          borderRadius: 18,
          background: C.white,
          fontFamily: MONO,
          fontWeight: 600,
          fontSize: 32,
          color: C.redStrong,
          boxShadow: "0 18px 40px -18px rgba(80,10,10,0.4)",
          opacity: link,
          transform: `translateY(${(1 - link) * 30}px)`,
        }}
      >
        Karta w BIP: SA-34 <ExternalLink size={30} />
      </div>
      <Voice scene={scene} />
      <Subtitles scene={scene} />
    </AbsoluteFill>
  );
}

// 8. End card.
export function S8End({ scene }: { scene: SceneTiming }) {
  const logo = usePop(0, { damping: 12 });
  const url = usePop(18);
  const badge = usePop(30);
  return (
    <AbsoluteFill>
      <Backdrop tone="red" />
      <Stage>
        <Skyline color="rgba(255,255,255,0.12)" back="rgba(255,255,255,0.05)" rise={usePop(0, { damping: 20 })} />
      </Stage>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 30, paddingBottom: 140 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 36, transform: `scale(${logo})` }}>
          <LogoMark size={170} inverted />
          <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 120, color: C.white, letterSpacing: -3 }}>Oswój Kraków</span>
        </div>
        <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: 52, color: C.white, opacity: url, padding: "14px 34px", borderRadius: 999, background: "rgba(255,255,255,0.14)" }}>
          oswoj-krakow.vercel.app
        </div>
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 34, color: "rgba(255,255,255,0.85)", opacity: badge }}>Open Data App 2026 · Kraków</div>
      </AbsoluteFill>
      <Voice scene={scene} />
      <Subtitles scene={scene} />
    </AbsoluteFill>
  );
}
