// THE PALETTE: every colour a model may use, plus the rules for planet-tinted parts.
// Change a number here and every model that uses that colour changes with it.

export interface Swatch {
  key: string;
  hex: number;
  name: string;
  use: string;
  /** Glow colours are never shaded (lights, windows, engine flames). */
  glow?: boolean;
}

export const PAL = {
  // Hull family: cool lavender greys, the same family the game already uses.
  hullWhite: 0xe3e7ff,
  hullLight: 0xc9d0f2,
  hullMid: 0x8d99c9,
  hullDark: 0x5a6290,
  frame: 0x3a3f66,
  // Ship paint (revision 1, Andy: white/grey hulls with company marks, less cartoonish).
  paintWhite: 0xe6e8ec,
  paintGrey: 0xa7adb8,
  metalDark: 0x4b505c,
  underside: 0x33363e,
  glassDark: 0x24405e,
  // Toy accents: big, bold, one or two per model.
  orange: 0xff8a3d,
  teal: 0x3dd6c6,
  yellow: 0xffd23d,
  red: 0xe8483a,
  blue: 0x4fa8ff,
  pink: 0xff7fae,
  rust: 0xa8643c,
  // Glow (never shaded).
  window: 0xfff0b8,
  engine: 0xffb347,
  lightRed: 0xff5a3c,
  lightGreen: 0x7dff8a,
  glass: 0x9fe6ff,
  cyan: 0x3fe0ff,
} as const;

export type PalKey = keyof typeof PAL;

export const SWATCHES: Swatch[] = [
  { key: "hullWhite", hex: PAL.hullWhite, name: "Hull white", use: "Top surfaces, liner hulls" },
  { key: "hullLight", hex: PAL.hullLight, name: "Hull light", use: "Main hull of most ships" },
  { key: "hullMid", hex: PAL.hullMid, name: "Hull mid", use: "Side panels, station modules" },
  { key: "hullDark", hex: PAL.hullDark, name: "Hull dark", use: "Engines, undersides" },
  { key: "frame", hex: PAL.frame, name: "Frame", use: "Struts, pads, racks" },
  { key: "paintWhite", hex: PAL.paintWhite, name: "Ship white", use: "Main paint of ships" },
  { key: "paintGrey", hex: PAL.paintGrey, name: "Ship grey", use: "Wings, engine pods" },
  { key: "metalDark", hex: PAL.metalDark, name: "Dark metal", use: "Engines, frames, intakes" },
  { key: "underside", hex: PAL.underside, name: "Underside", use: "Industrial belly plates" },
  { key: "glassDark", hex: PAL.glassDark, name: "Dark glass", use: "Cockpit panes (shaded)" },
  { key: "orange", hex: PAL.orange, name: "Cargo orange", use: "Containers, hauler stripes" },
  { key: "teal", hex: PAL.teal, name: "Teal", use: "Containers, trims" },
  { key: "yellow", hex: PAL.yellow, name: "Hazard yellow", use: "Pad markings, liner stripe" },
  { key: "red", hex: PAL.red, name: "Toy red", use: "Scout paint, fins" },
  { key: "blue", hex: PAL.blue, name: "Solar blue", use: "Solar panels" },
  { key: "pink", hex: PAL.pink, name: "Oops pink", use: "One mismatched panel (the joke)" },
  { key: "rust", hex: PAL.rust, name: "Old rust", use: "Patched plates, crates" },
  { key: "window", hex: PAL.window, name: "Window glow", use: "Lit windows", glow: true },
  { key: "engine", hex: PAL.engine, name: "Engine glow", use: "Exhaust and flames", glow: true },
  { key: "lightRed", hex: PAL.lightRed, name: "Red light", use: "Blinking beacons", glow: true },
  { key: "lightGreen", hex: PAL.lightGreen, name: "Green light", use: "Pad and bay lights", glow: true },
  { key: "cyan", hex: PAL.cyan, name: "Cyan light", use: "Passenger hub light strips and sign", glow: true },
  { key: "glass", hex: PAL.glass, name: "Glass", use: "Cockpit bubbles, domes", glow: true },
];

/** Planet tint examples for the viewer (roughly one per planet type). */
export const TINT_EXAMPLES: { name: string; hex: number }[] = [
  { name: "Rocky", hex: 0xb5653a },
  { name: "Desert", hex: 0xe0a743 },
  { name: "Ocean", hex: 0x2f86c9 },
  { name: "Ice", hex: 0xbfe6f2 },
  { name: "Lava", hex: 0xe0442a },
  { name: "Jungle", hex: 0x3fae4a },
  { name: "Barren", hex: 0x8a8378 },
  { name: "Gas", hex: 0xc78bd9 },
];

export const DEFAULT_TINT = 0xb5653a;

// ---------------------------------------------------------------- tint rules

function rgbToHsl(hex: number): [number, number, number] {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): number {
  const f = (n: number): number => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const to = (v: number): number => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return (to(f(0)) << 16) | (to(f(8)) << 8) | to(f(4));
}

/**
 * The planet colour made safe for buildings: never too dark (it would vanish in space),
 * never washed out, never neon. Saturation 35-80%, lightness 40-65%.
 */
export function safeTint(hex: number): number {
  const [h, s, l] = rgbToHsl(hex >>> 0);
  return hslToRgb(h, Math.min(0.8, Math.max(0.35, s)), Math.min(0.65, Math.max(0.4, l)));
}

/** A darker partner of the tint, for trims and roofs (lightness x 0.65). */
export function safeTintDark(hex: number): number {
  const [h, s, l] = rgbToHsl(safeTint(hex));
  return hslToRgb(h, s, l * 0.65);
}

/** Turns "ff8844" or "#ff8844" into a number. Anything else gives null. */
export function parseHexColor(text: string | null | undefined): number | null {
  if (!text) return null;
  const t = text.startsWith("#") ? text.slice(1) : text;
  return /^[0-9a-fA-F]{6}$/.test(t) ? parseInt(t, 16) : null;
}

export function toHexText(hex: number): string {
  return (hex >>> 0).toString(16).padStart(6, "0");
}
