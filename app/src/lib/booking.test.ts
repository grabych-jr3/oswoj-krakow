import { describe, expect, it } from "vitest";
import { bookingLink } from "./booking";

describe("bookingLink", () => {
  it("sends dead per-office links to the booking home page", () => {
    expect(bookingLink("https://umawianiewizyt.um.krakow.pl/branch/49")).toBe("https://umawianiewizyt.um.krakow.pl/");
  });

  it("keeps other links", () => {
    expect(bookingLink("https://umawianiewizyt.um.krakow.pl/stan-kolejki?branch=12")).toBe(
      "https://umawianiewizyt.um.krakow.pl/stan-kolejki?branch=12",
    );
    expect(bookingLink("https://www.bip.krakow.pl/uslugi/SA-34")).toBe("https://www.bip.krakow.pl/uslugi/SA-34");
  });
});
