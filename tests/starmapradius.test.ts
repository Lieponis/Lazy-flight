import { describe, expect, it } from "vitest";
import { parseMapAt, parseReachParam, starLabelText, starmapHint } from "../src/render/starmapradius";
import { DISC_RADIUS, START_POINT, thicknessAt } from "../src/universe";

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

describe("?mapat= testing aid (look at the map from the centre, the start, the middle or the rim)", () => {
  it("knows the four places of stage G5a", () => {
    const centre = parseMapAt("?mapat=centre", START_POINT);
    const start = parseMapAt("?mapat=start", START_POINT);
    const middle = parseMapAt("?mapat=middle", START_POINT);
    const rim = parseMapAt("?mapat=rim", START_POINT);
    expect([centre?.name, start?.name, middle?.name, rim?.name]).toEqual(["centre", "start", "middle", "rim"]);
    expect(start?.position).toEqual({ x: START_POINT.x, y: START_POINT.y, z: START_POINT.z });
    const radius = (p?: { position: { x: number; z: number } }): number => Math.hypot(p?.position.x ?? 0, p?.position.z ?? 0);
    expect(Math.abs(radius(centre) - 400)).toBeLessThan(1e-6);
    expect(Math.abs(radius(middle) - 30000)).toBeLessThan(1e-6);
    expect(Math.abs(radius(rim) - 48000)).toBeLessThan(1e-6);
    expect(radius(rim) < DISC_RADIUS).toBe(true); // inside the disc, near its rim
    expect(thicknessAt(radius(centre)) > thicknessAt(radius(rim))).toBe(true); // the centre is the thick, dense part
    expect(parseMapAt("?mapat=CENTER", START_POINT)?.name).toBe("centre");
  });

  it("takes three numbers too, and ignores everything else", () => {
    expect(parseMapAt("?mapat=1,2,3", START_POINT)?.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(parseMapAt("?mapat=-16000,40,1900", START_POINT)?.position).toEqual({ x: -16000, y: 40, z: 1900 });
    for (const bad of ["", "?x=1", "?mapat=", "?mapat=moon", "?mapat=1,2", "?mapat=1,2,x", "?mapat=1,2,3,4"]) expect(parseMapAt(bad, START_POINT)).toBeNull();
  });
});
