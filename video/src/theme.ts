import { loadFont } from "@remotion/google-fonts/Onest";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

// Same type and colours as the app (app/src/app/globals.css).
export const { fontFamily: FONT } = loadFont("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin", "latin-ext"] });
export const { fontFamily: MONO } = loadMono("normal", { weights: ["500", "600"], subsets: ["latin", "latin-ext"] });

export const C = {
  red: "#c90f1a",
  redStrong: "#9b0d16",
  redSoft: "#fbeeec",
  redMid: "#f3c9c5",
  cream: "#f6f3f0",
  white: "#ffffff",
  ink: "#2a1a19",
  muted: "#7a6663",
  skin: "#f2c2a0",
  skinDark: "#c68863",
  hair: "#3a2522",
  denim: "#3d4a6b",
  green: "#2f8a4c",
} as const;

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
