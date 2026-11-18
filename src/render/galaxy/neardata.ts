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
  /**
   * One id per star. The preview page makes up the rank by distance (0 = nearest); the game's map gets the real system numbers,
   * which go up to about 4.7e10 (more than a 32-bit whole number holds), so this is any list of numbers.
   */
  ids: ArrayLike<number>;
  /**
   * Radius of the near-star bubble (light years): no star lies farther, and the fade-out at the edge, the camera's far plane and
   * the sky's start all follow it. It is the same with or without a shape (the shape only thins stars out inside the ball).
   */
  radius: number;
  /** How many stars a full, un-thinned ball of this size holds (the `count` asked for). `count` is smaller when a shape thinned it. */
  ballCount: number;
  /**
   * The distance (light years) at which a full, un-thinned ball of stars holds ZOOM_REFERENCE_STARS stars. The "near" zoom-out limit
   * follows it, so the limit is the same with or without a shape (Andy approved it at the rim: about 829 ly).
   */
  zoomNearLy: number;
  /**
   * The typical gap between neighbouring stars here (light years), when the source knows it (the game's map does; the G2 preview does
   * not). The diamonds are never bigger than a share of it, so they do not cover each other where the stars are packed (the dense centre).
   */
  spacingLy?: number;
}

/** How many stars of a full ball the "near" zoom-out limit reaches out to (see `NearStars.zoomNearLy`). */
export const ZOOM_REFERENCE_STARS = 1000;

/**
 * A shape that thins the stars out like the galaxy does. `origin` is where the player stands in the galaxy (light years);
 * `keep(x, y, z)` gives, for a point in galaxy coordinates, the share (0..1) of the full star density that is left there.
 * The mid-plane density (and so the spacing) is not changed: a shape only removes stars, never adds or moves them.
 */
export interface NearShape {
  origin: { x: number; y: number; z: number };
  keep(x: number, y: number, z: number): number;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const TYPE_TOTAL = STAR_TYPES.reduce((sum, t) => sum + t.weight, 0);

/**
 * `count` stars spread evenly through a ball around the player, `spacing` light years apart on average
 * (the ball's size follows from that). Sorted nearest first. Same `seed` = same stars.
 *
 * With a `shape`, the ball is first made exactly as without one, then every star is kept or dropped by chance in proportion to
 * `shape.keep` at its place: so the result is always a subset of the plain ball (same stars, same colours), flat where the galaxy
 * disc is thin and ending where the galaxy ends. The dropping uses its own random stream, so it never changes the ball itself.
 */
export function makeNearStars(count: number, spacing: number, seed: number, shape?: NearShape): NearStars {
  const radius = nearRadiusFor(spacing, count);
  const rand = mulberry(seed);
  const dropRand = mulberry((seed ^ 0x5bd1e995) + 0x1b873593);
  const px = new Float32Array(count);
  const py = new Float32Array(count);
  const pz = new Float32Array(count);
  const d = new Float32Array(count);
  const type = new Uint8Array(count);
  const kept = new Uint8Array(count);
  let keptCount = 0;
  let farthest = 0;
  for (let i = 0; i < count; i++) {
    const r = radius * Math.cbrt(rand());
    const cosT = rand() * 2 - 1;
    const sinT = Math.sqrt(1 - cosT * cosT);
    const a = rand() * Math.PI * 2;
    px[i] = r * sinT * Math.cos(a);
    py[i] = r * cosT;
    pz[i] = r * sinT * Math.sin(a);
    d[i] = r;
    if ((d[i] ?? 0) > farthest) farthest = d[i] ?? 0;
    let pick = rand() * TYPE_TOTAL;
    let t = 0;
    while (t < STAR_TYPES.length - 1 && pick >= (STAR_TYPES[t]?.weight ?? 0)) {
      pick -= STAR_TYPES[t]?.weight ?? 0;
      t++;
    }
    type[i] = t;
    // One number from the dropping stream per star, used or not, so the stream never depends on the shape.
    const roll = dropRand();
    if (!shape || roll < shape.keep(shape.origin.x + (px[i] ?? 0), shape.origin.y + (py[i] ?? 0), shape.origin.z + (pz[i] ?? 0))) {
      kept[i] = 1;
      keptCount++;
    }
  }
  // The zoom reference: how far out a full ball holds ZOOM_REFERENCE_STARS stars (taken before any star is dropped).
  const zoomIndex = Math.min(ZOOM_REFERENCE_STARS, count) - 1;
  const zoomNearLy = zoomIndex < 0 ? 0 : (Float32Array.from(d).sort()[zoomIndex] ?? 0);
  // Rank the stars that are left by distance.
  const order: number[] = [];
  for (let i = 0; i < count; i++) if (kept[i]) order.push(i);
  order.sort((a, b) => (d[a] ?? 0) - (d[b] ?? 0));
  const positions = new Float32Array(keptCount * 3);
  const distances = new Float32Array(keptCount);
  const colors = new Float32Array(keptCount * 3);
  const radii = new Float32Array(keptCount);
  const ids = new Uint32Array(keptCount);
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
  return { count: keptCount, positions, distances, colors, radii, ids, radius: farthest, ballCount: count, zoomNearLy };
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
