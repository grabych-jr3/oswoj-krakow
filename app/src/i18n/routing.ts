import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["pl", "uk", "en"],
  defaultLocale: "pl",
  // Always open in Polish (ignore the browser language and the remembered cookie);
  // users switch with the PL / UA / EN toggle.
  localeDetection: false,
});
