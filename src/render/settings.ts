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

// ---------------------------------------------------------------- the flight view (part 3b)

/** Real seconds the take-off takes (only on trips long enough; short trips are squeezed). */
export const FLIGHT_LAUNCH_SECONDS = 5;

/** Real seconds the approach to the destination takes. It starts this long before arrival. */
export const FLIGHT_APPROACH_SECONDS = 10;

/** The shortest warp we still want to show. A trip shorter than launch + this + approach is squeezed in proportion. */
export const FLIGHT_MIN_WARP_SECONDS = 3;

/** After the approach finishes, the screen waits this long ("docked") before showing the system view. */
export const FLIGHT_DOCKED_HOLD_SECONDS = 0.6;

/** The ship computer changes its line this often (real seconds). */
export const FLIGHT_LINE_SECONDS = 25;

/** Warp tunnel look. */
export const TUNNEL_STREAKS = 140; // number of streaking stars (fewer = faster on phones)
export const TUNNEL_RINGS = 12; // number of rings flying past
export const TUNNEL_SPEED = 70; // how fast it flies, in units per second

// ---------------------------------------------------------------- the docked view (part 3c)

/** How steeply the camera looks down at the ship, in degrees (0 = level with the ground, 90 = straight down). */
export const DOCKED_CAMERA_ANGLE_DEG = 28;

/** How far the camera is from the ship. The height above the ground follows from this and the angle. */
export const DOCKED_CAMERA_DISTANCE = 14;

/** How close and how far you can zoom. */
export const DOCKED_ZOOM_MIN = 6;
export const DOCKED_ZOOM_MAX = 40;

/** Lowest and highest camera angle you can drag to, in degrees. */
export const DOCKED_ANGLE_MIN_DEG = 8;
export const DOCKED_ANGLE_MAX_DEG = 80;

/** How fast the camera drifts around the ship by itself, in radians per second (0.04 = one full circle in about 2.5 minutes). 0 = no drift. */
export const DOCKED_DRIFT_SPEED = 0.04;
