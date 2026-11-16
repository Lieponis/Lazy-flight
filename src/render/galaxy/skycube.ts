// THE SKY FROM WHERE YOU ARE (prototype G2). Pure maths, no Three.js.
//
// Plain words: a "sky cube" is the whole sky around you drawn on the 6 inside faces of a cube, a small square picture per
// face. For every little square ("texel") we shoot a ray from the player's position through the galaxy and add up the
// starlight along it, dimmed by dust. Standing somewhere else gives a different sum, so a different sky.
//
// The near stars (the ones drawn one by one on the map) are left out of the sum: the ray starts at `nearRadius`, so
// nothing is counted twice. What the sum holds is the unresolved glow of everything farther away.

import type { FieldSample, GalaxyField } from "./galaxyfield";
import { GALAXY_RADIUS_LY } from "./galaxyfield";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface SkyParams {
  /** Texels along one side of one cube face (64 or 128). */
  faceSize: number;
  /** Steps along each ray (log-spaced: small steps near you, big steps far away). */
  steps: number;
  /** Distance (light years) inside which stars are drawn one by one, so the glow starts here. */
  nearRadius: number;
}

export const DEFAULT_SKY: SkyParams = { faceSize: 64, steps: 56, nearRadius: 100 };

/** The galaxy ends at this height (light years, above or below the disc plane) and this distance from the centre. */
export const SKY_Y_MAX = 4500;
export const SKY_R_MAX = GALAXY_RADIUS_LY * 1.08;

/** Colours of the two kinds of light (linear red, green, blue). Old stars are warm, young stars are blue-white. */
const OLD_RGB = [1.0, 0.82, 0.58] as const;
const YOUNG_RGB = [0.6, 0.78, 1.0] as const;
/** Dust dims blue light more than red (so far light looks redder): relative strength per colour. */
const DUST_RGB = [0.78, 1.0, 1.38] as const;

// ------------------------------------------------------------------------------------------ cube geometry

/** Direction (not yet length 1) for the point (u, v) on a cube face; u and v run from -1 to 1. */
export function faceDirection(face: number, u: number, v: number, out: Vec3): Vec3 {
  switch (face) {
    case 0:
      out.x = 1;
      out.y = -v;
      out.z = -u;
      break;
    case 1:
      out.x = -1;
      out.y = -v;
      out.z = u;
      break;
    case 2:
      out.x = u;
      out.y = 1;
      out.z = v;
      break;
    case 3:
      out.x = u;
      out.y = -1;
      out.z = -v;
      break;
    case 4:
      out.x = u;
      out.y = -v;
      out.z = 1;
      break;
    default:
      out.x = -u;
      out.y = -v;
      out.z = -1;
      break;
  }
  return out;
}

/** Which face a direction points at, and where on it (u and v run from -1 to 1). The shader uses the same table. */
export function directionToFace(x: number, y: number, z: number): { face: number; u: number; v: number } {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const az = Math.abs(z);
  if (ax >= ay && ax >= az) {
    return x > 0 ? { face: 0, u: -z / ax, v: -y / ax } : { face: 1, u: z / ax, v: -y / ax };
  }
  if (ay >= az) {
    return y > 0 ? { face: 2, u: x / ay, v: z / ay } : { face: 3, u: x / ay, v: -z / ay };
  }
  return z > 0 ? { face: 4, u: x / az, v: -y / az } : { face: 5, u: -x / az, v: -y / az };
}

/** The share of the whole sky (solid angle in steradians) that one texel covers. Texels near a face corner cover less. */
export function texelSolidAngle(faceSize: number, u: number, v: number): number {
  const side = 2 / faceSize;
  return (side * side) / Math.pow(1 + u * u + v * v, 1.5);
}

/** Index (in texels) of the texel at (i, j) on a face. Faces are stacked: face 0 first, then face 1, and so on. */
export function texelIndex(faceSize: number, face: number, i: number, j: number): number {
  return (face * faceSize + j) * faceSize + i;
}

// ------------------------------------------------------------------------------------------ one ray

/** How far a ray from p along d travels before it leaves the galaxy's box (a short cylinder). */
export function exitDistance(p: Vec3, dx: number, dy: number, dz: number): number {
  const a = dx * dx + dz * dz;
  const b = p.x * dx + p.z * dz;
  const c = p.x * p.x + p.z * p.z - SKY_R_MAX * SKY_R_MAX;
  if (c > 0) return 0; // standing outside the galaxy box: not used in the prototype
  const tCyl = a > 1e-12 ? (-b + Math.sqrt(b * b - a * c)) / a : Infinity;
  const tY = dy > 1e-9 ? (SKY_Y_MAX - p.y) / dy : dy < -1e-9 ? (-SKY_Y_MAX - p.y) / dy : Infinity;
  return Math.min(tCyl, tY);
}

/** Adds up the light along one ray (d must have length 1). Writes red, green, blue into out[o..o+2]. */
export function integrateRay(
  field: GalaxyField,
  p: Vec3,
  dx: number,
  dy: number,
  dz: number,
  params: SkyParams,
  s: FieldSample,
  out: Float32Array,
  o: number,
): void {
  const s0 = params.nearRadius;
  const t1 = exitDistance(p, dx, dy, dz);
  if (!(t1 > s0 * 1.05)) {
    out[o] = 0;
    out[o + 1] = 0;
    out[o + 2] = 0;
    return;
  }
  // Dust between you and the start of the glow dims everything behind it.
  let tauG = 0;
  for (let i = 0; i < 4; i++) {
    const t = ((i + 0.5) * s0) / 4;
    field.sample(p.x + dx * t, p.y + dy * t, p.z + dz * t, s);
    tauG += (s.dust * s0) / 4;
  }
  let attR = Math.exp(-tauG * DUST_RGB[0]);
  let attG = Math.exp(-tauG * DUST_RGB[1]);
  let attB = Math.exp(-tauG * DUST_RGB[2]);
  const steps = params.steps;
  const q = Math.pow(t1 / s0, 1 / steps);
  let r = 0;
  let g = 0;
  let b = 0;
  let t = s0;
  for (let k = 0; k < steps; k++) {
    const tNext = t * q;
    const tm = Math.sqrt(t * tNext);
    const dt = tNext - t;
    field.sample(p.x + dx * tm, p.y + dy * tm, p.z + dz * tm, s);
    if (s.dust > 0) {
      // Dim by the dust up to the middle of this step, then by the rest of the step.
      const half = 0.5 * s.dust * dt;
      const eR = Math.exp(-half * DUST_RGB[0]);
      const eG = Math.exp(-half * DUST_RGB[1]);
      const eB = Math.exp(-half * DUST_RGB[2]);
      const cr = s.old * OLD_RGB[0] + s.young * YOUNG_RGB[0];
      const cg = s.old * OLD_RGB[1] + s.young * YOUNG_RGB[1];
      const cb = s.old * OLD_RGB[2] + s.young * YOUNG_RGB[2];
      r += cr * dt * attR * eR;
      g += cg * dt * attG * eG;
      b += cb * dt * attB * eB;
      attR *= eR * eR;
      attG *= eG * eG;
      attB *= eB * eB;
    } else {
      r += (s.old * OLD_RGB[0] + s.young * YOUNG_RGB[0]) * dt * attR;
      g += (s.old * OLD_RGB[1] + s.young * YOUNG_RGB[1]) * dt * attG;
      b += (s.old * OLD_RGB[2] + s.young * YOUNG_RGB[2]) * dt * attB;
    }
    t = tNext;
  }
  out[o] = r;
  out[o + 1] = g;
  out[o + 2] = b;
}

// ------------------------------------------------------------------------------------------ the whole sky cube

/** Builds the sky cube a few rows at a time, so a phone can keep drawing frames while it works. */
export class SkyBuilder {
  /** Red, green, blue for every texel (6 faces stacked). Light per steradian, in made-up units. */
  readonly raw: Float32Array;
  private row = 0;
  private readonly rows: number;
  private readonly sample: FieldSample = { old: 0, young: 0, dust: 0 };
  private readonly dir: Vec3 = { x: 0, y: 0, z: 0 };
  /** Total time spent working (milliseconds), summed over every call of `run`. */
  workMs = 0;

  constructor(
    private readonly field: GalaxyField,
    readonly origin: Vec3,
    readonly params: SkyParams = DEFAULT_SKY,
  ) {
    this.rows = 6 * params.faceSize;
    this.raw = new Float32Array(this.rows * params.faceSize * 3);
  }

  get done(): boolean {
    return this.row >= this.rows;
  }

  /** Share finished, 0 to 1. */
  get progress(): number {
    return this.row / this.rows;
  }

  /** Works for about `budgetMs` milliseconds (at least one row). Returns true when the whole cube is finished. */
  run(budgetMs: number, now: () => number = () => performance.now()): boolean {
    const start = now();
    const n = this.params.faceSize;
    do {
      if (this.done) break;
      const face = Math.floor(this.row / n);
      const j = this.row - face * n;
      const v = ((j + 0.5) / n) * 2 - 1;
      for (let i = 0; i < n; i++) {
        const u = ((i + 0.5) / n) * 2 - 1;
        const d = faceDirection(face, u, v, this.dir);
        const len = Math.hypot(d.x, d.y, d.z);
        integrateRay(this.field, this.origin, d.x / len, d.y / len, d.z / len, this.params, this.sample, this.raw, ((face * n + j) * n + i) * 3);
      }
      this.row++;
    } while (now() - start < budgetMs);
    this.workMs += now() - start;
    return this.done;
  }
}

/** Builds the whole cube at once (for tests and measurements). */
export function buildSky(field: GalaxyField, origin: Vec3, params: SkyParams = DEFAULT_SKY): { raw: Float32Array; ms: number } {
  const b = new SkyBuilder(field, origin, params);
  const t0 = performance.now();
  b.run(Infinity);
  return { raw: b.raw, ms: performance.now() - t0 };
}

/** Radius (light years) inside which the nearest `count` systems lie, if systems are `spacing` ly apart: used as the start of the glow. */
export function nearRadiusFor(spacing: number, count: number): number {
  return spacing * Math.cbrt((3 * count) / (4 * Math.PI));
}
