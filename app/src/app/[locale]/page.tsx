import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { Logo } from "@/components/brand/Logo";
import { AskForm } from "@/components/home/AskForm";
import { LanguageSwitcher } from "@/components/shell/TopBar";
import { Link } from "@/i18n/navigation";

type Module = { id: string; title: string; desc: string };

const SOURCES = ["Otwarte Dane Miasta Krakowa", "BIP Kraków", "MSIP", "ZTP · GTFS", "OpenStreetMap"];

// Home page from the Claude Design mock (Home.dc.html): hero with a question box,
// example answer card, the three modules, data sources and footer.
export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Home");
  const tHeader = useTranslations("Header");
  const tChat = useTranslations("Chat");
  const modules = t.raw("modules") as Module[];
  const examples = tChat.raw("suggestions") as string[];
  const docs = t.raw("docs") as string[];

  return (
    <div className="min-h-dvh overflow-x-hidden bg-white text-foreground">
      <header className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-3 gap-y-3 px-4 py-5 sm:gap-x-6 sm:px-6">
        <Link
          href="/"
          aria-label={tHeader("home")}
          className="mr-auto rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Logo />
        </Link>
        <nav aria-label={t("navLabel")} className="hidden gap-[22px] text-[15px] font-medium lg:flex">
          {modules.map((m) => (
            <a key={m.id} href={`#${m.id}`} className="text-foreground hover:text-primary">
              {m.title}
            </a>
          ))}
        </nav>
        <LanguageSwitcher />
        <Link
          href="/mapa"
          className="rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-4"
        >
          {/* Short label on phones so logo, language switch and the button fit on one row */}
          <span className="sm:hidden">{t("openMapShort")}</span>
          <span className="hidden sm:inline">{t("openMap")}</span>
        </Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] items-center gap-14 px-4 pt-10 pb-20 sm:px-6 sm:pt-14 sm:pb-[88px]">
          <div className="flex flex-col gap-[26px]">
            <p className="font-mono text-[13px] font-medium tracking-[0.04em] text-primary uppercase">{t("kicker")}</p>
            <h1 className="text-[clamp(40px,5.4vw,68px)] leading-[1.02] font-bold tracking-[-0.035em] text-balance">
              {t("title")}
            </h1>
            <p className="max-w-[540px] text-lg leading-[1.55] text-pretty text-[oklch(0.38_0.02_27)] sm:text-[19px]">
              {t("subtitle")}
            </p>
            <AskForm />
            <ul aria-label={tChat("suggestionsLabel")} className="flex max-w-[600px] flex-wrap gap-2">
              {examples.map((e) => (
                <li key={e}>
                  <Link
                    href={{ pathname: "/mapa", query: { q: e } }}
                    className="block rounded-full bg-[oklch(0.97_0.015_27)] px-[13px] py-2 text-sm font-medium text-primary-strong hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {e}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <figure aria-label={t("previewLabel")} className="flex flex-col gap-3.5 rounded-[28px] bg-primary p-[26px] text-primary-foreground">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">{tChat("title")}</span>
              <span className="font-mono text-[11px] font-medium text-on-primary-muted">BIP · MSIP · ZTP</span>
            </div>
            <p className="max-w-[82%] self-end rounded-[18px] rounded-br-[4px] bg-primary-strong px-4 py-3 text-[15px] leading-[1.45]">
              {examples[0]}
            </p>
            <div className="flex flex-col gap-3 rounded-[18px] rounded-bl-[4px] bg-white p-[18px] text-foreground">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[11px] font-medium tracking-[0.04em] text-primary uppercase">{t("cardKicker")}</span>
                <span className="text-lg font-bold tracking-[-0.01em]">{t("cardTitle")}</span>
              </div>
              <ul className="flex flex-col gap-2">
                {docs.map((d) => (
                  <li key={d} className="flex gap-[9px] text-sm leading-[1.4]">
                    <span className="mt-[7px] size-1.5 shrink-0 bg-primary" aria-hidden />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap justify-between gap-2.5 border-t border-[oklch(0.93_0.01_27)] pt-3 text-[13px]">
                <span>
                  <span className="text-muted-foreground">{t("feeLabel")}: </span>
                  <strong>{t("fee")}</strong>
                </span>
                <span className="font-mono text-primary-strong">{t("source")} ↗</span>
              </div>
            </div>
            <figcaption className="flex items-center gap-2 text-[13px] text-[oklch(0.97_0.02_27)]">
              <span className="flex" aria-hidden>
                {["1", "2", "3"].map((n, i) => (
                  <span
                    key={n}
                    className={`grid size-5 place-items-center rounded-full bg-white text-[11px] font-bold text-primary ${i ? "-ml-[5px] shadow-[0_0_0_2px_var(--primary)]" : ""}`}
                  >
                    {n}
                  </span>
                ))}
              </span>
              {t("onMap")}
            </figcaption>
          </figure>
        </section>

        <section aria-label={t("modulesLabel")} className="bg-[oklch(0.975_0.008_27)]">
          <div className="mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-10 px-4 py-16 sm:px-6 sm:py-20">
            {modules.map((m, i) => (
              <article key={m.id} id={m.id} className="flex scroll-mt-6 flex-col gap-3.5 border-t-2 border-primary pt-[22px]">
                <span className="font-mono text-[13px] font-medium text-primary">{`0${i + 1}`}</span>
                <h2 className="text-[26px] font-bold tracking-[-0.02em]">{m.title}</h2>
                <p className="text-base leading-[1.55] text-pretty text-[oklch(0.38_0.02_27)]">{m.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto flex max-w-[1240px] flex-wrap items-baseline gap-x-10 gap-y-5 px-4 py-14 sm:px-6">
          <h2 className="font-mono text-[13px] font-medium tracking-[0.04em] text-muted-foreground uppercase">{t("sourcesLabel")}</h2>
          <ul className="flex flex-wrap gap-x-7 gap-y-3 text-base font-medium">
            {SOURCES.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-4 px-4 py-7 text-sm sm:px-6">
          <p>{tChat("note")}</p>
          <p className="font-mono">Open Data App 2026 · Kraków</p>
        </div>
      </footer>
    </div>
  );
}
