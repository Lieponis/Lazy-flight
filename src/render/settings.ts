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

/** The starmap shows every system closer than this to the current one, in light years, as a minimum. */
export const STARMAP_RADIUS_LY = 35;

/**
 * With more fuel on board the map grows to show every star the ship can reach (plus the padding), but never past the cap.
 * Measured with the real universe (seed 12345, from the start system): 35 ly = 184 stars, 60 ly = 998, 75 ly = 1,970 (about 15,800
 * triangles, listed in about 16 ms on a computer), 90 ly = 3,366, 110 ly = 6,102. 75 ly covers every ship with a full tank
 * (Hauler 30 ly, Liner 50, Scout 55) and several upgrades. Free travel itself has NO distance cap: only fuel.
 */
export const STARMAP_MAX_RADIUS_LY = 75;
export const STARMAP_RADIUS_PAD_LY = 3;

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

/** The warp (3e): stars and haze. */
export const WARP_STREAKS = 1400; // stars shooting past (fewer = lighter on phones)
export const WARP_AHEAD = 170; // stars appear this far ahead of the ship...
export const WARP_BEHIND = 170; // ...and stream on until this far behind it, stretching as they go
export const WARP_SPAN = WARP_AHEAD + WARP_BEHIND; // the length of one run before a star starts again
export const WARP_SPEED = 100; // how fast the stars fly, units per second
export const WARP_RADIUS_MIN = 2.2; // the dark gap in the middle
export const WARP_RADIUS_MAX = 20;
export const WARP_HAZE_COUNT = 16; // nebula clouds all around the ship (styles B and C)
export const WARP_HAZE_DISTANCE = 70; // how far from the ship the clouds hang (the nearest ones; others are further out)
export const WARP_STAR_BRIGHTNESS = 0.6; // how bright the stars are (1 = full; Andy asked for less)
/** Which warp look is used when ?warp= is not given. Andy chose C. */
export const WARP_DEFAULT_STYLE: "A" | "B" | "C" = "C";

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
export const SYSTEM_OUTPOST_SCALE = 0.01; // Andy: docks 5x smaller in the system view (was 0.05)
export const SYSTEM_OUTPOST_SCALE_MIN = 0.008;
export const SYSTEM_OUTPOST_SCALE_MAX = 0.024;
export const SYSTEM_STATION_SCALE = 0.009;

/** Flight view: the orbit camera around the ship (distance and height) while docking/launching and in warp. */
export const FLIGHT_ORBIT_RADIUS = 13;
export const FLIGHT_ORBIT_HEIGHT_DOCK = 7;
export const FLIGHT_ORBIT_HEIGHT_WARP = 3;

/** Flight view: how far ahead (and how high) the destination outpost starts on the approach. */
export const FLIGHT_APPROACH_FROM_OUTPOST = { y: 60, z: 200 };

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
/** Inside the cockpit the shake is much gentler (the room is close to the eye): this share of the normal shake. */
export const COCKPIT_SHAKE_FACTOR = 0.2;
/** Looking around in the cockpit (drag): how far left/right and up/down, in degrees. */
export const COCKPIT_LOOK_YAW_MAX_DEG = 110;
export const COCKPIT_LOOK_PITCH_MIN_DEG = -40;
export const COCKPIT_LOOK_PITCH_MAX_DEG = 55;
/** The cockpit's info screen shows the trip facts for this many seconds, then a funny ship-computer message for this many, and so on. */
export const COCKPIT_STATUS_SECONDS = 15;
export const COCKPIT_MESSAGE_SECONDS = 10;
/** The cockpit starts (and double tap returns) zoomed OUT this many times compared with the approved 70-degree view (Andy: 1.5 to 2 times). */
export const COCKPIT_DEFAULT_ZOOM_OUT = 1.75;
/** From that start the player can zoom in and out this many times (wheel or pinch). */
export const COCKPIT_ZOOM_RANGE = 5;
/** The widest view allowed, side to side in degrees (the lens and the hidden picture get heavy beyond this). */
export const COCKPIT_FOV_CAP = 150;

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

/** Keeping the ship in the picture: the room left round it (1.1 = 10 percent), and the widest the view may get when the camera cannot move back (degrees). */
export const SHIP_FIT_MARGIN = 1.1;
export const SHIP_FIT_MAX_FOV = 100;

// ---------------------------------------------------------------- the PS1 pixel look (stage 3e)
// Compare the strengths with ?lookpreview=1 (buttons Off / A / B / C). The numbers of A, B and C are in lookmath.ts.
export const LOOK_DEFAULT_STYLE: "off" | "A" | "B" | "C" = "B"; // Andy picked B
export const LOOK_FLAME_FLICKER = 0.12; // engine flames change length in chunky steps (+/- this share). 0 = steady flame.
export const LOOK_FLASH_STEPS = 6; // the warp flash fades in this many chunky steps. 0 = smooth fade.

// ---------------------------------------------------------------- the floating scene (stage F2a)
/** How the "in space at a planet" scene looks: "A" hovering above, "B" facing the planet, "C" far view (?float=A|B|C tries them). */
export const FLOAT_DEFAULT_STYLE: "A" | "B" | "C" = "A"; // Andy picked A (Hovering above)
export const FLOAT_PLANET_DETAIL = 3; // roundness of the planet in that scene (3 = 320 triangles; clouds and rings come on top)
export const FLOAT_SHIP_ORBIT_SPEED = 0.04; // how fast the ship circles the planet while floating (radians per second: one lap in about 2.5 minutes)

// ---------------------------------------------------------------- the system view with up to 10 planets (stage U3)
/** How docks are marked in the system view. Andy chose "A": bright orbit lines for docks, dim for scenery ("off" = old look, ?marks=off). */
export const SYSTEM_MARK_STYLE: "off" | "A" = "A";
export const SYSTEM_LANE_DOCK = 0x5fd4ff; // orbit line of a planet with a dock
export const SYSTEM_LANE_SCENERY = 0x1d2350; // orbit line of a scenery planet (dim)
export const SYSTEM_LANE_OLD = 0x2a3170; // the old look: every orbit line the same
export const SYSTEM_MIN_ZOOM_DIST = 0.8; // how close the player can zoom in the system view (was 4; Andy: 5x more)
