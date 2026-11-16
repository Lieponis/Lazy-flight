// HOW THE SKY LOOKS (prototype G2). Turns the sky glow's light sums into picture data. Pure maths, no Three.js.
//
// Plain words: the sky glow holds "how much light comes from this direction" as plain numbers that span a huge range
// (the middle of the galaxy is hundreds of thousands of times brighter than the dark sky at the rim). To show them we
// take the logarithm (one step up = ten times brighter), squeeze the range into 0..1 ("level") and keep the colour
// tint. The SAME exposure is used at every place, so the rim sky really is darker than the centre sky.
//
// Each square is stored as 4 bytes: red, green, blue = the tint (hue) of the light, alpha = its brightness level.
// The sky shader turns that into the final colour (and mixes the 4 nearest squares so the glow is smooth and round, never blocky).
//
// Andy's choice: the galaxy back-drop is made of single DOTS (skydots.ts), and the glow is only a faint soft layer under them
// (look C). Looks A and B have no glow, to compare.

export type SkyLookId = "A" | "B" | "C";

/** The glow strengths the page offers for look C (low, medium = look C's own, high). */
export const GLOW_LEVELS = [0.14, 0.24, 0.35] as const;

export interface SkyLook {
  id: SkyLookId;
  label: string;
  /** How many back-drop dots are placed. */
  dots: number;
  /** How strong the soft glow under the dots is (0 = none, 1 = the full glow). */
  glow: number;
}

export const SKY_LOOKS: Record<SkyLookId, SkyLook> = {
  A: { id: "A", label: "DOTS ONLY", dots: 60000, glow: 0 },
  B: { id: "B", label: "DENSER DOTS", dots: 150000, glow: 0 },
  C: { id: "C", label: "DOTS + FAINT GLOW", dots: 60000, glow: 0.24 },
};

/** How light sums become brightness levels (the same for every look). */
export interface GlowCurve {
  /** Light below this (log10) is black; light above `logHigh` is full white. */
  logLow: number;
  logHigh: number;
  /** Above 1 keeps dark parts dark and makes the bright band stand out. */
  contrast: number;
  /** 0 = grey, 1 = the natural colour tint, above 1 = stronger colours. */
  saturation: number;
}

// A low contrast and a low `logLow` let even the dim light at the rim show as a soft haze around the thin band of dots (Andy's
// request); the glow strength (SKY_LOOKS) keeps the bright parts of the sky from turning into a brown wash.
export const GLOW_CURVE: GlowCurve = { logLow: -2.2, logHigh: 3.0, contrast: 0.7, saturation: 1.0 };

/** The game's space colour (src/settings.ts BACKGROUND_COLOR 0x05060d), as 0..255 red, green, blue. */
export const SPACE_RGB = [5, 6, 13] as const;
/** The brightest the glow gets (a slightly warm white). */
export const PEAK_RGB = [255, 244, 228] as const;

/** Brightness 0..1 of a light sum (red, green, blue). */
export function levelOf(r: number, g: number, b: number, curve: GlowCurve = GLOW_CURVE): number {
  const luma = 0.3 * r + 0.59 * g + 0.11 * b;
  if (!(luma > 1e-30)) return 0;
  const x = (Math.log10(luma) - curve.logLow) / (curve.logHigh - curve.logLow);
  const c = x <= 0 ? 0 : x >= 1 ? 1 : x;
  return Math.pow(c, curve.contrast);
}

/** Turns the raw sky glow into square data: red, green, blue = tint (the strongest colour is 255), alpha = level (0..255). */
export function skyToTexels(raw: Float32Array, curve: GlowCurve = GLOW_CURVE, out?: Uint8Array): Uint8Array {
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
      tr = Math.max(0, 1 + curve.saturation * (r / luma - 1));
      tg = Math.max(0, 1 + curve.saturation * (g / luma - 1));
      tb = Math.max(0, 1 + curve.saturation * (b / luma - 1));
    }
    const top = Math.max(tr, tg, tb, 1e-6);
    const o = t * 4;
    data[o] = Math.round((255 * tr) / top);
    data[o + 1] = Math.round((255 * tg) / top);
    data[o + 2] = Math.round((255 * tb) / top);
    data[o + 3] = Math.round(255 * levelOf(r, g, b, curve));
  }
  return data;
}

/** Final colour (0..255) of a glow sample (tint bytes and level byte, as `sampleRings` gives them) at glow strength `glow`. The shader does the same sum. */
export function shadeGlow(tr: number, tg: number, tb: number, levelByte: number, glow: number, out: number[]): void {
  const q = (levelByte / 255) * glow;
  out[0] = clampByte(SPACE_RGB[0] + ((PEAK_RGB[0] * tr) / 255 - SPACE_RGB[0]) * q);
  out[1] = clampByte(SPACE_RGB[1] + ((PEAK_RGB[1] * tg) / 255 - SPACE_RGB[1]) * q);
  out[2] = clampByte(SPACE_RGB[2] + ((PEAK_RGB[2] * tb) / 255 - SPACE_RGB[2]) * q);
}

function clampByte(v: number): number {
  return v <= 0 ? 0 : v >= 255 ? 255 : Math.round(v);
}
