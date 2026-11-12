import { describe, expect, it } from "vitest";
import { parseReachParam, reachBeyondMap, starLabelText, starmapCameraLimits, starmapHint, starmapRadius } from "../src/render/starmapradius";
import { STARMAP_MAX_RADIUS_LY, STARMAP_RADIUS_LY, STARMAP_RADIUS_PAD_LY } from "../src/render/settings";

describe("map radius follows the reach", () => {
  it("is the normal map when nothing is known, or the reach is small, empty or nonsense", () => {
    for (const reach of [null, undefined, 0, -5, NaN, Infinity, 10, 30]) {
      expect(starmapRadius(reach as number | null | undefined)).toBe(STARMAP_RADIUS_LY);
    }
  });
  it("grows a little past the reach, as a whole number of light years", () => {
    expect(starmapRadius(50)).toBe(50 + STARMAP_RADIUS_PAD_LY);
    expect(starmapRadius(50.2)).toBe(54);
    expect(Number.isInteger(starmapRadius(41.37))).toBe(true);
  });
  it("never goes past the cap, and never below the normal map", () => {
    expect(starmapRadius(500)).toBe(STARMAP_MAX_RADIUS_LY);
    expect(starmapRadius(75)).toBe(STARMAP_MAX_RADIUS_LY);
    expect(starmapRadius(70, 60)).toBe(60);
    expect(starmapRadius(100, 20)).toBe(STARMAP_RADIUS_LY); // a silly cap below the normal map: the normal map stays
  });
  it("is never smaller for more fuel (monotonic)", () => {
    let last = 0;
    for (let r = 0; r <= 200; r += 0.5) {
      const v = starmapRadius(r);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });
  it("every ship's full tank fits inside the cap (Hauler 30 ly, Liner 50, Scout 55)", () => {
    for (const reach of [30, 50, 55]) expect(starmapRadius(reach)).toBeLessThanOrEqual(STARMAP_MAX_RADIUS_LY);
    for (const reach of [30, 50, 55]) expect(reachBeyondMap(reach)).toBe(false);
  });
});

describe("the 'farther stars' note", () => {
  it("shows only when the ship reaches farther than the cap", () => {
    expect(reachBeyondMap(null)).toBe(false);
    expect(reachBeyondMap(NaN)).toBe(false);
    expect(reachBeyondMap(STARMAP_MAX_RADIUS_LY)).toBe(false);
    expect(reachBeyondMap(STARMAP_MAX_RADIUS_LY + 0.1)).toBe(true);
  });
  it("is one extra line of the hint", () => {
    expect(starmapHint(false).includes("Farther")).toBe(false);
    expect(starmapHint(true)).toContain("Farther stars are out of the map for now.");
    expect(starmapHint(true).startsWith(starmapHint(false))).toBe(true);
  });
});

describe("a star's label", () => {
  it("is name, star type and distance, with no fuel words", () => {
    const text = starLabelText("Kopipex", "Yellow dwarf", 12.34, false);
    expect(text).toBe("Kopipex\nYellow dwarf - 12.3 ly");
    expect(text.toLowerCase().includes("fuel")).toBe(false);
    expect(text.toLowerCase().includes("range")).toBe(false);
  });
  it("says 'you are here' for the current system", () => {
    expect(starLabelText("Kopipex", "Yellow dwarf", 0, true)).toBe("Kopipex\nYellow dwarf - you are here");
  });
});

describe("camera limits grow with the map", () => {
  it("keeps the old values for the normal map and gives room for a bigger one", () => {
    const small = starmapCameraLimits(35);
    expect(small.maxDist).toBe(91);
    expect(small.backdropRadius).toBe(450);
    const big = starmapCameraLimits(75);
    expect(big.maxDist).toBeGreaterThan(small.maxDist);
    expect(big.far).toBeGreaterThan(big.backdropRadius + big.maxDist); // everything stays inside the far clip
    expect(big.backdropRadius).toBeGreaterThan(big.maxDist); // the background stays outside the camera's reach
  });
});

describe("?reach= testing aid", () => {
  it("reads a positive number, ignores everything else", () => {
    expect(parseReachParam("?reach=60")).toBe(60);
    expect(parseReachParam("?speed=5&reach=42.5")).toBe(42.5);
    for (const bad of ["", "?reach=", "?reach=abc", "?reach=-3", "?reach=0", "?reach=99999"]) expect(parseReachParam(bad)).toBeNull();
  });
});
