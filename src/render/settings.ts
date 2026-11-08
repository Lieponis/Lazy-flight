// ONE EASY PLACE for the choices of the two screens (starmap and system view).
// Change a number here, save, and the pictures change. Nothing else needs touching.

import type { Seed } from "../universe";

/** The universe seed. Same seed = same universe. (You can also add ?seed=777 to the web address.) */
export const START_SEED: Seed = 12345;

/**
 * Which system you start in.
 *   null          = the system nearest to the middle of the galaxy (START_POINT)
 *   "3:-2:5:0"    = a specific system id (copy one from /debug.html)
 */
export const START_SYSTEM_ID: string | null = null;

/** The middle of the galaxy, in light years. Used when START_SYSTEM_ID is null. */
export const START_POINT = { x: 0, y: 0, z: 0 };

/**
 * Fuel range in light years: the ring drawn around the current system.
 * For now one fixed number. Agent 4 will replace it with the real fuel of the ship.
 * (Same value as MAX_JOB_DISTANCE in src/universe/settings.ts.)
 */
export const FUEL_RANGE_LY = 25;

/** The starmap shows every system closer than this to the current one, in light years. */
export const STARMAP_RADIUS_LY = 35;

/** How close (in screen pixels) a tap must be to a star or planet to select it. */
export const TAP_RADIUS_PX = 18;

/** Number of background stars (cheap: they are single dots). */
export const STARFIELD_COUNT = 260;
