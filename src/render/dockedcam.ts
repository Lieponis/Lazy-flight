// The docked view's camera maths: pure numbers, no Three.js. Easy to test.
// The camera circles a target point. yaw = turn around, pitch = angle above the ground, dist = distance.

import { clamp, orbitCameraPosition } from "./helpers";

export interface OrbitCam {
  yaw: number;
  pitch: number;
  dist: number;
}

export interface CamLimits {
  minDist: number;
  maxDist: number;
  /** Lowest angle above the ground, in radians. */
  minPitch: number;
  /** Highest angle above the ground, in radians. */
  maxPitch: number;
}

export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** The camera the docked view starts with: looking down at `pitchDegrees`, `dist` away. Always inside the limits. */
export function defaultDockedCam(pitchDegrees: number, dist: number, limits: CamLimits): OrbitCam {
  return {
    yaw: 0.6,
    pitch: clamp(degToRad(pitchDegrees), limits.minPitch, limits.maxPitch),
    dist: clamp(dist, limits.minDist, limits.maxDist),
  };
}

/** Dragging by (dx, dy) pixels. Drag right turns the scene right; drag down tilts the camera up. */
export function rotateCam(cam: OrbitCam, dx: number, dy: number, limits: CamLimits, perPixel = 0.01): OrbitCam {
  return {
    yaw: wrapAngle(cam.yaw - dx * perPixel),
    pitch: clamp(cam.pitch + dy * perPixel, limits.minPitch, limits.maxPitch),
    dist: cam.dist,
  };
}

/** Zoom by a factor (below 1 = closer, above 1 = farther). Stays inside the limits. */
export function zoomCam(cam: OrbitCam, factor: number, limits: CamLimits): OrbitCam {
  const f = Number.isFinite(factor) && factor > 0 ? factor : 1;
  return { ...cam, dist: clamp(cam.dist * f, limits.minDist, limits.maxDist) };
}

/** Mouse wheel: scrolling down (positive) zooms out. */
export function wheelFactor(deltaY: number): number {
  return Math.exp(deltaY * 0.0012);
}

/** Pinch: fingers moving apart (distance grows) zoom in. */
export function pinchFactor(previousFingerDistance: number, fingerDistance: number): number {
  if (previousFingerDistance <= 0 || fingerDistance <= 0) return 1;
  return previousFingerDistance / fingerDistance;
}

/** The slow drift that keeps the scene alive: turns the camera a little each frame. */
export function driftCam(cam: OrbitCam, seconds: number, radiansPerSecond: number): OrbitCam {
  return { ...cam, yaw: wrapAngle(cam.yaw + radiansPerSecond * seconds) };
}

export function wrapAngle(angle: number): number {
  const full = Math.PI * 2;
  return angle - Math.floor((angle + Math.PI) / full) * full;
}

/** Where the camera sits for a given target point. */
export function camPosition(cam: OrbitCam, target: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  const p = orbitCameraPosition(cam.yaw, cam.pitch, cam.dist);
  return { x: p.x + target.x, y: p.y + target.y, z: p.z + target.z };
}
