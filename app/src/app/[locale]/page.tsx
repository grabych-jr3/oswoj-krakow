import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// Placeholder start page; the real layout (map + chat) comes in C1–C3.
export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Home");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="max-w-xl text-lg text-muted-foreground">{t("tagline")}</p>
      <nav aria-label={t("language")} className="flex gap-3">
        {routing.locales.map((l) => (
          <Link key={l} href="/" locale={l} className="underline-offset-4 hover:underline" aria-current={l === locale ? "true" : undefined}>
            {l.toUpperCase()}
          </Link>
        ))}
      </nav>
      <p className="max-w-xl text-sm text-muted-foreground">{t("disclaimer")}</p>
    </main>
  );
}
