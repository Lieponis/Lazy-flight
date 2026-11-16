// STAND-IN NEAR STARS (prototype G2). Pure maths, no Three.js, deterministic.
//
// Plain words: the real game will get its nearby systems from Agent 2's generator. Until then this makes made-up stars
// around the player with the same kind of data (a position, a star type colour, an id), so the map can be tested.
// The swap later is: replace `makeNearStars` by a function that returns the same `NearStars` shape from the real generator.

import { mulberry } from "./hash";
import { nearRadiusFor } from "./skyglow";

/** Star types and their colours: the same list as the game (src/universe/system.ts). */
export const STAR_TYPES = [
  { label: "Red dwarf", color: "#ff5a3c", radius: 0.5, weight: 30 },
  { label: "Orange star", color: "#ff9a3c", radius: 0.8, weight: 22 },
  { label: "Yellow star", color: "#ffe14a", radius: 1.0, weight: 22 },
  { label: "White star", color: "#f4f8ff", radius: 1.3, weight: 12 },
  { label: "Blue star", color: "#58a6ff", radius: 1.8, weight: 8 },
  { label: "Red giant", color: "#ff3b2f", radius: 3.0, weight: 6 },
] as const;

/** The three spacings the preview can switch between: centre-like, start-like (Andy's start), outer. */
export const DENSITY_SPACINGS = [2, 8.6, 30] as const;

export interface NearStars {
  count: number;
  /** Positions in light years, relative to the player (x, y, z), nearest star first. */
  positions: Float32Array;
  /** Distance of each star from the player (light years), nearest first (so index = rank). */
  distances: Float32Array;
  /** Star colour (red, green, blue, each 0..1). */
  colors: Float32Array;
  /** Star size class (the game's star radius). */
  radii: Float32Array;
  /** A made-up id per star: the rank by distance (0 = nearest). */
  ids: Uint32Array;
  /** Distance of the farthest star. */
  radius: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const TYPE_TOTAL = STAR_TYPES.reduce((sum, t) => sum + t.weight, 0);

/**
 * `count` stars spread evenly through a ball around the player, `spacing` light years apart on average
 * (the ball's size follows from that). Sorted nearest first. Same `seed` = same stars.
 */
export function makeNearStars(count: number, spacing: number, seed: number): NearStars {
  const radius = nearRadiusFor(spacing, count);
  const rand = mulberry(seed);
  const px = new Float32Array(count);
  const py = new Float32Array(count);
  const pz = new Float32Array(count);
  const d = new Float32Array(count);
  const type = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const r = radius * Math.cbrt(rand());
    const cosT = rand() * 2 - 1;
    const sinT = Math.sqrt(1 - cosT * cosT);
    const a = rand() * Math.PI * 2;
    px[i] = r * sinT * Math.cos(a);
    py[i] = r * cosT;
    pz[i] = r * sinT * Math.sin(a);
    d[i] = r;
    let pick = rand() * TYPE_TOTAL;
    let t = 0;
    while (t < STAR_TYPES.length - 1 && pick >= (STAR_TYPES[t]?.weight ?? 0)) {
      pick -= STAR_TYPES[t]?.weight ?? 0;
      t++;
    }
    type[i] = t;
  }
  // Rank by distance.
  const order = Array.from({ length: count }, (_, i) => i).sort((a, b) => (d[a] ?? 0) - (d[b] ?? 0));
  const positions = new Float32Array(count * 3);
  const distances = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const radii = new Float32Array(count);
  const ids = new Uint32Array(count);
  const palette = STAR_TYPES.map((t) => hexToRgb(t.color));
  order.forEach((src, rank) => {
    positions[rank * 3] = px[src] ?? 0;
    positions[rank * 3 + 1] = py[src] ?? 0;
    positions[rank * 3 + 2] = pz[src] ?? 0;
    distances[rank] = d[src] ?? 0;
    const tp = type[src] ?? 0;
    const c = palette[tp] ?? [1, 1, 1];
    colors[rank * 3] = c[0];
    colors[rank * 3 + 1] = c[1];
    colors[rank * 3 + 2] = c[2];
    radii[rank] = STAR_TYPES[tp]?.radius ?? 1;
    ids[rank] = rank;
  });
  return { count, positions, distances, colors, radii, ids, radius: distances[count - 1] ?? 0 };
}

/** How many of the (nearest first) stars lie within `reachLy`. Binary search on the sorted distances. */
export function countWithin(stars: NearStars, reachLy: number): number {
  let lo = 0;
  let hi = stars.count;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((stars.distances[mid] ?? 0) <= reachLy) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The unit directions (x, y, z) of the nearest `n` stars, as seen from the player. Used to keep fake sky dots off real stars. */
export function directionsOf(stars: NearStars, n: number): Float32Array {
  const m = Math.min(n, stars.count);
  const out = new Float32Array(m * 3);
  for (let i = 0; i < m; i++) {
    const d = stars.distances[i] || 1;
    out[i * 3] = (stars.positions[i * 3] ?? 0) / d;
    out[i * 3 + 1] = (stars.positions[i * 3 + 1] ?? 0) / d;
    out[i * 3 + 2] = (stars.positions[i * 3 + 2] ?? 0) / d;
  }
  return out;
}
