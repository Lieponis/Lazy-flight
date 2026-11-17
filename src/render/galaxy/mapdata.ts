// THE REAL MAP'S STAR DATA (stage G5a). Pure maths, no Three.js, no universe code.
//
// Plain words: the render layer never asks the universe anything. The app (a small "glue" file, src/mapsource.ts) owns a MapSource:
// two plain functions that hand over the nearest stars around a point as lists of numbers, and the name of one star. This file turns
// such a list into the `NearStars` the map draws, and counts how many stars the ship can reach.

import { ZOOM_REFERENCE_STARS, type NearStars } from "./neardata";

export interface MapPoint {
  x: number;
  y: number;
  z: number;
}

/** The nearest stars around a point, as plain lists, nearest first. Positions are in light years RELATIVE to the point asked from. */
export interface MapStarList {
  count: number;
  /** The system numbers (plain whole numbers up to about 4.7e10, so not a 32-bit list). */
  ids: Float64Array;
  /** x, y, z of every star in light years, relative to the point asked from (star 0 is usually the system itself, at 0, 0, 0). */
  positions: Float32Array;
  /** Distance of every star from that point (light years), nearest first. */
  distances: Float32Array;
  /** Star colour, red, green, blue each 0..1. */
  colors: Float32Array;
  /** Star size class (the game's star radius). */
  radii: Float32Array;
  /** The galaxy's star spacing in the disc plane where the point is (light years): decides how far the camera may zoom out. */
  spacingLy: number;
}

/** What the map says about one star. */
export interface StarInfo {
  name: string;
  /** For example "Yellow star". */
  starLabel: string;
}

/** What the app hands to the render layer so the map can show the real galaxy. */
export interface MapSource {
  /** The nearest `count` stars around `centre` (galaxy coordinates, light years). Asked once per move; the app may cache the answer. */
  nearest(centre: MapPoint, count: number): MapStarList;
  /** The name and star type of one system, by its number (null if there is no such system). Asked only for tapped stars. */
  describe(id: number): StarInfo | null;
}

/** A ball of this many stars at the local spacing has the radius `spacing x ZOOM_BALL_FACTOR`: cbrt(3 x 1000 / (4 pi)) = 6.2035. */
export const ZOOM_BALL_FACTOR = Math.cbrt((3 * ZOOM_REFERENCE_STARS) / (4 * Math.PI));

/**
 * Makes the map's star set from the app's list. The bubble radius is the distance of the farthest star in the list (the list is
 * "the nearest N", so a ball of that radius around the player holds exactly those stars); every star fades out towards that edge.
 * The "near" zoom-out limit is the distance at which a full ball of 1,000 stars at the LOCAL spacing would end (at the rim of the
 * galaxy that is 829 ly, the limit Andy approved), not the 1,000th nearest star, which lies much farther out in a thin disc.
 */
export function nearStarsFromList(list: MapStarList): NearStars {
  const count = Math.max(0, Math.min(list.count, list.distances.length, Math.floor(list.positions.length / 3)));
  const farthest = count > 0 ? (list.distances[count - 1] ?? 0) : 0;
  const radius = Math.max(1, farthest);
  const spacing = Number.isFinite(list.spacingLy) && list.spacingLy > 0 ? list.spacingLy : 8;
  return {
    count,
    positions: list.positions,
    distances: list.distances,
    colors: list.colors,
    radii: list.radii,
    ids: list.ids,
    radius,
    ballCount: count,
    zoomNearLy: spacing * ZOOM_BALL_FACTOR,
  };
}

/** How many of the first `count` stars (sorted nearest first) lie within `reachLy`. Binary search: fast for 60,000 stars. */
export function starsWithin(distances: ArrayLike<number>, count: number, reachLy: number): number {
  if (!(reachLy > 0)) return 0;
  let lo = 0;
  let hi = Math.min(count, distances.length);
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((distances[mid] ?? Infinity) <= reachLy) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The "5 nearest" line under a tapped star: the distances (light years) to its closest neighbours, short enough for the small label. */
export function nearestLineText(distancesLy: readonly number[]): string {
  if (distancesLy.length === 0) return "";
  const list = distancesLy.map((d) => (d < 10 ? d.toFixed(1) : String(Math.round(d)))).join(", ");
  return `${distancesLy.length} nearest: ${list} ly`;
}

/** Local star spacing a MapSource may use when it has no better number (never zero): the start region's spacing. */
export const DEFAULT_SPACING_LY = 8;
