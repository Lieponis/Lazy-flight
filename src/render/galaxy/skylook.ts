// HOW THE SKY LOOKS (prototype G2). Turns the sky cube's light sums into picture data. Pure maths, no Three.js.
//
// Plain words: the sky cube holds "how much light comes from this direction" as plain numbers that span a huge range
// (the middle of the galaxy is hundreds of thousands of times brighter than the dark sky at the rim). To show them we
// take the logarithm (one step up = ten times brighter), squeeze the range into 0..1 ("level") and keep the colour
// tint. The SAME exposure is used at every place, so the rim sky really is darker than the centre sky.
//
// Each texel is stored as 4 bytes: red, green, blue = the tint (hue) of the light, alpha = its brightness level.
// The final colour (with brightness steps and dot patterns) is worked out per screen pixel by the sky shader, and by
// `shadeTexel` below, which does the same sum for tests and for the pictures I check offline.

export type SkyLookId = "A" | "B" | "C";

export interface SkyLook {
  id: SkyLookId;
  label: string;
  /** Light below this (log10) is black; light above `logHigh` is full white. */
  logLow: number;
  logHigh: number;
  /** Above 1 keeps dark parts dark and makes the bright band stand out. */
  contrast: number;
  /** 0 = grey, 1 = the natural colour tint, above 1 = stronger colours. */
  saturation: number;
  /** Number of brightness steps (0 = smooth, no steps). */
  steps: number;
  /** True: mix neighbouring steps with a fixed dot pattern over the screen pixels (an "ordered dither"), the look of old 3D consoles. */
  dither: boolean;
  /** Faint single stars drawn on top of the glow (how many at most). */
  faintStars: number;
}

export const SKY_LOOKS: Record<SkyLookId, SkyLook> = {
  A: { id: "A", label: "SMOOTH GLOW", logLow: -1.1, logHigh: 3.0, contrast: 1.6, saturation: 1.0, steps: 0, dither: false, faintStars: 6000 },
  B: { id: "B", label: "BANDED", logLow: -1.1, logHigh: 3.0, contrast: 1.5, saturation: 1.2, steps: 6, dither: false, faintStars: 9000 },
  C: { id: "C", label: "DOTTED", logLow: -1.1, logHigh: 3.0, contrast: 1.5, saturation: 1.1, steps: 5, dither: true, faintStars: 9000 },
};

/** The game's space colour (src/settings.ts BACKGROUND_COLOR 0x05060d), as 0..255 red, green, blue. */
export const SPACE_RGB = [5, 6, 13] as const;
/** The brightest the glow gets (a slightly warm white). */
export const PEAK_RGB = [255, 244, 228] as const;

/** The 4x4 dot pattern (Bayer matrix), numbers 0..15. The sky shader has the same table. */
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

/** Brightness 0..1 of a light sum (red, green, blue), before steps. */
export function levelOf(r: number, g: number, b: number, look: SkyLook): number {
  const luma = 0.3 * r + 0.59 * g + 0.11 * b;
  if (!(luma > 1e-30)) return 0;
  const x = (Math.log10(luma) - look.logLow) / (look.logHigh - look.logLow);
  const c = x <= 0 ? 0 : x >= 1 ? 1 : x;
  return Math.pow(c, look.contrast);
}

/** Turns the raw sky cube into texel data: red, green, blue = tint (the strongest colour is 255), alpha = level (0..255). */
export function skyToTexels(raw: Float32Array, look: SkyLook, out?: Uint8Array): Uint8Array {
  const count = raw.length / 3;
  const data = out ?? new Uint8Array(count * 4);
  for (let t = 0; t < count; t++) {
    const r = raw[t * 3] ?? 0;
    const g = raw[t * 3 + 1] ?? 0;
    const b = raw[t * 3 + 2] ?? 0;
    const luma = 0.3 * r + 0.59 * g + 0.11 * b;
    let tr = 1;
    let tg = 1;
    let tb = 1;
    if (luma > 1e-30) {
      tr = Math.max(0, 1 + look.saturation * (r / luma - 1));
      tg = Math.max(0, 1 + look.saturation * (g / luma - 1));
      tb = Math.max(0, 1 + look.saturation * (b / luma - 1));
    }
    const top = Math.max(tr, tg, tb, 1e-6);
    const o = t * 4;
    data[o] = Math.round((255 * tr) / top);
    data[o + 1] = Math.round((255 * tg) / top);
    data[o + 2] = Math.round((255 * tb) / top);
    data[o + 3] = Math.round(255 * levelOf(r, g, b, look));
  }
  return data;
}

/** The brightness (0..1) after steps and dots, for the screen pixel (px, py). The sky shader does exactly this. */
export function quantise(level: number, look: SkyLook, px: number, py: number): number {
  if (look.steps <= 0) return level;
  const threshold = look.dither ? ((BAYER4[(py & 3) * 4 + (px & 3)] ?? 0) + 0.5) / 16 : 0.5;
  const step = Math.floor(level * look.steps + threshold);
  return Math.min(1, step / look.steps);
}

/** Final colour (0..255) of a texel on screen pixel (px, py). */
export function shadeTexel(tr: number, tg: number, tb: number, levelByte: number, look: SkyLook, px: number, py: number, out: number[]): void {
  const q = quantise(levelByte / 255, look, px, py);
  out[0] = clampByte(SPACE_RGB[0] + ((PEAK_RGB[0] * tr) / 255 - SPACE_RGB[0]) * q);
  out[1] = clampByte(SPACE_RGB[1] + ((PEAK_RGB[1] * tg) / 255 - SPACE_RGB[1]) * q);
  out[2] = clampByte(SPACE_RGB[2] + ((PEAK_RGB[2] * tb) / 255 - SPACE_RGB[2]) * q);
}

function clampByte(v: number): number {
  return v <= 0 ? 0 : v >= 255 ? 255 : Math.round(v);
}
