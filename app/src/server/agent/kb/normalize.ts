/** Folds Polish text for matching: lowercase, "ł"→"l", other diacritics stripped. */
export function normalizePl(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Turns Markdown into one line of plain text and cuts it at a word boundary. */
export function toSnippet(markdown: string | null, maxLength = 200): string {
  if (!markdown) return "";
  const plain = markdown
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // links and images → their text
    .replace(/[#*_`>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= maxLength) return plain;
  const cut = plain.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLength)}…`;
}
