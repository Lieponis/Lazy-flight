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

/**
 * How far the planet has moved from its floating pose when the ship has left for `p` (0..1) of the launch. It slides away from the ship
 * and backwards, getting smaller; it never gets closer to the ship.
 */
export function departOffset(centre: V3, p: number): V3 {
  const c = unit(centre);
  const dir = unit({ x: c.x, y: c.y, z: c.z + 0.8 });
  const l = FAR_DISTANCE * Math.pow(Math.min(1, Math.max(0, p)), 2.2);
  return { x: dir.x * l, y: dir.y * l, z: dir.z * l };
}

/** The planet's push-away when the ship has arrived for `q` (0..1) of the approach: far and tiny at 0, in its floating pose at 1, easing in. */
export function arriveOffset(centre: V3, q: number): V3 {
  const c = unit(centre);
  const rest = 1 - Math.min(1, Math.max(0, q));
  const l = FAR_DISTANCE * rest * rest;
  return { x: c.x * l, y: c.y * l, z: c.z * l };
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

/** At the start of a launch from a planet without a dock the ship sits this far above the surface. */
export const LAUNCH_GAP = 1.5;

/**
 * Where the planet's centre is (relative to the ship) `p` (0..1) of the way through a launch FROM the planet: the ship starts on the
 * surface, straight above the centre, and climbs away, so the planet drops down and backwards and shrinks. It never gets closer.
 */
export function launchCentre(radius: number, p: number): V3 {
  const dir = unit({ x: 0, y: -1, z: 0.6 });
  const l = FAR_DISTANCE * Math.pow(Math.min(1, Math.max(0, p)), 2.2);
  return { x: dir.x * l, y: -(radius + LAUNCH_GAP) + dir.y * l, z: dir.z * l };
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
