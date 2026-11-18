import { describe, expect, it } from "vitest";
import { START_POINT } from "../src/universe";
import { BULGE, armFactor, bulgeDensityXYZ, densityAt, discDensityAt, spacingAt, thicknessAt } from "../src/universe/galaxy";
import { integrateRay, type SkyParams } from "../src/render/galaxy/skyglow";
import { skyCellOf } from "../src/render/galaxy/skycell";
import { UNIVERSE_BULGE_REACH_LY, universeField, type SkyFunctions } from "../src/render/galaxy/universefield";
import type { FieldSample, GalaxyField } from "../src/render/galaxy/galaxyfield";

// G7b: the universe now has a central bulge (Agent 2, stage G7). The sky glow adds up the light along each ray in a few big steps;
// far away the steps are thousands of light years long, so a bulge about 11,000 ly across could be stepped over or hit by one lucky
// sample (measured: the system view's coarse sky showed the bulge 2.7 times too bright from the middle of the disc). Inside the bulge
// ball the glow now takes steps of at most a tenth of the ball's radius. These tests use the real universe's real density.

const pt = { x: 0, y: 0, z: 0 };
function functions(discOnly: boolean): SkyFunctions {
  return {
    density(x, y, z) {
      pt.x = x;
      pt.y = y;
      pt.z = z;
      return discOnly ? discDensityAt(pt) : densityAt(pt);
    },
    spacing: spacingAt,
    thickness: thicknessAt,
    armFactor,
  };
}
const withBulge = universeField(functions(false));
const discOnly = universeField(functions(true));

const polar = (r: number, angle: number) => ({ x: r * Math.cos(angle), y: 0, z: r * Math.sin(angle) });
const deg = Math.PI / 180;
const sample: FieldSample = { old: 0, young: 0, dust: 0 };
const rgb = new Float32Array(3);

function light(field: GalaxyField, origin: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }, params: SkyParams): number {
  integrateRay(field, origin, d.x, d.y, d.z, params, sample, rgb, 0);
  return rgb[1] ?? 0;
}

/** The light the bulge adds (with minus without), summed over a patch of sky around the direction of the galaxy centre. */
function bulgeLight(origin: { x: number; y: number; z: number }, params: SkyParams): { all: number; bulge: number } {
  const base = Math.atan2(-origin.z, -origin.x);
  let all = 0;
  let bulge = 0;
  for (const lat of [-10, -6, -2, 2, 6, 10]) {
    for (let lon = -24; lon <= 24; lon += 2) {
      const az = base + lon * deg;
      const el = lat * deg;
      const d = { x: Math.cos(el) * Math.cos(az), y: Math.sin(el), z: Math.cos(el) * Math.sin(az) };
      const a = light(withBulge, origin, d, params);
      all += a;
      bulge += a - light(discOnly, origin, d, params);
    }
  }
  return { all, bulge };
}

describe("the sky glow's copy of the bulge size", () => {
  it("is the universe's real bulge radius, and the real bulge density is zero outside that ball", () => {
    expect(UNIVERSE_BULGE_REACH_LY).toBe(BULGE.radius);
    expect(bulgeDensityXYZ(BULGE.radius * 0.9, 0, 0)).toBeGreaterThan(0);
    let seed = 12345;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 300; i++) {
      const c = rand() * 2 - 1;
      const s = Math.sqrt(1 - c * c);
      const a = rand() * Math.PI * 2;
      const rho = BULGE.radius * (1.0001 + rand());
      expect(bulgeDensityXYZ(rho * s * Math.cos(a), rho * c, rho * s * Math.sin(a))).toBe(0);
    }
  });
});

describe("finer glow steps inside the bulge", () => {
  const origin = skyCellOf(polar(30_000, 4.0), (r) => thicknessAt(r) / 3).centre; // the "middle" place, 30,000 ly from the centre
  const toward = Math.atan2(-origin.z, -origin.x);
  const dirToCentre = { x: Math.cos(toward), y: 0, z: Math.sin(toward) };
  const away = { x: -dirToCentre.x, y: 0, z: -dirToCentre.z };
  const up = { x: 0, y: 1, z: 0 };
  const near = 3 * spacingAt(30_000); // the system view leaves out stars closer than 3 star gaps

  it("leaves a ray that misses the bulge, and any sky built without the setting, exactly as before", () => {
    const off: SkyParams = { faceSize: 32, steps: 24, nearRadius: near };
    const on: SkyParams = { ...off, bulgeReach: UNIVERSE_BULGE_REACH_LY };
    for (const d of [away, up, { x: Math.cos(toward + 1.2), y: 0, z: Math.sin(toward + 1.2) }]) {
      expect(light(withBulge, origin, d, on)).toBe(light(withBulge, origin, d, off));
    }
    expect(light(withBulge, origin, dirToCentre, { ...off, bulgeReach: 0 })).toBe(light(withBulge, origin, dirToCentre, off));
    expect(light(withBulge, origin, dirToCentre, on)).not.toBe(light(withBulge, origin, dirToCentre, off));
  });

  it("takes extra samples only for a ray that crosses the bulge, and only a few", () => {
    let calls = 0;
    const counting: GalaxyField = {
      spacingAt: (x, y, z) => withBulge.spacingAt(x, y, z),
      sample(x, y, z, out) {
        calls++;
        withBulge.sample(x, y, z, out);
      },
    };
    const params: SkyParams = { faceSize: 32, steps: 24, nearRadius: near, bulgeReach: UNIVERSE_BULGE_REACH_LY };
    calls = 0;
    light(counting, origin, away, params);
    expect(calls).toBe(4 + 24);
    calls = 0;
    light(counting, origin, dirToCentre, params);
    expect(calls).toBeGreaterThan(4 + 24 + 8);
    expect(calls).toBeLessThan(4 + 24 + 40);
  });

  it("finds the bulge's light from the middle of the disc with the system view's coarse steps (24): within 20% of a fine reference", () => {
    const fine = bulgeLight(origin, { faceSize: 32, steps: 1500, nearRadius: near });
    const coarseOff = bulgeLight(origin, { faceSize: 32, steps: 24, nearRadius: near });
    const coarseOn = bulgeLight(origin, { faceSize: 32, steps: 24, nearRadius: near, bulgeReach: UNIVERSE_BULGE_REACH_LY });
    expect(fine.bulge).toBeGreaterThan(0);
    // Without the finer steps the bulge is far too bright here (measured about 2.7 times); that is what this setting fixes.
    expect(coarseOff.bulge / fine.bulge).toBeGreaterThan(1.5);
    expect(coarseOn.bulge / fine.bulge).toBeGreaterThan(0.8);
    expect(coarseOn.bulge / fine.bulge).toBeLessThan(1.2);
    expect(coarseOn.all / fine.all).toBeGreaterThan(0.85);
    expect(coarseOn.all / fine.all).toBeLessThan(1.2);
  });

  it("finds the bulge's light from 10,000 ly out with the map's steps (56): within 10% of a fine reference", () => {
    const here = skyCellOf(polar(10_000, 1.0), (r) => thicknessAt(r) / 3).centre;
    const fine = bulgeLight(here, { faceSize: 64, steps: 1500, nearRadius: 96 });
    const map = bulgeLight(here, { faceSize: 64, steps: 56, nearRadius: 96, bulgeReach: UNIVERSE_BULGE_REACH_LY });
    expect(map.bulge / fine.bulge).toBeGreaterThan(0.9);
    expect(map.bulge / fine.bulge).toBeLessThan(1.1);
    expect(map.all / fine.all).toBeGreaterThan(0.95);
    expect(map.all / fine.all).toBeLessThan(1.05);
  });

  it("shows the bulge from the start, too: the glow toward the centre is brighter with the bulge than without", () => {
    const here = skyCellOf({ x: START_POINT.x, y: START_POINT.y, z: START_POINT.z }, (r) => thicknessAt(r) / 3).centre;
    const map = bulgeLight(here, { faceSize: 64, steps: 56, nearRadius: 195, bulgeReach: UNIVERSE_BULGE_REACH_LY });
    expect(map.bulge / map.all).toBeGreaterThan(0.05);
  });
});
