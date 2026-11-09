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
export const FLIGHT_LAUNCH_SECONDS = 10;

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

// ---------------------------------------------------------------- Agent 8's designs in the screens (part 3d)

/** Docked at an OUTPOST: the planet surface under the pad. A big ball, so it looks nearly flat; the detail number is how many facets it has. */
export const DOCKED_GROUND_RADIUS = 150;
export const DOCKED_GROUND_DETAIL = 12;

/** Docked at a STATION: the camera is inside the bay. */
export const DOCKED_BAY_MARGIN = 0.7; // the camera never gets closer than this to a wall, floor or ceiling
export const DOCKED_BAY_ZOOM_MIN = 4.5; // how close you can zoom to the ship in the bay
export const DOCKED_BAY_ANGLE_MIN_DEG = 18; // lowest camera angle in the bay (so it never sinks into the hull)
export const DOCKED_BAY_ANGLE_MAX_DEG = 65;
export const DOCKED_BAY_SWAY = 0.14; // how far (radians) the camera slowly sways left and right by itself in the bay; 0 = still

/** Docked at a STATION: the planet seen through the slot. Radius, and where it is relative to the slot mouth. */
export const DOCKED_STATION_PLANET_RADIUS = 150;
export const DOCKED_STATION_PLANET_ALTITUDE = 8; // from the bay floor down to the planet's surface (small, so the planet shows low in the opening). The slot points along the surface.
export const DOCKED_STATION_PLANET_DETAIL = 5; // facets of the planet (more = rounder)
export const FLIGHT_STATION_PLANET_ALTITUDE = 30; // the same in the flight view: higher, so the station never touches the planet

/** System view: how big the dock models are drawn, as a fraction of the planet's drawn radius (clamped to the min and max). */
export const SYSTEM_OUTPOST_SCALE = 0.05;
export const SYSTEM_OUTPOST_SCALE_MIN = 0.04;
export const SYSTEM_OUTPOST_SCALE_MAX = 0.12;
export const SYSTEM_STATION_SCALE = 0.045;

/** Flight view: the orbit camera around the ship (distance and height) while docking/launching and in warp. */
export const FLIGHT_ORBIT_RADIUS = 13;
export const FLIGHT_ORBIT_HEIGHT_DOCK = 7;
export const FLIGHT_ORBIT_HEIGHT_WARP = 3;

/** Flight view: how far the origin dock slides away during the launch, and how far ahead the destination dock starts. */
export const FLIGHT_LAUNCH_FAR = { y: 240, z: 260 };
export const FLIGHT_APPROACH_FROM_OUTPOST = { y: 60, z: 200 };
export const FLIGHT_APPROACH_FROM_STATION = { y: 0, z: 260 }; // stations: straight in, no up or down

/**
 * Leaving a station. The ship flies straight out of the slot (`straight` units), then curves round the planet
 * (nose slowly turning down, like an orbit, the orbit widening: `growth`), and at `curveEnd` units it stops turning
 * and flies straight along that heading until the planet is a dot.
 * The speed: gentle for `slowSeconds` (reaching `slowSpeed` units per second), then it multiplies by e every
 * `speedUpSeconds` (smaller = a more dramatic speed-up). `seconds` = the length of the launch these numbers are made for;
 * a launch that is squeezed (very short trips) plays the same picture faster.
 */
export const STATION_EXIT = { seconds: 10, straight: 20, curveEnd: 260, growth: 0.5, slowSeconds: 4, slowSpeed: 12, speedUpSeconds: 1.1 };

/** Flight view: where the camera sits inside a station bay while you leave or arrive, relative to the ship (right, up, behind). */
export const FLIGHT_BAY_CAMERA = { x: 3.2, y: 3.4, z: 4.8 };


/** Flight view: the camera shakes a little before the jump (strength in scene units), building up from this point of the launch (0 to 1) to full at the flash. */
export const FLIGHT_SHAKE_STRENGTH = 0.1;
export const FLIGHT_SHAKE_START = 0.5;

/**
 * Leaving an OUTPOST (Andy's drawing). The ship is always along its path.
 *   1. It lifts off slowly and goes forward; the nose starts to tilt up after `tiltStart` units and is at `tilt` radians (0.8 = 46 degrees) after `tiltEnd`.
 *   2. A little faster until `t1` seconds (`v1` units per second), then it speeds up until `t2` (`v2`).
 *   3. It flies the angled line, a bit faster, until `t3` (`v3`) and `curveStart` units.
 *   4. Then it curves into an orbit away from the planet, until `curveEnd` units, then flies straight (`curveRadius` = how tight it starts, `growth` = how fast the orbit widens),
 *      speeding up more and more (the speed multiplies by e every `speedUpSeconds`).
 * `seconds` = the launch length these numbers are made for; a squeezed launch (very short trips) plays the same picture faster.
 */
export const OUTPOST_EXIT = {
  seconds: 10,
  tiltStart: 2,
  tiltEnd: 25,
  tilt: 0.8,
  t1: 3,
  v1: 8,
  t2: 4.2,
  v2: 40,
  t3: 6,
  v3: 52,
  curveStart: 125,
  curveEnd: 520,
  curveRadius: 300,
  growth: 0.5,
  speedUpSeconds: 0.9,
};

/**
 * Arriving at a STATION: the reverse of leaving it, but slower and starting closer.
 * The ship comes in along the same path backwards (nose first, slowing down), enters the opening, stops, then turns round
 * (a half turn) in the bay so it rests facing the opening.
 * `startDistance` = how far from the bay (units) the ship is when it drops out of warp; `pathShare` = the share of the approach spent
 * flying in; the half turn ends at `turnEnd`; the camera goes from the orbit camera to the chase camera during the first `cameraBlend` of the approach.
 * The chase camera follows the ship from behind and a little to the side, and turns with the ship when it turns round (right, up, behind).
 */
export const STATION_ENTRY = { pathShare: 0.85, turnEnd: 0.95, startDistance: 800, cameraBlend: 0.3 };
export const FLIGHT_CHASE_CAMERA = { x: 2.2, y: 3.2, z: 4.6 };

/** The approach to a STATION takes this long (real seconds, on trips long enough). Outposts keep FLIGHT_APPROACH_SECONDS. */
export const FLIGHT_APPROACH_SECONDS_STATION = 16;

/** Arriving at a station: the camera shakes as the ship drops out of warp, calming down over this many seconds. */
export const FLIGHT_ARRIVAL_SHAKE_SECONDS = 1.8;
