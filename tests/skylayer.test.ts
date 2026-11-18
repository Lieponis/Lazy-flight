import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { SkyLayer, type SkyLayerOptions } from "../src/render/galaxy/skylayer";
import { SkyView } from "../src/render/galaxy/skyview";
import { makeMapSource } from "../src/mapsource";
import { START_POINT, WORLD_SEED } from "../src/universe";

// The faint galaxy backdrop behind the system view: the real thing (SkyLayer + SkyView, real three.js objects, the real universe's sky
// functions), small and quick (a coarse glow, a few thousand dots). No graphics card is needed: nothing is drawn, only built and counted.

const sky = makeMapSource(WORLD_SEED).sky;
const OPTS: SkyLayerOptions = { faint: 0.25, glow: 0.24, dots: 3000, faceSize: 32, steps: 24, nearSpacings: 3, budgetMs: 4 };
const RIM = { x: 48_000 * Math.cos(5.2), y: 0, z: 48_000 * Math.sin(5.2) };

function pendingOf(layer: SkyLayer): unknown {
  return (layer as unknown as { pending: unknown }).pending;
}

/** Runs frames (a tenth of a second each) until the layer has nothing pending, returning how many it took. */
function settle(layer: SkyLayer, camera: THREE.PerspectiveCamera, onFrame?: () => void): number {
  let frames = 0;
  while (frames < 20_000) {
    layer.update(0.1, camera);
    onFrame?.();
    frames++;
    if (pendingOf(layer) === null) break;
  }
  return frames;
}

describe("the dot brightness of a sky view", () => {
  it("is 1 (the map's own colours) by default, and stays inside 0..1", () => {
    const view = new SkyView();
    expect(view.dim).toBe(1);
    view.setDim(0.25);
    expect(view.dim).toBe(0.25);
    view.setDim(5);
    expect(view.dim).toBe(1);
    view.setDim(-1);
    expect(view.dim).toBe(0);
    view.setDim(NaN);
    expect(view.dim).toBe(1);
    view.dispose();
  });
});

describe("the faint sky layer (real universe)", () => {
  it("the glue gives the sky functions", () => {
    expect(sky).toBeDefined();
  });

  it("draws nothing until a sky is built, then fades in to the faint level and draws once per frame", () => {
    const layer = new SkyLayer(sky!, OPTS);
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 700);
    const calls: unknown[][] = [];
    const renderer = { render: (...args: unknown[]) => void calls.push(args) } as unknown as THREE.WebGLRenderer;
    layer.draw(renderer);
    expect(layer.visible).toBe(false);
    expect(calls.length).toBe(0);
    layer.setPosition(START_POINT);
    expect(pendingOf(layer)).not.toBeNull();
    expect(layer.visible).toBe(false); // started, not built
    layer.update(0.016, camera); // a slice of work; a coarse sky needs more than one
    settle(layer, camera);
    expect(pendingOf(layer)).toBeNull();
    expect(layer.visible).toBe(true);
    expect(layer.dotCount).toBeGreaterThan(2000);
    expect(layer.dotCount).toBeLessThanOrEqual(OPTS.dots);
    for (let i = 0; i < 30; i++) layer.update(0.1, camera); // 3 seconds: the fade is over
    expect(layer.view.dim).toBeCloseTo(OPTS.faint, 9);
    layer.draw(renderer);
    expect(calls.length).toBe(1);
    expect(calls[0]?.[0]).toBe(layer.view.scene);
    expect(calls[0]?.[1]).toBe(layer.view.camera);
    layer.dispose();
  });

  it("starts at nothing and gets brighter step by step (no sudden pop)", () => {
    const layer = new SkyLayer(sky!, OPTS);
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 700);
    layer.setPosition(START_POINT);
    settle(layer, camera);
    const seen: number[] = [];
    for (let i = 0; i < 40; i++) {
      layer.update(1 / 60, camera);
      seen.push(layer.view.dim);
    }
    expect(seen[0] as number).toBeLessThan(0.05);
    for (let i = 1; i < seen.length; i++) expect(seen[i] as number).toBeGreaterThanOrEqual(seen[i - 1] as number);
    expect(seen[seen.length - 1] as number).toBeLessThanOrEqual(OPTS.faint + 1e-12);
    layer.dispose();
  });

  it("asking again from the same sky cell does not start a new build; another sky cell does, and the old sky stays until it is ready", () => {
    const layer = new SkyLayer(sky!, OPTS);
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 700);
    layer.setPosition(START_POINT);
    settle(layer, camera);
    for (let i = 0; i < 20; i++) layer.update(0.1, camera);
    expect(layer.visible).toBe(true);
    layer.setPosition({ x: START_POINT.x + 3, y: START_POINT.y + 1, z: START_POINT.z - 2 }); // a few light years away: the same cell
    expect(pendingOf(layer)).toBeNull();
    layer.setPosition(RIM); // another cell
    expect(pendingOf(layer)).not.toBeNull();
    let alwaysVisible = true;
    settle(layer, camera, () => {
      if (!layer.visible) alwaysVisible = false;
    });
    expect(alwaysVisible).toBe(true);
    expect(pendingOf(layer)).toBeNull();
    expect(layer.dotCount).toBeGreaterThan(1000);
    layer.dispose();
  });

  it("turns the sky the way the camera is turned (and only turns: it never moves with the camera)", () => {
    const layer = new SkyLayer(sky!, OPTS);
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 700);
    camera.position.set(30, 20, 10);
    camera.lookAt(0, 0, 0);
    layer.update(0.016, camera);
    expect(layer.view.camera.quaternion.angleTo(camera.quaternion)).toBeLessThan(1e-9);
    expect(layer.view.camera.position.length()).toBe(0);
    layer.dispose();
  });

  it("with the strength at 0 the dots are off (a layer with faint 0 stays dark)", () => {
    const layer = new SkyLayer(sky!, { ...OPTS, faint: 0 });
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 700);
    layer.setPosition(START_POINT);
    settle(layer, camera);
    for (let i = 0; i < 20; i++) layer.update(0.1, camera);
    expect(layer.view.dim).toBe(0);
    layer.dispose();
  });
});
