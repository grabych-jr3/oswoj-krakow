import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { Logo } from "@/components/brand/Logo";
import { AskForm } from "@/components/home/AskForm";
import { MapPreview } from "@/components/home/MapPreview";
import { LanguageMenu } from "@/components/shell/LanguageMenu";
import { LanguageSwitcher } from "@/components/shell/TopBar";
import { Link } from "@/i18n/navigation";

type Module = { id: string; title: string; desc: string };

const SOURCES = ["Otwarte Dane Miasta Krakowa", "BIP Kraków", "MSIP", "ZTP · GTFS", "OpenStreetMap"];

// Home page from the Claude Design mock (Home.dc.html): red sticky header, hero with a
// question box next to a mini map that opens /mapa, the three modules, data sources, footer.
export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Home");
  const tHeader = useTranslations("Header");
  const tChat = useTranslations("Chat");
  const modules = t.raw("modules") as Module[];
  const examples = tChat.raw("suggestions") as string[];

  return (
    <div className="min-h-dvh overflow-x-clip bg-white text-foreground">
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-[0_6px_24px_-12px_rgb(80_10_10/0.6)]">
        <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6">
          <Link
            href="/"
            aria-label={tHeader("home")}
            className="mr-auto rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Logo inverted />
          </Link>
          <LanguageMenu onPrimary className="sm:hidden" />
          <LanguageSwitcher onPrimary className="hidden sm:flex" />
          <Link
            href="/mapa"
            className="rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-4"
          >
            {/* Short label on phones so logo, language switch and the button fit on one row */}
            <span className="sm:hidden">{t("openMapShort")}</span>
            <span className="hidden sm:inline">{t("openMap")}</span>
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] items-start gap-10 px-4 pt-8 pb-16 sm:px-6 sm:pt-12 sm:pb-20 lg:gap-14">
          <div className="flex flex-col gap-6">
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

          <MapPreview />
        </section>

        <section aria-label={t("modulesLabel")} className="bg-[oklch(0.975_0.008_27)]">
          <div className="mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-10 px-4 py-16 sm:px-6 sm:py-20">
            {modules.map((m, i) => (
              <article key={m.id} id={m.id} className="flex flex-col gap-3.5 border-t-2 border-primary pt-[22px]">
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
