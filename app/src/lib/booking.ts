const BOOKING_HOST = "umawianiewizyt.um.krakow.pl";

/**
 * Link for "Book a visit". The city's booking site no longer serves per-office deep links
 * (`/branch/<n>` answers 404 since 10.2026), so those go to its home page, where the office is
 * picked from a list. Other links are returned unchanged.
 */
export function bookingLink(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === BOOKING_HOST && u.pathname.startsWith("/branch/")) return `https://${BOOKING_HOST}/`;
    return url;
  } catch {
    return url;
  }
}
