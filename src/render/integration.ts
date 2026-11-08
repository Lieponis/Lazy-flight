// The decisions for putting Agent 8's designs into the screens. Pure numbers and words: no Three.js, no browser.
// (Easy to test. The screens in docked.ts, flight.ts and systemview.ts do the drawing.)

import { BAY_SIZE, FLAME_FLYING, FLAME_PARKED, FLAME_WARP } from "./assets/style";
import { OUTPOST_IDS, pickOutpostVariant, pickStationVariant, STATION_IDS } from "./assets/pickers";
import { clamp } from "./helpers";
import type { FlightPhase } from "./flightplan";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// ------------------------------------------------------------------ which ship

/** The ship used when the game gives an id we do not know. */
export const FALLBACK_SHIP_ID = "cargo-hauler";

/** The ships that have a 3D design. The ids match src/game/ships.ts. */
export const SHIP_MODEL_IDS: readonly string[] = ["cargo-hauler", "passenger-liner", "scout"];

export function isKnownShip(id: string | null | undefined): id is string {
  return typeof id === "string" && SHIP_MODEL_IDS.includes(id);
}

/** The model to draw. `forced` is the ?ship= testing aid: if it is a real ship, it wins. Unknown ids fall back to the Cargo Hauler. */
export function resolveShipId(id: string | null | undefined, forced?: string | null): string {
  if (isKnownShip(forced)) return forced;
  if (isKnownShip(id)) return id;
  return FALLBACK_SHIP_ID;
}

/** Reads ?ship=scout from the web address. Returns null if missing or not a real ship. */
export function parseShipParam(search: string): string | null {
  const m = /[?&]ship=([^&#]*)/.exec(search);
  if (!m) return null;
  let value = m[1] ?? "";
  try {
    value = decodeURIComponent(value);
  } catch {
    // keep the raw text
  }
  return isKnownShip(value) ? value : null;
}

// ------------------------------------------------------------------ which dock design

/** The outpost design for a dock. Never empty: falls back to the first outpost. */
export function outpostModelFor(dockId: string, planetType: string): string {
  return pickOutpostVariant(dockId, planetType) ?? OUTPOST_IDS[0] ?? "outpost-depot";
}

/** The station design for a dock. Never empty: falls back to the first station. */
export function stationModelFor(dockId: string): string {
  return pickStationVariant(dockId) ?? STATION_IDS[0] ?? "station-ring";
}

// ------------------------------------------------------------------ small maths

export function smoothstep(x: number): number {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
}

/** Turns a point around the up axis (positive angle = the same way as Three.js rotation.y). */
export function rotateY(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
}

// ------------------------------------------------------------------ the station bay (docked view)

export interface Box {
  min: Vec3;
  max: Vec3;
}

/**
 * The room inside a station bay, in the docked scene where the ship's parking point is the middle (0, 0, 0).
 * `entrance` and `parking` are the model's own anchor positions. The floor is at y = 0.
 */
export function bayBoxWorld(entrance: Vec3, parking: Vec3, size = BAY_SIZE): Box {
  const zMouth = entrance.z - parking.z;
  return {
    min: { x: -size.width / 2, y: 0, z: zMouth },
    max: { x: size.width / 2, y: size.height, z: zMouth + size.depth },
  };
}

/** Pulls a point into the box, keeping `margin` away from every wall. A box too small for the margin gives its middle. */
export function clampToBox(p: Vec3, box: Box, margin: number): Vec3 {
  const fit = (v: number, lo: number, hi: number): number => (lo + margin > hi - margin ? (lo + hi) / 2 : clamp(v, lo + margin, hi - margin));
  return { x: fit(p.x, box.min.x, box.max.x), y: fit(p.y, box.min.y, box.max.y), z: fit(p.z, box.min.z, box.max.z) };
}

export function insideBox(p: Vec3, box: Box, margin = 0): boolean {
  return (
    p.x >= box.min.x + margin && p.x <= box.max.x - margin &&
    p.y >= box.min.y + margin && p.y <= box.max.y - margin &&
    p.z >= box.min.z + margin && p.z <= box.max.z - margin
  );
}

/** The orbit-camera numbers (turn, tilt, distance) that put the camera at `point` looking at `target`. Same convention as dockedcam.ts. */
export function camFromPoint(point: Vec3, target: Vec3): { yaw: number; pitch: number; dist: number } {
  const dx = point.x - target.x;
  const dy = point.y - target.y;
  const dz = point.z - target.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 1e-6) return { yaw: 0, pitch: 0, dist: 0 };
  return { yaw: Math.atan2(dx, dz), pitch: Math.asin(clamp(dy / dist, -1, 1)), dist };
}

/** Where a model's anchor lands when the model is moved so that its parking anchor is at (0, 0, 0). */
export function relativeToParking(anchor: Vec3, parking: Vec3): Vec3 {
  return { x: anchor.x - parking.x, y: anchor.y - parking.y, z: anchor.z - parking.z };
}

// ------------------------------------------------------------------ the outpost view (docked)

export interface Framing {
  target: Vec3;
  dist: number;
  maxDist: number;
}

/** Where the docked camera looks, and how far away it starts, so the ship AND the buildings fit in the picture. */
export function outpostFraming(min: Vec3, max: Vec3, minZoom: number, maxZoom: number): Framing {
  const cx = (min.x + max.x) / 2;
  const cz = (min.z + max.z) / 2;
  const longest = Math.max(max.x - min.x, max.z - min.z);
  const dist = clamp(longest * 0.75 + 7, 12, 30);
  return { target: { x: cx * 0.55, y: 1.4, z: cz * 0.55 }, dist: clamp(dist, minZoom, maxZoom), maxDist: Math.max(maxZoom, dist * 1.6) };
}

// ------------------------------------------------------------------ the flight view

export type DockKind = "OUTPOST" | "STATION";

/** How far the origin dock has slid away at progress p (0 to 1) of the launch: back and down. */
export function launchOffset(p: number, far: { y: number; z: number }): Vec3 {
  const e = clamp(p, 0, 1) ** 2; // speeds up
  return { x: 0, y: -far.y * e, z: far.z * e };
}

/** Where the destination dock is at progress p of the approach: far ahead at first, then exactly at the ship. Ends at (0, 0, 0). */
export function approachOffset(p: number, from: { y: number; z: number }): Vec3 {
  const e = 1 - (1 - clamp(p, 0, 1)) ** 3; // slows down
  return { x: 0, y: -from.y * (1 - e), z: -from.z * (1 - e) };
}

/** Engine flame length (scale along Z) for the phase. 0.15 parked, 1 flying, 3 in warp. */
export function flameLength(phase: FlightPhase, p: number, t: number): number {
  const q = clamp(p, 0, 1);
  switch (phase) {
    case "LAUNCH":
      return q < 0.8 ? lerp(FLAME_PARKED, FLAME_FLYING, smoothstep(q / 0.5)) : lerp(FLAME_FLYING, FLAME_WARP, smoothstep((q - 0.8) / 0.2));
    case "WARP":
      return FLAME_WARP + Math.sin(t * 20) * 0.2;
    case "APPROACH":
      return q < 0.15 ? lerp(FLAME_WARP, FLAME_FLYING, smoothstep(q / 0.15)) : lerp(FLAME_FLYING, FLAME_PARKED, smoothstep((q - 0.15) / 0.85));
    default:
      return FLAME_PARKED;
  }
}

/**
 * Leaving a station: 0 while the camera is still inside the bay, then 1 once the station has slid clear
 * (so the orbit camera can swing round without going through a wall). `slide` = how far back the station has moved.
 */
export function launchCameraBlend(slide: number): number {
  return smoothstep((slide - 12) / 14);
}

/** Arriving at a station: 0 while it is still far ahead, 1 before its front face reaches the camera. `ahead` = how far in front it still is. */
export function approachCameraBlend(ahead: number): number {
  return smoothstep((60 - ahead) / 30);
}

/** The orbit camera spot, relative to the ship: angle a, distance and height. */
export function orbitPosition(angle: number, radius: number, height: number): Vec3 {
  return { x: Math.sin(angle) * radius, y: height, z: Math.cos(angle) * radius };
}
