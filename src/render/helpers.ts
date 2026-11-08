// Small pure helpers for the render layer. No drawing here, no Three.js, so they are easy to test.

import type { Seed } from "../universe";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Turns "#ff9a3c" into the number 0xff9a3c that Three.js wants. Bad text gives white. */
export function hexToNumber(hex: string): number {
  const text = hex.startsWith("#") ? hex.slice(1) : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(text)) return 0xffffff;
  return parseInt(text, 16);
}

/** Reads ?seed=NUMBER from a web address part like "?seed=777". Anything else gives the fallback. */
export function parseSeedParam(search: string, fallback: Seed): Seed {
  const match = /[?&]seed=(-?\d{1,12})(?:&|$)/.exec(search);
  if (!match || match[1] === undefined) return fallback;
  return Number(match[1]);
}

/** Where the camera sits when it looks at the middle (0,0,0) from an angle. */
export function orbitCameraPosition(yaw: number, pitch: number, dist: number): { x: number; y: number; z: number } {
  return {
    x: dist * Math.cos(pitch) * Math.sin(yaw),
    y: dist * Math.sin(pitch),
    z: dist * Math.cos(pitch) * Math.cos(yaw),
  };
}

/** Size of a star on the starmap. Bigger stars look a bit bigger, but never tiny or huge. */
export function starmapStarSize(starRadius: number): number {
  return 0.55 + 0.3 * clamp(starRadius, 0.5, 3);
}

/** The star in the system view (not to scale, just readable). */
export function starDisplayRadius(starRadius: number): number {
  return 1.0 + 0.45 * clamp(starRadius, 0.5, 3);
}

/** Planet size in the system view. Gas giants are clearly bigger. Not to scale on purpose. */
export function planetDisplayRadius(type: string, earthRadii: number): number {
  if (type === "GAS") return 1.8 + clamp(earthRadii - 5, 0, 6) * 0.13;
  return 0.7 + 0.3 * clamp(earthRadii, 0.2, 2);
}

/**
 * How far from the star a planet is drawn. The generator's orbitRadius only decides a little wobble;
 * the planets are spread evenly so they never overlap and stay readable on a phone.
 */
export function orbitDisplayRadius(index: number, orbitRadius: number): number {
  const wobble = Math.max(0, orbitRadius - (0.4 + 0.9 * index)); // 0 to about 0.5
  return 4.2 + index * 3.2 + wobble * 2;
}

/** Spot on a flat orbit circle. phase is 0 to 1 around the circle. */
export function planetOrbitPosition(displayRadius: number, phase: number): { x: number; z: number } {
  const angle = phase * Math.PI * 2;
  return { x: Math.cos(angle) * displayRadius, z: Math.sin(angle) * displayRadius };
}

export interface ScreenPoint {
  x: number;
  y: number;
}

/** Index of the point closest to (px, py) if it is within maxDist, otherwise -1. */
export function nearestScreenPoint(points: readonly ScreenPoint[], px: number, py: number, maxDist: number): number {
  let best = -1;
  let bestDist = maxDist;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!p) continue;
    const d = Math.hypot(p.x - px, p.y - py);
    if (d <= bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** Flat "cartoon" brightness: only four steps, no smooth shading. d = how much a face points at the star (-1 to 1). */
export function faceShade(d: number): number {
  if (d > 0.55) return 1;
  if (d > 0.15) return 0.72;
  if (d > -0.2) return 0.5;
  return 0.32;
}

/**
 * Which of the planet's two colors a patch of its surface gets: 0 = main color, 1 = second color, 0.5 = in between.
 * (nx, ny, nz) is the direction of the patch from the planet's center. Gas giants get stripes.
 */
export function planetColorMix(type: string, nx: number, ny: number, nz: number): number {
  if (type === "GAS") {
    const wave = Math.sin(ny * 9 + Math.sin(nx * 3) * 0.8);
    return wave > 0.35 ? 1 : wave > -0.35 ? 0.5 : 0;
  }
  const v = Math.sin(nx * 5.1 + ny * 3.7) + Math.sin(ny * 6.3 - nz * 4.9) + Math.sin(nz * 5.7 + nx * 2.9);
  return v > 0.6 ? 1 : 0;
}

/** Same dots every time: points spread over a sphere, as x,y,z numbers in one list. */
export function starfieldPositions(count: number, radius: number): Float32Array {
  const out = new Float32Array(count * 3);
  let s = 123456789;
  const next = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const z = next() * 2 - 1;
    const a = next() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    out[i * 3] = Math.cos(a) * r * radius;
    out[i * 3 + 1] = z * radius;
    out[i * 3 + 2] = Math.sin(a) * r * radius;
  }
  return out;
}

export function formatLy(value: number): string {
  return `${value.toFixed(1)} ly`;
}

const PLANET_TYPE_LABELS: Record<string, string> = {
  ROCKY: "Rocky world",
  DESERT: "Desert world",
  OCEAN: "Ocean world",
  ICE: "Ice world",
  LAVA: "Lava world",
  GAS: "Gas giant",
  JUNGLE: "Jungle world",
  BARREN: "Barren rock",
};

export function planetTypeLabel(type: string): string {
  return PLANET_TYPE_LABELS[type] ?? type;
}

export function dockKindLabel(kind: string): string {
  return kind === "OUTPOST" ? "Outpost" : kind === "STATION" ? "Station" : kind;
}
