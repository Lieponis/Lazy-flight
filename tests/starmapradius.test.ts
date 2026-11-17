import { describe, expect, it } from "vitest";
import { parseReachParam, starLabelText, starmapHint } from "../src/render/starmapradius";

// Stage G5a: the map no longer takes its size from the ship's reach (it shows the nearest stars by count; the reach only decides which
// of them get a diamond), so the old radius and camera-limit checks are gone. What is left: the words and the ?reach= testing aid.

describe("the map hint", () => {
  it("tells how to select, turn and zoom, and says nothing about the map being cut off", () => {
    const text = starmapHint();
    expect(text).toContain("Tap a star");
    expect(text).toContain("zoom");
    expect(text.includes("Farther")).toBe(false);
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

describe("?reach= testing aid", () => {
  it("reads a positive number, ignores everything else", () => {
    expect(parseReachParam("?reach=60")).toBe(60);
    expect(parseReachParam("?speed=5&reach=42.5")).toBe(42.5);
    for (const bad of ["", "?reach=", "?reach=abc", "?reach=-3", "?reach=0", "?reach=99999"]) expect(parseReachParam(bad)).toBeNull();
  });
});
