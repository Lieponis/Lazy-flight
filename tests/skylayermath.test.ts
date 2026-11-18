import { describe, expect, it } from "vitest";
import { SKY_LAYER_FADE_SECONDS, SKY_LAYER_MIN_NEAR_LY, fadeStep, layerLevels, layerNearRadius } from "../src/render/galaxy/skylayermath";
import { MAP_SKY_GLOW, SYSTEM_SKY_BUDGET_MS, SYSTEM_SKY_FAINT, SYSTEM_SKY_NEAR_SPACINGS } from "../src/render/settings";

// The faint galaxy backdrop behind the system view (Andy: "very faint backdrop of the galaxy, same as in the galaxy map, for immersion").
// These are the small sums (how faint, how it fades in, how much around you is left out).

describe("the faint backdrop's settings", () => {
  it("is faint (well under half of the map's brightness) but not off", () => {
    expect(SYSTEM_SKY_FAINT).toBeGreaterThan(0.05);
    expect(SYSTEM_SKY_FAINT).toBeLessThan(0.5);
    expect(SYSTEM_SKY_NEAR_SPACINGS).toBeGreaterThan(0);
    expect(SYSTEM_SKY_BUDGET_MS).toBeGreaterThan(0);
    expect(SYSTEM_SKY_BUDGET_MS).toBeLessThanOrEqual(6); // never more than the map's own slice
  });
});

describe("fade-in", () => {
  it("starts invisible, reaches fully there after the fade time, and never leaves 0..1", () => {
    expect(fadeStep(0, 0)).toBe(0);
    expect(fadeStep(0, SKY_LAYER_FADE_SECONDS / 2)).toBeCloseTo(0.5, 6);
    expect(fadeStep(0, SKY_LAYER_FADE_SECONDS)).toBe(1);
    expect(fadeStep(0.9, 10)).toBe(1);
    expect(fadeStep(1, 5)).toBe(1);
  });
  it("ignores a bad or backwards time step", () => {
    expect(fadeStep(0.4, -3)).toBeCloseTo(0.4, 6);
    expect(fadeStep(0.4, NaN)).toBeCloseTo(0.4, 6);
    expect(fadeStep(0.4, Infinity)).toBe(0.4);
  });
  it("a zero or negative fade time means fully there at once", () => {
    expect(fadeStep(0, 0.01, 0)).toBe(1);
    expect(fadeStep(0, 0.01, -1)).toBe(1);
  });
  it("gets there in a handful of frames at 60 fps, smoothly (no jump bigger than 2 % per frame)", () => {
    let fade = 0;
    let worst = 0;
    let frames = 0;
    while (fade < 1 && frames < 1000) {
      const next = fadeStep(fade, 1 / 60);
      worst = Math.max(worst, next - fade);
      fade = next;
      frames++;
    }
    expect(fade).toBe(1);
    expect(frames).toBeLessThan(Math.ceil(SKY_LAYER_FADE_SECONDS * 60) + 2);
    expect(worst).toBeLessThan(0.02);
  });
});

describe("how bright the backdrop is drawn", () => {
  it("is the map's own look scaled down: glow = map glow x faint, dots = faint", () => {
    const l = layerLevels(SYSTEM_SKY_FAINT, 1, MAP_SKY_GLOW);
    expect(l.glow).toBeCloseTo(MAP_SKY_GLOW * SYSTEM_SKY_FAINT, 9);
    expect(l.dim).toBeCloseTo(SYSTEM_SKY_FAINT, 9);
    expect(l.glow).toBeLessThan(MAP_SKY_GLOW);
  });
  it("fades from nothing to that", () => {
    expect(layerLevels(0.25, 0, 0.24)).toEqual({ glow: 0, dim: 0 });
    const half = layerLevels(0.25, 0.5, 0.24);
    expect(half.dim).toBeCloseTo(0.125, 9);
    expect(half.glow).toBeCloseTo(0.03, 9);
  });
  it("1 means exactly the map's look, and 0 is off", () => {
    expect(layerLevels(1, 1, 0.24)).toEqual({ glow: 0.24, dim: 1 });
    expect(layerLevels(0, 1, 0.24)).toEqual({ glow: 0, dim: 0 });
  });
  it("never goes outside 0..1, whatever it is given", () => {
    expect(layerLevels(5, 5, 0.24)).toEqual({ glow: 0.24, dim: 1 });
    expect(layerLevels(-2, 1, 0.24)).toEqual({ glow: 0, dim: 0 });
    expect(layerLevels(NaN, 1, 0.24)).toEqual({ glow: 0, dim: 0 });
    expect(layerLevels(0.25, NaN, 0.24)).toEqual({ glow: 0, dim: 0 });
  });
});

describe("how much is left out around the viewer", () => {
  it("is a few star gaps (3 gaps of 8 ly at the start = 24 ly) and never less than the minimum", () => {
    expect(layerNearRadius(8, 3)).toBe(24);
    expect(layerNearRadius(1.8, 3)).toBeCloseTo(5.4, 9); // the dense centre
    expect(layerNearRadius(0.1, 3)).toBe(SKY_LAYER_MIN_NEAR_LY);
    expect(layerNearRadius(134, 3)).toBe(402); // the rim
  });
  it("falls back to an 8 ly gap for a bad spacing", () => {
    for (const bad of [0, -5, NaN, Infinity]) expect(layerNearRadius(bad, 3)).toBe(24);
  });
});
