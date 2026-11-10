// THE PS1 PIXEL LOOK, the numbers part (stage 3e). No graphics here, so it can be tested.
// The look has three dials, each one number where 0 means "off": colour bands, dither and grain. (Vertex wobble was tried and removed: Andy asked for it to go.)
//   bands  - how many shades each colour has (PS1-style fewer shades = visible steps in dark gradients). 0 = off.
//   dither - 0..1, mixes the steps with a fixed tiny checker pattern so the steps look "woven" instead of smooth. 0 = off.
//   grain  - 0..0.1, a little flickering noise over the picture. 0 = off.

export type LookStyle = "off" | "A" | "B" | "C";
/** The looks Andy compares (A = gentle, B = in between, C = strong). */
export const LOOK_STYLES: readonly LookStyle[] = ["off", "A", "B", "C"];

export interface LookSettings {
  bands: number;
  dither: number;
  grain: number;
}

/** The three strengths. */
export function lookPreset(style: LookStyle): LookSettings {
  switch (style) {
    case "A":
      return { bands: 48, dither: 0.5, grain: 0 };
    case "B":
      return { bands: 24, dither: 1, grain: 0.02 };
    case "C":
      return { bands: 12, dither: 1, grain: 0.045 };
    default:
      return { bands: 0, dither: 0, grain: 0 };
  }
}

/** True if the picture needs the extra pixel-look pass at all (all dials at 0 = no cost). */
export function lookActive(s: LookSettings): boolean {
  return s.bands > 1 || s.grain > 0;
}

/** ?look=A|B|C|off from the web address, or null. */
export function parseLook(search: string): LookStyle | null {
  const m = /[?&]look=([a-z]+)/i.exec(search);
  const v = m?.[1]?.toLowerCase();
  if (v === "off") return "off";
  if (v === "a" || v === "b" || v === "c") return v.toUpperCase() as LookStyle;
  return null;
}

/** ?lookpreview=1 shows the buttons for comparing looks (anything but 0 or false). */
export function parseLookPreview(search: string): boolean {
  const m = /[?&]lookpreview=([^&]*)/i.exec(search);
  if (!m) return false;
  const v = (m[1] ?? "").toLowerCase();
  return v !== "0" && v !== "false";
}

/** The tiny fixed checker pattern (4 x 4), 0..1. The graphics card does the same sum; this copy is for tests. */
export function bayer4(x: number, y: number): number {
  const d2 = (a: number, b: number): number => {
    const fx = Math.floor(a);
    const fy = Math.floor(b);
    const v = fx * 0.5 + fy * fy * 0.75;
    return v - Math.floor(v);
  };
  return d2(x * 0.5, y * 0.5) * 0.25 + d2(x, y) + 1 / 32; // 1/32 .. 31/32
}

/** One colour channel (0..1) cut into `bands` shades; `dither` 0..1 blends plain rounding with the checker pattern. */
export function quantize(value: number, bands: number, pattern: number, dither: number): number {
  if (bands < 2) return value;
  const n = bands - 1;
  const t = 0.5 + (pattern - 0.5) * dither;
  return Math.min(1, Math.max(0, Math.floor(value * n + t) / n));
}

/** A number cut into `steps` chunky steps (0 steps = smooth, unchanged). Used for the warp flash and the flame flicker. */
export function stepped(value: number, steps: number): number {
  if (steps < 1) return value;
  return Math.round(value * steps) / steps;
}

/**
 * Flame flicker: the flame length is multiplied by a few fixed sizes that change about `rate` times a second (chunky, not smooth).
 * `amount` 0 = steady flame. Returns a number around 1.
 */
export function flameFlicker(t: number, amount: number, rate = 10): number {
  if (amount <= 0) return 1;
  const tick = Math.floor(t * rate);
  const h = Math.sin(tick * 12.9898 + 78.233) * 43758.5453;
  const r = h - Math.floor(h); // 0..1, the same for the same tick
  const level = Math.floor(r * 3) - 1; // -1, 0 or 1
  return 1 + level * amount;
}
