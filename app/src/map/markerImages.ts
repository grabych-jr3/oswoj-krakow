import type { Map as MapLibreMap } from "maplibre-gl";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { PlaceCategory } from "@/contracts/place";
import { CATEGORY_STYLES } from "@/lib/categories";

export const markerImageId = (category: PlaceCategory) => `pin-${category}`;

const SIZE = 36; // CSS px; drawn at 2× for sharp markers on retina screens

/** Inner SVG markup of a lucide icon, rendered once in a detached node. */
function iconMarkup(category: PlaceCategory): string {
  const host = document.createElement("div");
  const root = createRoot(host);
  flushSync(() => root.render(createElement(CATEGORY_STYLES[category].icon, { color: "#fff", strokeWidth: 2.25 })));
  const inner = host.querySelector("svg")?.innerHTML ?? "";
  root.unmount();
  return inner;
}

function markerSvg(category: PlaceCategory): string {
  const { color } = CATEGORY_STYLES[category];
  // Round badge in the category colour with a white ring and the white icon in the middle.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE * 2}" height="${SIZE * 2}" viewBox="0 0 36 36">
<circle cx="18" cy="18" r="16" fill="${color}" stroke="#fff" stroke-width="3"/>
<g transform="translate(9 9) scale(0.75)" fill="none" stroke="#fff" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${iconMarkup(category)}</g>
</svg>`;
}

function loadImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(SIZE * 2, SIZE * 2);
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** Registers one marker image per category on the map (idempotent). */
export async function addMarkerImages(map: MapLibreMap, categories: PlaceCategory[]) {
  await Promise.all(
    categories.map(async (c) => {
      const id = markerImageId(c);
      if (map.hasImage(id)) return;
      const img = await loadImage(markerSvg(c));
      if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: 2 });
    }),
  );
}
