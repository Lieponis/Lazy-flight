// WHEN DOES THE SKY NEED A NEW BUILD? (prototype G2). Pure maths, no Three.js.
//
// Plain words: the sky only changes noticeably after the player has moved a long way, so the world is cut into "sky cells"
// (cubes). Every position inside one cell gets the same sky, built once at the middle of the cell. Cells are small near the
// galaxy centre, where the sky changes fast, and big near the rim, where it hardly changes. The player crossing into another
// cell is the signal to build a new sky (in the background, a few milliseconds per frame).
//
// How the cell sizes were chosen: `tests` and docs/report-agent-3j.md list the distance after which the sky visibly changes
// (measured on the stand-in galaxy). A cell is about a quarter of that distance, so crossing into a new cell is not a jolt.

import { hash32 } from "./hash";
import type { Vec3 } from "./skyglow";

/** Smallest and biggest cell edge (light years). */
export const SKY_CELL_MIN_LY = 60;
export const SKY_CELL_MAX_LY = 3840;
/** Cell edge as a share of the distance from the galaxy centre (before it is rounded to a size level). */
export const SKY_CELL_FRACTION = 0.045;

/** Number of size levels: 60, 120, 240, 480, 960, 1920, 3840 light years. */
const LEVELS = 7;

export interface SkyCell {
  /** One whole number that is the same for every position inside this cell. */
  key: number;
  /** Edge length of the cell (light years). */
  size: number;
  /** The middle of the cell: the sky is built here. */
  centre: Vec3;
  /** Seed for the faint stars (a bigger cell than the sky cell, so dots do not reshuffle every time the glow is rebuilt). */
  starSeed: number;
}

/** The size level (0 to 6) for a position at distance `radius` from the galaxy centre. */
export function skyCellLevel(radius: number): number {
  const wanted = Math.max(SKY_CELL_MIN_LY, SKY_CELL_FRACTION * radius);
  const level = Math.round(Math.log2(wanted / SKY_CELL_MIN_LY));
  return Math.max(0, Math.min(LEVELS - 1, level));
}

export function skyCellOf(p: Vec3): SkyCell {
  const level = skyCellLevel(Math.hypot(p.x, p.z));
  const size = SKY_CELL_MIN_LY * 2 ** level;
  const ix = Math.floor(p.x / size);
  const iy = Math.floor(p.y / size);
  const iz = Math.floor(p.z / size);
  const bigSize = size * 4;
  const starSeed = hash32(Math.floor(p.x / bigSize) + level * 7919, Math.floor(p.y / bigSize), Math.floor(p.z / bigSize));
  return {
    key: hash32(ix + level * 100003, iy, iz),
    size,
    centre: { x: (ix + 0.5) * size, y: (iy + 0.5) * size, z: (iz + 0.5) * size },
    starSeed,
  };
}

/** True when the player at p has left the cell the current sky was built for. */
export function needsNewSky(builtKey: number | null, p: Vec3): boolean {
  return builtKey === null || skyCellOf(p).key !== builtKey;
}
