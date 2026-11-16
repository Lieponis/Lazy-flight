// THE GALAXY BACK-DROP AS DOTS (prototype G2). Pure maths, no Three.js.
//
// Plain words: instead of a glowing picture made of squares, the far galaxy is a cloud of single dots. Every dot is a star
// picked from the galaxy's density (more dots where the galaxy is dense: the band, the bulge, the arms), seen from the
// player's position: its direction is the direction from the player to that star. Dust on the way dims it, so dark lanes
// appear. A dot is one pixel, never a square block, and a thin disc seen edge-on is a thin line of dots.
//
// What is physics and what is noise: WHERE dots can be (the band, bulge, arms, dust lanes) comes from the density function and
// the player's position. Which exact spots get a dot, and each dot's brightness, come from a repeatable random scramble
// (seeded by the sky cell), so the same place always shows the same dots. The stars themselves do not depend on where the
// player stands (only which of them are close enough to be left out does), so moving a little changes the dots a little.

import { hash32, mulberry, unit } from "./hash";
import { DUST_REACH_LY, type FieldSample, type GalaxyField, type StarProposal } from "./galaxyfield";
import type { FaintStars } from "./skystars";
import type { Vec3 } from "./skyglow";

export interface DotParams {
  /** How many dots to place. */
  count: number;
  /** Dots closer than this (light years) are left out: the near stars are drawn one by one instead. */
  nearRadius: number;
  /** Repeatable scramble seed (from the sky cell). */
  seed: number;
  /**
   * The dot density follows (light)^squeeze. 1 = exactly the light; smaller squeezes the huge brightness range so the bulge does
   * not swallow all the dots (like the exposure curve of the glow does).
   */
  squeeze: number;
}

export const DEFAULT_DOTS: DotParams = { count: 60000, nearRadius: 100, seed: 1, squeeze: 0.5 };

const WARM = [1.0, 0.82, 0.62] as const;
const WHITE = [0.95, 0.96, 1.0] as const;
const BLUE = [0.66, 0.8, 1.0] as const;
/** Dust dims blue light more than red (same table as the glow). */
const DUST_RGB = [0.78, 1.0, 1.38] as const;
const PATH_STEPS = 8;
/** Above this height (light years) the stand-in galaxy has no dust at all. */
const DUST_HEIGHT_LY = DUST_REACH_LY;

/** Places the dots a few thousand at a time, so a phone keeps drawing frames while it works. */
export class DotsBuilder {
  readonly dirs: Float32Array;
  readonly colors: Float32Array;
  private placed = 0;
  private tries = 0;
  private bound = 0;
  private readonly rand: () => number;
  private readonly s: FieldSample = { old: 0, young: 0, dust: 0 };
  private readonly p: Vec3 = { x: 0, y: 0, z: 0 };
  /** Total working time in milliseconds. */
  workMs = 0;

  constructor(
    private readonly field: GalaxyField,
    private readonly proposal: StarProposal,
    private readonly origin: Vec3,
    readonly params: DotParams,
  ) {
    this.dirs = new Float32Array(params.count * 3);
    this.colors = new Float32Array(params.count * 3);
    this.rand = mulberry(params.seed ^ 0x5bd1e995);
    this.bound = this.estimateBound();
  }

  get done(): boolean {
    return this.placed >= this.params.count || this.tries > this.params.count * 400;
  }

  get progress(): number {
    return Math.min(1, this.placed / this.params.count);
  }

  get count(): number {
    return this.placed;
  }

  private weightOf(x: number, y: number, z: number): number {
    this.field.sample(x, y, z, this.s);
    // Young stars are far brighter than old ones, so they count for more.
    const light = this.s.old + 6 * this.s.young;
    return Math.pow(Math.max(light, 0), this.params.squeeze);
  }

  /**
   * A high "wanted / guessed" ratio among a few thousand tries (the sampler keeps points in proportion to it). Not the very highest:
   * the few densest spots are then slightly under-counted, which the squeeze hides, and many fewer tries are thrown away.
   */
  private estimateBound(): number {
    const rand = mulberry(this.params.seed ^ 0x9e3779b9);
    const ratios: number[] = [];
    for (let i = 0; i < 4000; i++) {
      const pdf = this.proposal.draw(rand, this.p);
      if (!(pdf > 0)) continue;
      ratios.push(this.weightOf(this.p.x, this.p.y, this.p.z) / pdf);
    }
    ratios.sort((a, b) => a - b);
    return Math.max(1e-30, ratios[Math.floor(ratios.length * 0.92)] ?? 1);
  }

  /** Works for about `budgetMs` milliseconds. Returns true when all dots are placed. */
  run(budgetMs: number, now: () => number = () => performance.now()): boolean {
    const start = now();
    const o = this.origin;
    const { count, nearRadius } = this.params;
    while (!this.done) {
      for (let k = 0; k < 200 && this.placed < count; k++) {
        this.tries++;
        const pdf = this.proposal.draw(this.rand, this.p);
        if (!(pdf > 0)) continue;
        const dx = this.p.x - o.x;
        const dy = this.p.y - o.y;
        const dz = this.p.z - o.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < nearRadius) continue;
        const w = this.weightOf(this.p.x, this.p.y, this.p.z) / pdf / this.bound;
        // The random numbers that decide a candidate star come from its own number (not from a running stream), so the same star
        // is picked or dropped the same way wherever the player stands: standing a bit further on shows (almost) the same stars,
        // seen from a slightly different place.
        if (unit(hash32(this.params.seed, this.tries, 7)) >= w) continue;
        const youngShare = this.s.young * 6 / (this.s.old + this.s.young * 6 + 1e-30);
        // Dust between the player and this star.
        // The dust layer is thin: a straight line between two points that are both high above (or both far below) it never touches it.
        let tau = 0;
        const bothHigh = (o.y > DUST_HEIGHT_LY && this.p.y > DUST_HEIGHT_LY) || (o.y < -DUST_HEIGHT_LY && this.p.y < -DUST_HEIGHT_LY);
        if (!bothHigh) {
          const step = dist / PATH_STEPS;
          for (let i = 0; i < PATH_STEPS; i++) {
            const t = (i + 0.5) / PATH_STEPS;
            this.field.sample(o.x + dx * t, o.y + dy * t, o.z + dz * t, this.s);
            tau += this.s.dust * step;
          }
        }
        const i3 = this.placed * 3;
        this.dirs[i3] = dx / dist;
        this.dirs[i3 + 1] = dy / dist;
        this.dirs[i3 + 2] = dz / dist;
        // Brightness: many dim dots, few bright ones; dust dims, a little more for far stars.
        const h = unit(hash32(this.params.seed, this.tries, 11));
        const c = unit(hash32(this.params.seed, this.tries, 13));
        const bright = (0.35 + 0.65 * h * h) / (1 + dist / 40000);
        const base = c < youngShare * 1.5 ? BLUE : c < 0.6 ? WARM : WHITE;
        this.colors[i3] = Math.min(1, bright * base[0] * Math.exp(-tau * DUST_RGB[0]));
        this.colors[i3 + 1] = Math.min(1, bright * base[1] * Math.exp(-tau * DUST_RGB[1]));
        this.colors[i3 + 2] = Math.min(1, bright * base[2] * Math.exp(-tau * DUST_RGB[2]));
        this.placed++;
      }
      if (now() - start >= budgetMs) break;
    }
    this.workMs += now() - start;
    return this.done;
  }

  /** The finished dots, in the same shape the sky stars use. */
  result(): FaintStars {
    return { count: this.placed, dirs: this.dirs.subarray(0, this.placed * 3), colors: this.colors.subarray(0, this.placed * 3) };
  }
}

/** Builds all dots at once (tests and measurements). */
export function buildDots(field: GalaxyField, proposal: StarProposal, origin: Vec3, params: DotParams): { stars: FaintStars; ms: number } {
  const b = new DotsBuilder(field, proposal, origin, params);
  const t0 = performance.now();
  b.run(Infinity);
  return { stars: b.result(), ms: performance.now() - t0 };
}
