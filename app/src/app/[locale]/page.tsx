import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { AppShell } from "@/components/shell/AppShell";

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  return <AppShell />;
}
