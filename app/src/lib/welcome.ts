/**
 * "Welcome dialog seen" flag. A cookie (not only localStorage) so the server knows it too: first-time
 * visitors get the dialog in the server HTML and see it with the first paint, not after hydration.
 */
export const WELCOME_SEEN_KEY = "ok-welcome-seen";

const ONE_YEAR_S = 60 * 60 * 24 * 365;

export function rememberWelcomeSeen() {
  document.cookie = `${WELCOME_SEEN_KEY}=1; Max-Age=${ONE_YEAR_S}; Path=/; SameSite=Lax`;
}
