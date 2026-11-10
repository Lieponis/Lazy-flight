// THE WARP, the numbers (pure logic: no Three.js, so it can be tested).
// Andy's brief for warp: three main colours (blue, purple, violet, toned to deep space) that change slowly in intensity and tone;
// dense stars shooting around with randomised trails; no hexagons, no geometric shapes.

export type WarpStyle = "A" | "B" | "C";
export const WARP_STYLES: readonly WarpStyle[] = ["A", "B", "C"];

/** ?warp=A, ?warp=B or ?warp=C picks the warp look (a testing aid). Anything else gives null. */
export function parseWarpStyle(search: string): WarpStyle | null {
  const v = new URLSearchParams(search).get("warp")?.trim().toUpperCase();
  return v === "A" || v === "B" || v === "C" ? v : null;
}

/** ?warppreview=1 opens straight into an endless warp, with buttons to compare the looks (a testing aid). */
export function parseWarpPreview(search: string): boolean {
  const v = new URLSearchParams(search).get("warppreview");
  return v !== null && v !== "0" && v.toLowerCase() !== "false";
}

export interface Hsl {
  h: number; // 0..1
  s: number;
  l: number;
}

const TAU = Math.PI * 2;

/** [base, how far it drifts, seconds for one full drift] for hue and lightness of each of the three colours. */
const COLOURS = [
  { h: 0.6, s: 0.88, l: 0.55, dh: 0.035, dl: 0.09, ph: 47, pl: 53, o: 0 }, // blue
  { h: 0.74, s: 0.78, l: 0.5, dh: 0.035, dl: 0.09, ph: 71, pl: 89, o: 2.1 }, // purple
  { h: 0.81, s: 0.72, l: 0.58, dh: 0.03, dl: 0.09, ph: 97, pl: 61, o: 4.3 }, // violet
] as const;

/** The three warp colours `t` seconds into the warp. They drift slowly (minutes per cycle) and never leave blue, purple and violet. */
export function warpPalette(t: number): [Hsl, Hsl, Hsl] {
  const out = COLOURS.map((c) => ({
    h: c.h + c.dh * Math.sin((TAU * (t + c.o * 10)) / c.ph),
    s: c.s,
    l: c.l + c.dl * Math.sin((TAU * (t + c.o * 7)) / c.pl),
  }));
  return out as [Hsl, Hsl, Hsl];
}

/** How strong the whole warp glows, 0.75..1, a very slow swell. */
export function warpIntensity(t: number): number {
  return 0.875 + 0.125 * Math.sin((TAU * t) / 113);
}

function hash01(n: number): number {
  let h = Math.imul(Math.floor(n) ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Surges: about every `period` seconds the warp surges for about five seconds (trails stretch, stars speed up, colours brighten).
 * Returns 0..1. The moment inside each round changes from round to round, so it never feels like a metronome.
 */
export function warpPulse(t: number, period = 25, seed = 1): number {
  const time = Math.max(0, t);
  const round = Math.floor(time / period);
  const start = round * period + period * (0.2 + 0.5 * hash01(round * 7 + seed));
  const dt = time - start;
  if (dt < 0 || dt > 5) return 0;
  const smooth = (x: number): number => x * x * (3 - 2 * x);
  return dt < 2 ? smooth(dt / 2) : smooth(1 - (dt - 2) / 3);
}

export interface WarpStreakData {
  /** x, y, z0 for both ends of every streak (the two ends share one spot; the shader stretches them). */
  positions: Float32Array;
  end: Float32Array; // 0 = tail, 1 = head, per vertex
  speed: Float32Array; // per vertex
  length: Float32Array;
  tint: Float32Array; // 0..1 picks a colour between the three
  bright: Float32Array;
}

/** All the stars of the warp, made once. Same numbers every time (seeded). Trails: many short, a few long, each with its own speed. */
export function warpStreakData(count: number, span: number, minRadius: number, maxRadius: number, seed = 20261110): WarpStreakData {
  let s = seed >>> 0 || 1;
  const next = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const positions = new Float32Array(count * 6);
  const end = new Float32Array(count * 2);
  const speed = new Float32Array(count * 2);
  const length = new Float32Array(count * 2);
  const tint = new Float32Array(count * 2);
  const bright = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const angle = next() * TAU;
    const radius = minRadius + (maxRadius - minRadius) * Math.pow(next(), 0.75);
    const z0 = next() * span;
    const r = next();
    const len = 0.6 + r * r * r * 26; // many short trails, a few very long ones
    const v = 0.6 + next();
    const tn = next();
    const br = 0.35 + next() * 0.65;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    positions.set([x, y, z0, x, y, z0], i * 6);
    for (let k = 0; k < 2; k++) {
      end[i * 2 + k] = k;
      speed[i * 2 + k] = v;
      length[i * 2 + k] = len;
      tint[i * 2 + k] = tn;
      bright[i * 2 + k] = br;
    }
  }
  return { positions, end, speed, length, tint, bright };
}
