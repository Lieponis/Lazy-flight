// THE FLOATING SCENE, the numbers part (stage F2a): a ship "in space at" a planet that has no dock. Pure maths, no Three.js, so it is tested.
// The ship stays at the middle (0,0,0); only the planet moves. Looking forward is -z, up is +y.
//   - FloatStyle A/B/C: how big the planet is and where it hangs (Andy compares them with ?floatpreview=1).
//   - departOffset / arriveOffset: how the planet slides away when the ship leaves, and grows when the ship arrives.
//   - ringNormalWorld / tiltForClearance: a ringed planet is turned so its rings never cut through the ship or the camera.

export interface V3 {
  x: number;
  y: number;
  z: number;
}

export type FloatStyle = "A" | "B" | "C";
export const FLOAT_STYLES: readonly FloatStyle[] = ["A", "B", "C"];

export interface FloatLayout {
  /** Planet radius (system units). */
  radius: number;
  /** Short name for the preview button note. */
  label: string;
  /** Planet centre relative to the ship, in the end pose (the floating pose). */
  centre: V3;
}

/**
 *   A  "Hovering above": a huge planet below the ship, like standing on a balcony over the world.
 *   B  "Facing the planet": a big planet ahead and below, the ship in front of it.
 *   C  "Far view": a smaller planet, the whole ball (and its rings) in the picture.
 */
export function floatLayout(style: FloatStyle): FloatLayout {
  switch (style) {
    case "A":
      return { label: "Hovering above", radius: 60, centre: { x: 0, y: -90, z: 0 } };
    case "B":
      return { label: "Facing the planet", radius: 40, centre: { x: -34, y: -58, z: 0 } };
    default:
      return { label: "Far view", radius: 22, centre: { x: -36, y: -36, z: 0 } };
  }
}

export function lengthOf(v: V3): number {
  return Math.hypot(v.x, v.y, v.z);
}

/** The farthest the orbit camera gets from the ship (radius plus height), with some room. */
export const CAMERA_REACH = 18;

/** How far the nearest point of the planet is from the nearest the camera can get. Must stay above 0 so nothing cuts through. */
export function clearanceOf(layout: FloatLayout, extraRadius = 0.06): number {
  return lengthOf(layout.centre) - layout.radius * (1 + extraRadius) - CAMERA_REACH;
}

export function parseFloatStyle(search: string): FloatStyle | null {
  const m = /[?&]float=([a-z]+)/i.exec(search);
  const v = m?.[1]?.toUpperCase();
  return v === "A" || v === "B" || v === "C" ? v : null;
}

/** ?floatpreview=1 opens the floating-scene buttons (anything but 0 or false). */
export function parseFloatPreview(search: string): boolean {
  const m = /[?&]floatpreview=([^&]*)/i.exec(search);
  if (!m) return false;
  const v = (m[1] ?? "").toLowerCase();
  return v !== "0" && v !== "false";
}

/** How far the planet is pushed away at the start of an arrival, and at the end of a departure (system units). */
export const FAR_DISTANCE = 1400;

function unit(v: V3): V3 {
  const l = lengthOf(v) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

/** Biggest nose-up angle of the departure path (radians, about 50 degrees) and how the climb eases in. */
export const CLIMB_ANGLE = 0.9;
function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}
/**
 * The ship's nose-up angle after `p` (0..1) of a departure: level in orbit, pitches up into the climb, then straightens out again
 * so it is level (like in the warp) when the warp starts. Smooth all the way: no sudden turns.
 */
export function climbAngle(p: number): number {
  return CLIMB_ANGLE * smooth(p / 0.35) * (1 - smooth((p - 0.55) / 0.45));
}

/** Launches from, and arrivals at, a planet without a dock take this many times longer than at a dock (more time for the curves). */
export const SCENERY_TIME_FACTOR = 1.6;

/** An arrival holds still for this first share of the approach (same camera and ship as in the warp), then eases into the arrival flight. */
export const ARRIVE_HOLD = 0.15;
/** The arrival's progress with that hold and a gentle start and end: 0 for the first ARRIVE_HOLD of the approach, then eases up to 1. Docks use it too. */
export function arriveEase(q: number): number {
  return smooth((q - ARRIVE_HOLD) / (1 - ARRIVE_HOLD));
}

/** How far the ship has flown (system units) after `p` of a departure. It speeds up, so the planet is far and small by the end. */
function flown(p: number): number {
  return FAR_DISTANCE * Math.pow(Math.min(1, Math.max(0, p)), 2.2);
}

/** Where the ship is after `p` of a departure, relative to where it started in orbit: it curves up and away from the planet (see the schematic). */
function departedBy(p: number): V3 {
  const steps = 40;
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < steps; i++) {
    const q0 = (p * i) / steps;
    const q1 = (p * (i + 1)) / steps;
    const dl = flown(q1) - flown(q0);
    const a = climbAngle((q0 + q1) / 2);
    y += dl * Math.sin(a);
    z -= dl * Math.cos(a);
  }
  return { x, y, z };
}

/**
 * A DEPARTURE from a planet without a dock: the ship starts in its orbit (the planet at `centre`), then pitches its nose up and curves away.
 * Returns where the planet is relative to the ship, and the ship's nose-up angle. The planet only ever gets farther away.
 */
export function departPose(centre: V3, p: number): { centre: V3; pitch: number } {
  const s = departedBy(Math.min(1, Math.max(0, p)));
  return { centre: { x: centre.x - s.x, y: centre.y - s.y, z: centre.z - s.z }, pitch: climbAngle(p) };
}

/**
 * An ARRIVAL at a planet without a dock, the departure mirrored: the ship comes in from far away, high and behind, with its nose
 * pointing a little down, and flattens out into its orbit (`q` 0..1; at 1 the planet is at `centre` and the pitch is 0).
 */
export function arrivePose(centre: V3, q: number): { centre: V3; pitch: number } {
  const r = 1 - arriveEase(q);
  const s = departedBy(r); // the same curve, flown backwards in time
  return { centre: { x: centre.x - s.x, y: centre.y - s.y, z: centre.z + s.z }, pitch: -climbAngle(r) };
}

/** How far a plane (the rings) is from the ship, when the plane's normal makes angle `tilt` with the line to the ship. */
export function ringHeight(distance: number, tilt: number): number {
  return distance * Math.cos(tilt);
}

/** The ring plane must be at least this far from the ship (camera reach plus room), so the rings never cut through the ship or camera. */
export const RING_CLEARANCE = 26;

/** The biggest tilt (radians, from face-on) that still keeps the ship `RING_CLEARANCE` away from the ring plane. Capped at `maxTilt`. */
export function tiltForClearance(distance: number, maxTilt = 1.05): number {
  const ratio = Math.min(1, RING_CLEARANCE / Math.max(distance, 1e-6));
  return Math.min(maxTilt, Math.acos(ratio));
}

/**
 * Where the ring plane's normal points, in the world: `tilt` away from the line to the ship (`toShip`, unit length), turned sideways
 * (around the vertical), so the rings are seen at an angle but the ship stays well above or below their plane.
 */
export function ringNormalWorld(toShip: V3, tilt: number): V3 {
  const u = unit(toShip);
  // The planet sits straight to the ship's side/below (z = 0), so the tilt goes sideways within that plane: then the ship's flight path
  // around the planet's axis points along the ship's nose (see noseDirection).
  let side: V3 = { x: u.y, y: -u.x, z: 0 };
  if (lengthOf(side) < 1e-6) side = { x: 1, y: 0, z: 0 };
  side = unit(side);
  return { x: u.x * Math.cos(tilt) + side.x * Math.sin(tilt), y: u.y * Math.cos(tilt) + side.y * Math.sin(tilt), z: u.z * Math.cos(tilt) };
}

/**
 * The way the ship flies while it circles the planet about `axis`: along the surface (at a right angle to the line to the planet and to
 * the axis). `centre` is the planet's centre relative to the ship. For the layouts above it is straight ahead (0, 0, -1), the ship's nose.
 */
export function noseDirection(axis: V3, centre: V3): V3 {
  return unit({
    x: axis.y * centre.z - axis.z * centre.y,
    y: axis.z * centre.x - axis.x * centre.z,
    z: axis.x * centre.y - axis.y * centre.x,
  });
}

/** The slow roll of the ship while it circles the planet (radians, side to side). */
export const SHIP_ROLL_AMOUNT = 0.22;
export function shipRoll(seconds: number): number {
  return Math.sin(seconds * 0.33) * SHIP_ROLL_AMOUNT;
}

export function dot(a: V3, b: V3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** The star's direction as seen from the planet (fixed in the world): light comes from behind and to the right of the ship, so the planet is mostly lit. */
export const STAR_DIRECTION: V3 = unit({ x: 0.55, y: 0.45, z: 0.7 });
/** How far away the star is drawn, and how big (from its radius). */
export const STAR_DISTANCE = 1500;
export function starDrawRadius(starRadius: number): number {
  return Math.min(120, Math.max(35, 55 * starRadius));
}

/** A slow gentle drift of the planet while floating (system units), so the picture is never frozen. */
export function floatDrift(seconds: number): V3 {
  return { x: Math.sin(seconds * 0.05) * 2.2, y: Math.cos(seconds * 0.043) * 1.6, z: Math.sin(seconds * 0.031 + 1) * 1.8 };
}
