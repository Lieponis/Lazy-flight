import { describe, expect, it } from "vitest";
import {
  CAMERA_REACH,
  FAR_DISTANCE,
  FLOAT_STYLES,
  RING_CLEARANCE,
  STAR_DIRECTION,
  arriveOffset,
  clearanceOf,
  departOffset,
  dot,
  floatDrift,
  floatLayout,
  lengthOf,
  parseFloatPreview,
  parseFloatStyle,
  ringHeight,
  ringNormalWorld,
  starDrawRadius,
  tiltForClearance,
} from "../src/render/floatmath";

describe("floating scene: layouts", () => {
  it("there are three layouts and the planet never touches the camera's reach", () => {
    expect(FLOAT_STYLES).toHaveLength(3);
    for (const s of FLOAT_STYLES) expect(clearanceOf(floatLayout(s))).toBeGreaterThan(5);
  });
  it("the ship's own flyby of the planet never touches it: the closest point stays clear", () => {
    // The planet slides in/out in a straight line from the ship's side; the distance from the ship only grows (see below),
    // so the end pose is the closest it ever gets.
    for (const s of FLOAT_STYLES) {
      const l = floatLayout(s);
      expect(lengthOf(l.centre) - l.radius).toBeGreaterThan(CAMERA_REACH);
    }
  });
  it("A is the biggest planet, C the smallest", () => {
    expect(floatLayout("A").radius).toBeGreaterThan(floatLayout("B").radius);
    expect(floatLayout("B").radius).toBeGreaterThan(floatLayout("C").radius);
  });
  it("test links", () => {
    expect(parseFloatStyle("?float=b")).toBe("B");
    expect(parseFloatStyle("?float=Z")).toBe(null);
    expect(parseFloatPreview("?floatpreview=1")).toBe(true);
    expect(parseFloatPreview("?floatpreview=0")).toBe(false);
    expect(parseFloatPreview("")).toBe(false);
  });
});

describe("floating scene: leaving and arriving", () => {
  for (const s of FLOAT_STYLES) {
    const c = floatLayout(s).centre;
    it(`style ${s}: leaving never brings the planet closer to the ship, and ends far away`, () => {
      let last = lengthOf(c);
      for (let i = 1; i <= 100; i++) {
        const o = departOffset(c, i / 100);
        const d = lengthOf({ x: c.x + o.x, y: c.y + o.y, z: c.z + o.z });
        expect(d).toBeGreaterThanOrEqual(last - 1e-9);
        last = d;
      }
      expect(last).toBeGreaterThan(FAR_DISTANCE * 0.9);
      const none = departOffset(c, 0);
      expect(lengthOf(none)).toBe(0);
    });
    it(`style ${s}: arriving only ever brings the planet closer, and ends in the floating pose`, () => {
      let last = Infinity;
      for (let i = 0; i <= 100; i++) {
        const o = arriveOffset(c, i / 100);
        const d = lengthOf({ x: c.x + o.x, y: c.y + o.y, z: c.z + o.z });
        expect(d).toBeLessThanOrEqual(last + 1e-9);
        last = d;
      }
      expect(lengthOf(arriveOffset(c, 1))).toBe(0);
      expect(lengthOf(arriveOffset(c, 0))).toBeCloseTo(FAR_DISTANCE, 6);
    });
  }
  it("arriving slows down at the end (the planet settles gently)", () => {
    const c = floatLayout("B").centre;
    const early = lengthOf(arriveOffset(c, 0.1)) - lengthOf(arriveOffset(c, 0.2));
    const late = lengthOf(arriveOffset(c, 0.8)) - lengthOf(arriveOffset(c, 0.9));
    expect(late).toBeLessThan(early);
  });
  it("the drift is small and never stands still", () => {
    for (let t = 0; t < 300; t += 7) expect(lengthOf(floatDrift(t))).toBeLessThan(4);
    expect(lengthOf({ x: floatDrift(0).x - floatDrift(40).x, y: 0, z: 0 })).toBeGreaterThan(0.1);
  });
});

describe("floating scene: rings never cut through the ship", () => {
  for (const s of FLOAT_STYLES) {
    it(`style ${s}: the ring plane stays ${RING_CLEARANCE} or more away from the ship`, () => {
      const c = floatLayout(s).centre;
      const distance = lengthOf(c);
      const tilt = tiltForClearance(distance);
      const toShip = { x: -c.x / distance, y: -c.y / distance, z: -c.z / distance };
      const n = ringNormalWorld(toShip, tilt);
      expect(lengthOf(n)).toBeCloseTo(1, 6);
      // distance from the ship to the plane through the planet's centre with normal n
      const h = Math.abs(dot(n, toShip)) * distance;
      expect(h).toBeGreaterThanOrEqual(RING_CLEARANCE - 1e-6);
      expect(ringHeight(distance, tilt)).toBeCloseTo(h, 6);
    });
  }
  it("a far planet can be tilted a lot, a near one hardly at all", () => {
    expect(tiltForClearance(200)).toBeGreaterThan(tiltForClearance(30));
    expect(tiltForClearance(RING_CLEARANCE)).toBeCloseTo(0, 6);
  });
});

describe("floating scene: the star", () => {
  it("is a unit direction and a sensible size", () => {
    expect(lengthOf(STAR_DIRECTION)).toBeCloseTo(1, 6);
    expect(starDrawRadius(0.1)).toBe(35);
    expect(starDrawRadius(10)).toBe(120);
    expect(starDrawRadius(1.2)).toBeCloseTo(66, 6);
  });
});
