// THE COCKPIT VIEW, the small decisions (pure logic, no Three.js, so it can be tested).
// Cockpit view draws the room through the cockpit lens (no stretched edges); Orbit view draws the normal way.

import type { Vec3 } from "./integration";

export type ViewMode = "orbit" | "cockpit";
/** "flat" = the normal picture, "lens" = through the cockpit lens. */
export type RenderPath = "flat" | "lens";

export function renderPathFor(mode: ViewMode): RenderPath {
  return mode === "cockpit" ? "lens" : "flat";
}

/** The room is only drawn in cockpit view; the player's own ship is only drawn in orbit view (never both). */
export function cockpitRoomVisible(mode: ViewMode): boolean {
  return mode === "cockpit";
}
export function ownShipVisible(mode: ViewMode): boolean {
  return mode === "orbit";
}

/** Where the pilot's eye is (and so where the room goes): the ship's eye spot, moving up and down with the ship's gentle bob. */
export function pilotEye(eye: Vec3 | undefined, shipY: number): Vec3 {
  return { x: eye?.x ?? 0, y: (eye?.y ?? 0.45) + shipY, z: eye?.z ?? -0.4 };
}

// ---------------------------------------------------------------- looking around and zooming (a view only, no steering)

export interface Look {
  yaw: number; // radians, positive = look left
  pitch: number; // radians, positive = look up
}
export interface LookLimits {
  yawMax: number;
  pitchMin: number;
  pitchMax: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** A drag of (dx, dy) pixels turns the head. `radiansPerPixel` is how fast. Dragging right turns the view left (like grabbing the scene). */
export function dragLook(look: Look, dx: number, dy: number, radiansPerPixel: number, limits: LookLimits): Look {
  return {
    yaw: clamp(look.yaw + dx * radiansPerPixel, -limits.yawMax, limits.yawMax),
    pitch: clamp(look.pitch + dy * radiansPerPixel, limits.pitchMin, limits.pitchMax),
  };
}

/** Zoom: `factor` above 1 zooms out, below 1 zooms in (the same factors the docked view uses). Stays between min and max degrees. */
export function zoomFov(fov: number, factor: number, min: number, max: number): number {
  return clamp(fov * factor, min, max);
}

/** The shake share for a view mode: the cockpit shakes much less than the orbit camera. */
export function shakeShare(mode: ViewMode, cockpitFactor: number): number {
  return mode === "cockpit" ? cockpitFactor : 1;
}

/** A double tap (or click): the second tap comes soon after the first, and neither tap was a drag. */
export function isDoubleTap(previousTapMs: number, nowMs: number, windowMs = 350): boolean {
  return previousTapMs > 0 && nowMs - previousTapMs <= windowMs;
}
/** A press that barely moved counts as a tap (not a drag). */
export function isTap(movedPixels: number, limit = 8): boolean {
  return movedPixels <= limit;
}

/**
 * Glide toward a target without a jump: each second covers `rate` times the remaining distance (so it slows down gently at the end).
 * rate 8 = about a quarter of a second to get most of the way there. Snaps when it is very close.
 */
export function glide(current: number, target: number, seconds: number, rate = 8, snap = 0.0005): number {
  const k = 1 - Math.exp(-rate * Math.max(0, seconds));
  const next = current + (target - current) * k;
  return Math.abs(target - next) <= snap ? target : next;
}
