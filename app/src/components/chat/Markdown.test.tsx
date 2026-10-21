import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "./Markdown";

const html = (text: string, markers?: string[]) =>
  renderToStaticMarkup(<Markdown text={text} markers={markers && new Set(markers)} onMarker={() => {}} />);

describe("Markdown", () => {
  it("renders paragraphs, bold, lists and links", () => {
    const out = html("**PESEL** first.\n\n1. One\n2. [BIP](https://www.bip.krakow.pl)\n\n- a\n- b");
    expect(out).toContain("<strong>PESEL</strong>");
    expect(out).toContain('<ol class="flex flex-col gap-1 pl-5 list-decimal');
    expect(out).toContain('href="https://www.bip.krakow.pl"');
    expect(out).toContain('rel="noreferrer"');
    expect(out.match(/<li>/g)).toHaveLength(4);
  });

  it("renders BIP tables", () => {
    const out = html("| Tytuł | Kwota |\n| --- | --- |\n| Opłata | 17 |");
    expect(out).toContain("<th");
    expect(out).toContain(">17</td>");
  });

  it("never renders raw HTML or non-http links", () => {
    const out = html('<img src=x onerror="alert(1)"> [x](javascript:alert(1))');
    expect(out).not.toContain("<img");
    expect(out).not.toContain('href="javascript');
  });

  it("turns known marker numbers into buttons and leaves others as text", () => {
    const out = html("Closest: (1) and (7).", ["1"]);
    expect(out).toMatch(/<button[^>]*>1<\/button>/);
    expect(out).toContain("(7)");
  });

  it("copes with unfinished syntax while streaming", () => {
    expect(html("Bring **your pass")).toContain("**your pass");
  });

  it("keeps the meaning of HTML left in BIP cards without rendering it", () => {
    const out = html(
      '| Dokument |\n| --- |\n| <p>Odpis <strong>aktu</strong></p><p>z <a href="https://x.pl/a">tłumaczeniem</a></p><ul><li>a</li><li>b</li></ul> |',
    );
    expect(out).not.toContain("&lt;p");
    expect(out).toContain("<strong>aktu</strong>");
    expect(out).toContain('href="https://x.pl/a"');
    expect(out).toContain("• a");
  });
});
