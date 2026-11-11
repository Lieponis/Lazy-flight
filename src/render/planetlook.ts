// PLANET LOOKS (Agent 7c, Andy's option B "No Man's Sky mix", 2026-11-11). Pure: no Three.js, easy to test.
//
// Hard rule (Lead): src/universe output never changes. A planet's LOOK is picked here, in the render layer,
// from a hash of its id plus its existing fields (type, colours). Same planet id = same look, on every device, forever.
//
// What B adds on top of each planet type's own colours:
// - about 1 in 3 planets get a surprising colour set (pink jungles, purple seas, toxic-green deserts...)
// - continents / patches from smooth noise, ice caps on some poles, craters on rocky, barren and ice worlds
// - cloud patches on most ocean and jungle worlds; storm stripes and swirls on gas giants
// - rings on about 8 % of planets: 2 to 5 bands, different widths, sometimes gaps, grounded rock colours

export type Rgb = [number, number, number];

export interface RingBand {
  inner: number; // times the planet radius
  outer: number;
  colour: Rgb;
  opacity: number;
}

export interface PlanetLook {
  exotic: boolean;
  primary: Rgb;
  secondary: Rgb;
  accent: Rgb;
  caps: number; // 0 = none, else how far from the equator the caps start (0.75..0.9)
  clouds: boolean;
  craters: { x: number; y: number; z: number; r: number }[];
  swirl: number; // gas giants: how much the stripes wiggle
  rings: RingBand[] | null;
  ringTilt: { x: number; y: number };
  noiseSeed: number;
}

/** About 8 % of planets have rings (Andy: 5 to 10 %, random which). */
export const RING_CHANCE = 0.08;
/** About 1 in 3 planets get a surprising colour set (option B). */
export const EXOTIC_CHANCE = 0.33;

/** Grounded space-rock tones for rings (Andy): tan, beige, grey, brown. */
export const RING_COLOURS: readonly Rgb[] = [
  [0.79, 0.71, 0.58],
  [0.62, 0.56, 0.49],
  [0.86, 0.8, 0.69],
  [0.45, 0.4, 0.35],
  [0.72, 0.62, 0.48],
  [0.66, 0.64, 0.6],
];

// ------------------------------------------------------------------ deterministic helpers

/** FNV-1a hash of a text: the same id always gives the same number. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A small random-number stream from a seed number (same seed, same numbers). */
export function streamFrom(seed: number): () => number {
  let s = seed >>> 0 || 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

function hash3(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Smooth 3D noise, 0..1. */
export function noise3(x: number, y: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const sm = (t: number): number => t * t * (3 - 2 * t);
  const u = sm(x - xi);
  const v = sm(y - yi);
  const w = sm(z - zi);
  const L = (a: number, b: number, t: number): number => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number): number => hash3(xi + dx, yi + dy, zi + dz, seed);
  return L(
    L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v),
    L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

/** Three layers of noise: big shapes with smaller wiggles. 0..1. */
export function fbm3(x: number, y: number, z: number, seed: number): number {
  return 0.6 * noise3(x, y, z, seed) + 0.3 * noise3(x * 2.1, y * 2.1, z * 2.1, seed + 7) + 0.1 * noise3(x * 4.3, y * 4.3, z * 4.3, seed + 13);
}

// ------------------------------------------------------------------ colours

export function hexToRgb(hex: string): Rgb {
  const t = hex.startsWith("#") ? hex.slice(1) : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(t)) return [1, 1, 1];
  const n = parseInt(t, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h /= 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const f = (n: number): number => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

/** Turns the colour wheel by `turn` (0..1) and pushes saturation up a bit: the "surprising" colours. */
export function shiftHue(c: Rgb, turn: number, satBoost = 0.15): Rgb {
  const [h, s, l] = rgbToHsl(c);
  return hslToRgb((((h + turn) % 1) + 1) % 1, Math.min(1, s + satBoost), l);
}

export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// ------------------------------------------------------------------ choosing a look

export interface PlanetForLook {
  id: string;
  type: string;
  colors: { primary: string; secondary: string; accent: string };
}

const CAP_TYPES = new Set(["ROCKY", "OCEAN", "JUNGLE", "BARREN", "DESERT", "ICE"]);
const CRATER_TYPES = new Set(["ROCKY", "BARREN", "ICE"]);
const CLOUD_TYPES = new Set(["OCEAN", "JUNGLE"]);
/** Surprising turns of the colour wheel (a quarter, a third, ...), so exotic colours really differ. */
const EXOTIC_TURNS = [0.25, 0.33, 0.5, 0.62, 0.75, 0.85];

export function chooseLook(planet: PlanetForLook): PlanetLook {
  const seed = hashString(`look:${planet.id}`);
  const r = streamFrom(seed);
  const exotic = r() < EXOTIC_CHANCE;
  const turn = EXOTIC_TURNS[Math.floor(r() * EXOTIC_TURNS.length)]!;
  const base = (hex: string): Rgb => (exotic ? shiftHue(hexToRgb(hex), turn) : hexToRgb(hex));
  const caps = CAP_TYPES.has(planet.type) && r() < (planet.type === "ICE" ? 0.8 : 0.55) ? 0.75 + r() * 0.15 : 0;
  const clouds = CLOUD_TYPES.has(planet.type) && r() < 0.8;
  const craters: PlanetLook["craters"] = [];
  if (CRATER_TYPES.has(planet.type) && r() < 0.8) {
    const count = 4 + Math.floor(r() * 5);
    for (let i = 0; i < count; i++) {
      const x = r() - 0.5;
      const y = r() - 0.5;
      const z = r() - 0.5;
      const len = Math.hypot(x, y, z) || 1;
      craters.push({ x: x / len, y: y / len, z: z / len, r: 0.16 + r() * 0.24 });
    }
  }
  const swirl = planet.type === "GAS" ? (r() < 0.6 ? 0.9 + r() * 0.8 : 0.2 + r() * 0.2) : 0;
  // Rings: decided by their own hash, so they are spread evenly whatever else the planet has.
  const rr = streamFrom(hashString(`rings:${planet.id}`));
  let rings: RingBand[] | null = null;
  if (rr() < RING_CHANCE) {
    rings = [];
    const bands = 2 + Math.floor(rr() * 4); // 2..5 bands
    let inner = 1.25 + rr() * 0.3;
    const total = 0.25 + rr() * 0.85; // Andy: rings in a variety of widths
    const parts = Array.from({ length: bands }, () => 0.4 + rr());
    const sum = parts.reduce((a, b) => a + b, 0);
    for (const part of parts) {
      const w = (part / sum) * total;
      const gap = rr() < 0.5 ? w * (0.08 + rr() * 0.2) : 0; // gaps like Saturn's
      rings.push({ inner: inner + gap, outer: inner + w, colour: RING_COLOURS[Math.floor(rr() * RING_COLOURS.length)]!, opacity: 0.7 + rr() * 0.3 });
      inner += w;
    }
  }
  return {
    exotic,
    primary: base(planet.colors.primary),
    secondary: base(planet.colors.secondary),
    accent: base(planet.colors.accent),
    caps,
    clouds,
    craters,
    swirl,
    rings,
    ringTilt: { x: 0.25 + rr() * 0.45, y: (rr() - 0.5) * 0.6 },
    noiseSeed: seed % 100000,
  };
}

// ------------------------------------------------------------------ the colour of one patch of surface

const CAP_COLOUR: Rgb = [0.93, 0.95, 1];
const CLOUD_THRESHOLD = 0.62;

/** The colour (before light and shadow) of the surface patch facing direction (nx, ny, nz), a unit vector. */
export function surfaceColour(type: string, look: PlanetLook, nx: number, ny: number, nz: number): Rgb {
  const s = look.noiseSeed;
  let c: Rgb;
  if (type === "GAS") {
    const warp = fbm3(nx * 2, ny * 2, nz * 2, s) * look.swirl;
    const band = Math.sin(ny * 11 + warp * 3);
    c = band > 0.35 ? look.secondary : band > -0.3 ? mixRgb(look.primary, look.secondary, 0.5) : look.primary;
  } else {
    const h = fbm3(nx * 2.2 + 3, ny * 2.2, nz * 2.2, s);
    const threshold = type === "OCEAN" ? 0.55 : type === "JUNGLE" ? 0.44 : 0.5;
    c = h > threshold ? look.secondary : look.primary;
    if (type === "DESERT" && h > 0.66) c = mixRgb(look.secondary, [1, 1, 1], 0.25); // pale dunes
    if (type === "JUNGLE" && h < 0.3) c = mixRgb(look.primary, [0.12, 0.3, 0.55], 0.55); // lakes and swamps
    if (type === "LAVA" && Math.abs(h - 0.5) < 0.05) c = mixRgb(look.primary, [1, 0.85, 0.3], 0.6); // bright lava rivers (no glow in B)
  }
  for (const k of look.craters) {
    const d = Math.hypot(nx - k.x, ny - k.y, nz - k.z);
    if (d < k.r * 0.7) c = [c[0] * 0.7, c[1] * 0.7, c[2] * 0.7];
    else if (d < k.r) c = mixRgb(c, [1, 1, 1], 0.15);
  }
  if (look.caps > 0 && Math.abs(ny) > look.caps) c = CAP_COLOUR;
  return c;
}

/** True where the cloud shell has a cloud (direction nx, ny, nz). */
export function hasCloud(look: PlanetLook, nx: number, ny: number, nz: number): boolean {
  return look.clouds && fbm3(nx * 2.5 + 9, ny * 4, nz * 2.5, look.noiseSeed + 31) > CLOUD_THRESHOLD;
}
