// The density of systems at any point: how many systems per cubic light year. Pure maths, nothing stored.
//   density = (1 / spacing(r)^3)   how crowded the disc is at distance r from the centre
//           x arms(r, angle)        spiral arms: more systems inside the arms, fewer between them (average stays 1)
//           x vertical(y, r)        flat disc: full density near the middle plane, falling to 0 at the edge of the thickness

import { expDet, lnDet, sincosDet, SC } from "./detmath";
import {
  ARM_COUNT,
  ARM_FADE_FROM,
  ARM_FADE_TO,
  ARM_PITCH_TAN,
  ARM_R0,
  ARM_STRENGTH,
  BULGE,
  CENTRE_SPACING,
  DISC_RADIUS,
  RIM_SPACING,
  THICKNESS_CENTRE,
  THICKNESS_RIM,
  type BulgeShape,
} from "./params";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const GROWTH = lnDet(RIM_SPACING / CENTRE_SPACING);

/** Average distance between neighbouring systems in the disc plane, at distance r from the centre (ly). */
export function spacingAt(r: number): number {
  return CENTRE_SPACING * expDet((GROWTH * r) / DISC_RADIUS);
}

/** Full thickness of the disc at distance r from the centre (ly). */
export function thicknessAt(r: number): number {
  const t = Math.min(1, Math.max(0, r / DISC_RADIUS));
  return THICKNESS_RIM + (THICKNESS_CENTRE - THICKNESS_RIM) * (1 - t) * (1 - t);
}

/** 1 in the middle of the thickness, smoothly down to 0 at the top and bottom. */
export function verticalFactor(y: number, thickness: number): number {
  const u = (2 * Math.abs(y)) / thickness;
  if (u >= 1) return 0;
  if (u <= 0.5) return 1;
  const t = (u - 0.5) * 2;
  return 1 - t * t * (3 - 2 * t);
}

/** How much of the full thickness the vertical factor adds up to: the plateau plus two smooth ramps = 0.75. */
export const VERTICAL_AREA = 0.75;

/** 0 in the bulge, growing smoothly to ARM_STRENGTH further out. Never decreases with r. */
export function armAmplitude(r: number): number {
  const t = (r - ARM_FADE_FROM) / (ARM_FADE_TO - ARM_FADE_FROM);
  if (t <= 0) return 0;
  if (t >= 1) return ARM_STRENGTH;
  return ARM_STRENGTH * t * t * (3 - 2 * t);
}

/** The arm factor at radius r and direction (c, s) = (cos, sin) of the angle. Average over all angles is exactly 1. */
export function armFactor(r: number, c: number, s: number): number {
  const amp = armAmplitude(r);
  if (amp === 0) return 1;
  let zc = 1;
  let zs = 0;
  for (let i = 0; i < ARM_COUNT; i++) {
    const nc = zc * c - zs * s;
    zs = zc * s + zs * c;
    zc = nc;
  }
  sincosDet((ARM_COUNT * lnDet(r / ARM_R0)) / ARM_PITCH_TAN);
  return 1 + amp * (zc * SC.cos + zs * SC.sin);
}

/** Density from polar numbers: radius r, height y, direction (c, s). Systems per cubic ly. */
export function densityPolar(r: number, y: number, c: number, s: number): number {
  if (r >= DISC_RADIUS) return 0;
  const thickness = thicknessAt(r);
  const v = verticalFactor(y, thickness);
  if (v === 0) return 0;
  const spacing = spacingAt(r);
  return (v * armFactor(r, c, s)) / (spacing * spacing * spacing);
}

/**
 * The bulge shape number: 1 at the centre, falling like a ball of stars (about 1 / distance cubed far out), then
 * eased smoothly to exactly 0 at the bulge radius. `s` is the "bulge distance" (see bulgeDistance).
 * Only + - x / and square roots, so it is identical on every device.
 */
export function bulgeProfile(s: number, shape: BulgeShape = BULGE): number {
  const x = s / shape.radius;
  if (x >= 1) return 0;
  const u = s / shape.scale;
  const q = 1 + u * u;
  let fade = 1;
  if (x > 0.5) {
    const t = (x - 0.5) * 2;
    fade = 1 - t * t * (3 - 2 * t);
  }
  return fade / (q * Math.sqrt(q));
}

/** Distance from the centre measured in the bulge's own squashed space (so equal-density shells are flattened balls). */
export function bulgeDistance(x: number, y: number, z: number, shape: BulgeShape = BULGE): number {
  const v = y / shape.flatten;
  return Math.sqrt(x * x + z * z + v * v);
}

/** Density of the bulge alone at a point (systems per cubic ly). 0 beyond the bulge radius. */
export function bulgeDensity(p: Vec3, shape: BulgeShape = BULGE): number {
  if (Math.abs(p.x) >= shape.radius || Math.abs(p.z) >= shape.radius || Math.abs(p.y) >= shape.radius * shape.flatten) return 0;
  return shape.peak * bulgeProfile(bulgeDistance(p.x, p.y, p.z, shape), shape);
}

/** Density of the disc alone at a point (the galaxy before the bulge). */
export function discDensityAt(p: Vec3): number {
  const r = Math.sqrt(p.x * p.x + p.z * p.z);
  if (r === 0) return densityPolar(0, p.y, 1, 0);
  return densityPolar(r, p.y, p.x / r, p.z / r);
}

/** Density at a point: systems per cubic ly. Disc plus bulge. 0 outside both. */
export function densityAt(p: Vec3, bulge: BulgeShape = BULGE): number {
  return discDensityAt(p) + bulgeDensity(p, bulge);
}

/** The expected number of bulge systems, by adding up the density in thin shells (the bulge is round in its own space). */
export function expectedBulgeTotal(shape: BulgeShape = BULGE): number {
  const n = 20000;
  const h = shape.radius / n;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const s = (i + 0.5) * h;
    sum += shape.peak * bulgeProfile(s, shape) * 4 * Math.PI * s * s * shape.flatten * h;
  }
  return sum;
}

/**
 * The density added up along a straight line of sight: the "column density" in systems per square ly.
 * It starts at `origin`, looks along `direction` (any length, it is made 1 long) for `maxDistance` ly and adds up the
 * density at `steps` evenly spaced points (middle of each step) times the step length. It never lists a single star,
 * so it is cheap. This is also what the unresolved starlight in that direction is proportional to (a star's light
 * falls with distance squared, but the number of stars in a narrow cone grows with distance squared, so they cancel),
 * which is what the sky seen from a position is built from. Use more steps for longer lines (about 1 step per 100 ly
 * in the disc is plenty for a smooth sky; arms are thousands of ly wide).
 */
export function lineIntegralDensity(origin: Vec3, direction: Vec3, maxDistance: number, steps: number, bulge: BulgeShape = BULGE): number {
  const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
  if (!(length > 0) || !(maxDistance > 0) || !(steps >= 1)) return 0;
  const n = Math.floor(steps);
  const dx = direction.x / length;
  const dy = direction.y / length;
  const dz = direction.z / length;
  const step = maxDistance / n;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) * step;
    sum += densityAt({ x: origin.x + dx * t, y: origin.y + dy * t, z: origin.z + dz * t }, bulge);
  }
  return sum * step;
}

/** The expected total number of systems in the whole galaxy, by adding up the density in rings (arms average out). */
export function expectedTotal(): number {
  const n = 20000;
  const h = DISC_RADIUS / n;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const r = (i + 0.5) * h;
    const s = spacingAt(r);
    sum += (VERTICAL_AREA * thicknessAt(r) * 2 * Math.PI * r * h) / (s * s * s);
  }
  return sum + expectedBulgeTotal();
}

/**
 * The expected number of systems inside an axis-aligned box, by adding up the density at samples x samples x samples
 * points (the middle of equal little boxes). Smooth and good for glow and tests; use more samples for small boxes
 * with sharp edges.
 */
export function expectedCountIn(min: Vec3, max: Vec3, samples = 32): number {
  const n = Math.max(1, Math.floor(samples));
  const dx = (max.x - min.x) / n;
  const dy = (max.y - min.y) / n;
  const dz = (max.z - min.z) / n;
  let sum = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      for (let k = 0; k < n; k++)
        sum += densityAt({ x: min.x + (i + 0.5) * dx, y: min.y + (j + 0.5) * dy, z: min.z + (k + 0.5) * dz });
  return sum * dx * dy * dz;
}
