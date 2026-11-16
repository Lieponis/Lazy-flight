// THE SKY GLOW FROM WHERE YOU ARE (prototype G2). Pure maths, no Three.js.
//
// Plain words: the whole sky around you is cut into small squares ("texels") laid out in rings around the galaxy's up/down axis
// (skysphere.ts: every square has about the same size, so nothing is squeezed near the poles and no cube edges show). For every
// square we shoot a ray from the player's position through the galaxy and add up the starlight along it, dimmed by dust.
// Standing somewhere else gives a different sum, so a different sky.
//
// The near stars (the ones drawn one by one on the map) are left out of the sum: the ray starts at `nearRadius`, so
// nothing is counted twice. What the sum holds is the unresolved glow of everything farther away.

import type { FieldSample, GalaxyField } from "./galaxyfield";
import { GALAXY_RADIUS_LY } from "./galaxyfield";
import { ringLayout, ringsForTexels, ringTexelDirection, type RingLayout } from "./skysphere";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface SkyParams {
  /**
   * Size of the sky in "cube face" units: the sky has about 6 x faceSize x faceSize squares (32 = 6,100, 64 = 24,600, 128 = 98,300),
   * the number a 6-face sky cube of that face size would have, so the numbers stay comparable with the first prototype.
   */
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

// ------------------------------------------------------------------------------------------ the ring layout

const layouts = new Map<number, RingLayout>();

/** The ring layout (equal-area squares) for a sky size; made once per size. */
export function layoutFor(faceSize: number): RingLayout {
  let layout = layouts.get(faceSize);
  if (!layout) {
    layout = ringLayout(ringsForTexels(6 * faceSize * faceSize, true), true);
    layouts.set(faceSize, layout);
  }
  return layout;
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

// ------------------------------------------------------------------------------------------ the whole sky

/** Builds the sky glow a few squares at a time, so a phone can keep drawing frames while it works. */
export class SkyBuilder {
  readonly layout: RingLayout;
  /** Red, green, blue for every square (ring after ring, see skysphere.ts). Light per steradian, in made-up units. */
  readonly raw: Float32Array;
  private ring = 0;
  private index = 0;
  private done_ = false;
  private readonly sample: FieldSample = { old: 0, young: 0, dust: 0 };
  private readonly dir: Vec3 = { x: 0, y: 0, z: 0 };
  /** Total time spent working (milliseconds), summed over every call of `run`. */
  workMs = 0;

  constructor(
    private readonly field: GalaxyField,
    readonly origin: Vec3,
    readonly params: SkyParams = DEFAULT_SKY,
  ) {
    this.layout = layoutFor(params.faceSize);
    this.raw = new Float32Array(this.layout.total * 3);
  }

  get done(): boolean {
    return this.done_;
  }

  /** Share finished, 0 to 1. */
  get progress(): number {
    if (this.done_) return 1;
    return ((this.layout.offsets[this.ring] ?? 0) + this.index) / this.layout.total;
  }

  /** Works for about `budgetMs` milliseconds (the clock is looked at every 8 squares). Returns true when the whole sky is finished. */
  run(budgetMs: number, now: () => number = () => performance.now()): boolean {
    const start = now();
    const layout = this.layout;
    let sinceClock = 0;
    while (!this.done_) {
      const ring = this.ring;
      const t = (layout.offsets[ring] ?? 0) + this.index;
      const d = ringTexelDirection(layout, ring, this.index, this.dir);
      integrateRay(this.field, this.origin, d.x, d.y, d.z, this.params, this.sample, this.raw, t * 3);
      this.index++;
      if (this.index >= (layout.counts[ring] ?? 0)) {
        this.index = 0;
        this.ring++;
        if (this.ring >= layout.rings) this.done_ = true;
      }
      if (++sinceClock >= 8) {
        sinceClock = 0;
        if (now() - start >= budgetMs) break;
      }
    }
    this.workMs += now() - start;
    return this.done_;
  }
}

/** Builds the whole sky at once (for tests and measurements). */
export function buildSky(field: GalaxyField, origin: Vec3, params: SkyParams = DEFAULT_SKY): { raw: Float32Array; layout: RingLayout; ms: number } {
  const b = new SkyBuilder(field, origin, params);
  const t0 = performance.now();
  b.run(Infinity);
  return { raw: b.raw, layout: b.layout, ms: performance.now() - t0 };
}

/** Radius (light years) inside which the nearest `count` systems lie, if systems are `spacing` ly apart: used as the start of the glow. */
export function nearRadiusFor(spacing: number, count: number): number {
  return spacing * Math.cbrt((3 * count) / (4 * Math.PI));
}
