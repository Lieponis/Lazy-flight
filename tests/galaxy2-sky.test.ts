// Agent 2, stage G1: lineIntegralDensity (the density added up along a line of sight; the sky is built from it).
import { describe, expect, it } from "vitest";
import { START_POINT, densityAt, lineIntegralDensity, thicknessAt, spacingAt, DISC_RADIUS, systemsWithin } from "../src/universe/galaxy";

describe("lineIntegralDensity", () => {
  it("straight through the middle of the thick centre equals density x 0.75 x thickness", () => {
    const sum = lineIntegralDensity({ x: 0, y: -1500, z: 0 }, { x: 0, y: 1, z: 0 }, 3000, 3000);
    const expected = (0.75 * thicknessAt(0)) / spacingAt(0) ** 3;
    expect(Math.abs(sum / expected - 1)).toBeLessThan(0.01);
  });

  it("does not depend on how long the direction vector is", () => {
    const a = lineIntegralDensity(START_POINT, { x: 1, y: 0.1, z: 0.3 }, 2000, 200);
    const b = lineIntegralDensity(START_POINT, { x: 50, y: 5, z: 15 }, 2000, 200);
    expect(b).toBeCloseTo(a, 9);
  });

  it("adds up: two halves of a line give the whole line", () => {
    const d = { x: 0.8, y: 0.05, z: -0.6 };
    const whole = lineIntegralDensity(START_POINT, d, 4000, 4000);
    const len = Math.hypot(d.x, d.y, d.z);
    const half = lineIntegralDensity(START_POINT, d, 2000, 2000);
    const second = lineIntegralDensity(
      { x: START_POINT.x + (d.x / len) * 2000, y: START_POINT.y + (d.y / len) * 2000, z: START_POINT.z + (d.z / len) * 2000 },
      d,
      2000,
      2000,
    );
    expect(Math.abs((half + second) / whole - 1)).toBeLessThan(0.002);
  });

  it("is 0 for nothing to look through (zero length, no steps, outside the disc, looking away from it)", () => {
    expect(lineIntegralDensity(START_POINT, { x: 1, y: 0, z: 0 }, 0, 10)).toBe(0);
    expect(lineIntegralDensity(START_POINT, { x: 0, y: 0, z: 0 }, 100, 10)).toBe(0);
    expect(lineIntegralDensity(START_POINT, { x: 1, y: 0, z: 0 }, 100, 0)).toBe(0);
    expect(lineIntegralDensity({ x: 0, y: 5000, z: 0 }, { x: 0, y: 1, z: 0 }, 5000, 50)).toBe(0);
    expect(lineIntegralDensity({ x: DISC_RADIUS + 10, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 5000, 50)).toBe(0);
  });

  it("the sky differs with where you stand: along the plane it is far brighter than up out of the disc, and brighter towards the centre than the rim", () => {
    const along = lineIntegralDensity(START_POINT, { x: -START_POINT.x, y: 0, z: -START_POINT.z }, 16000, 400);
    const away = lineIntegralDensity(START_POINT, { x: START_POINT.x, y: 0, z: START_POINT.z }, 16000, 400);
    const up = lineIntegralDensity(START_POINT, { x: 0, y: 1, z: 0 }, 16000, 400);
    expect(along).toBeGreaterThan(away);
    expect(along).toBeGreaterThan(5 * up);
    expect(up).toBeGreaterThan(0);
    const fromRim = lineIntegralDensity({ x: 49000, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, 20000, 400);
    const fromRimOutward = lineIntegralDensity({ x: 49000, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 20000, 400);
    expect(fromRim).toBeGreaterThan(10 * fromRimOutward);
  });

  it("agrees with counting real systems in a narrow tube (statistical check)", () => {
    // Column density times the tube's cross-section = expected systems in the tube.
    const dir = { x: 1, y: 0, z: 0 };
    const length = 300;
    const radius = 40;
    const o = { x: START_POINT.x, y: 0, z: START_POINT.z };
    const column = lineIntegralDensity(o, dir, length, 300);
    const expected = column * Math.PI * radius * radius;
    const real = systemsWithin(12345, { x: o.x + length / 2, y: 0, z: o.z }, length / 2 + radius).filter(
      (s) => s.x >= o.x && s.x <= o.x + length && Math.hypot(s.y - o.y, s.z - o.z) <= radius,
    ).length;
    expect(Math.abs(real / expected - 1)).toBeLessThan(0.1);
    expect(densityAt(o)).toBeGreaterThan(0);
  });
});
