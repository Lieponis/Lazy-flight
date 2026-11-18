// THE FAINT GALAXY BACKDROP BEHIND A 3D SCREEN (the system view). Owns one sky (glow + dots) for the place the screen is at.
//
// Plain words: it is the same sky the galaxy map draws (the same builders, from the real universe's shape), but drawn very faintly
// behind a screen that has no stars of its own, for immersion. It is built a few milliseconds per frame in the background (the screen
// stays smooth), it fades in when it is ready, and when you go to another system in another "sky cell" the old sky stays on screen
// until the new one is ready. Nothing here changes the game: it is decoration only.

import type * as THREE from "three";
import { standInProposal, type GalaxyField } from "./galaxyfield";
import { skyCellOf } from "./skycell";
import { SkyBuilder, type Vec3 } from "./skyglow";
import { DotsBuilder } from "./skydots";
import { skyToTexels } from "./skylook";
import { fadeStep, layerLevels, layerNearRadius } from "./skylayermath";
import { SkyView } from "./skyview";
import { universeField, type SkyFunctions } from "./universefield";

export interface SkyLayerOptions {
  /** How much of the map's look is left: 1 = exactly the map's sky, 0.25 = a quarter as bright. */
  faint: number;
  /** The map's own glow strength (the layer scales it by `faint`). */
  glow: number;
  dots: number;
  faceSize: 32 | 64 | 128;
  steps: number;
  /** Stars closer than this many star gaps (of the local spacing) are left out of the sky. */
  nearSpacings: number;
  /** Milliseconds per frame the build may use. */
  budgetMs: number;
}

interface Pending {
  key: string;
  glow: SkyBuilder;
  dots: DotsBuilder;
}

export class SkyLayer {
  readonly view = new SkyView();
  private readonly field: GalaxyField;
  private pending: Pending | null = null;
  private builtKey: string | null = null;
  private fade = 0;
  private builtDots = 0;

  constructor(
    private readonly fns: SkyFunctions,
    private readonly opts: SkyLayerOptions,
  ) {
    this.field = universeField(fns);
    this.view.setVisible(true, true);
    this.apply();
  }

  /** True once a sky has been built and is (at least partly) faded in. */
  get visible(): boolean {
    return this.builtKey !== null && this.fade > 0;
  }

  /** How many dots the last finished sky has (for tests and the report). */
  get dotCount(): number {
    return this.builtDots;
  }

  /** Where the screen is now (galaxy position in light years). Starts a new build only when this is another sky cell. */
  setPosition(position: Vec3): void {
    const fns = this.fns;
    const cell = skyCellOf(position, (r) => fns.thickness(r) / 3);
    const nearRadius = layerNearRadius(fns.spacing(Math.hypot(position.x, position.z)), this.opts.nearSpacings);
    const key = `${cell.key}|${Math.round(nearRadius)}|${this.opts.faceSize}|${this.opts.dots}`;
    if (key === this.builtKey || this.pending?.key === key) return;
    this.pending = {
      key,
      glow: new SkyBuilder(this.field, cell.centre, { faceSize: this.opts.faceSize, steps: this.opts.steps, nearRadius }),
      dots: new DotsBuilder(this.field, standInProposal, cell.centre, { count: this.opts.dots, nearRadius, seed: cell.starSeed, squeeze: 0.5 }),
    };
  }

  /**
   * Works on the build for about `budgetMs` (glow first, then dots); puts a finished sky on screen. `watching` = the screen is showing
   * right now: then the first sky fades in. Built in the background (not watching) it is simply fully there when the screen opens.
   */
  step(budgetMs: number, watching: boolean = true): void {
    const p = this.pending;
    if (!p) return;
    if (!p.glow.done) p.glow.run(budgetMs);
    else if (!p.dots.done) p.dots.run(budgetMs);
    if (!(p.glow.done && p.dots.done)) return;
    this.pending = null;
    const dots = p.dots.result();
    this.view.setTexels(skyToTexels(p.glow.raw), p.glow.layout);
    this.view.setStars(dots);
    this.builtDots = dots.count;
    if (this.builtKey === null) this.fade = watching ? 0 : 1; // the first sky fades in if someone is looking; a replacement keeps its strength
    this.builtKey = p.key;
    this.apply();
  }

  /** Builds a little while the screen is NOT showing (the app calls this on other screens), so the sky is ready before it is needed. */
  warm(budgetMs: number): void {
    this.step(budgetMs, false);
  }

  /** Every frame: builds a little, fades in, and turns the sky the way the camera is turned. */
  update(seconds: number, camera: THREE.PerspectiveCamera): void {
    this.step(this.opts.budgetMs);
    if (this.builtKey !== null) this.fade = fadeStep(this.fade, seconds);
    this.apply();
    this.view.follow(camera);
  }

  /** Draws the sky (call first, before the screen's own scene). Does nothing until a sky is built. */
  draw(renderer: THREE.WebGLRenderer): void {
    if (this.visible) renderer.render(this.view.scene, this.view.camera);
  }

  private apply(): void {
    const levels = layerLevels(this.opts.faint, this.fade, this.opts.glow);
    this.view.setGlowStrength(levels.glow);
    this.view.setDim(levels.dim);
  }

  dispose(): void {
    this.view.dispose();
  }
}
