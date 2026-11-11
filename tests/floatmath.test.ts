import { describe, expect, it } from "vitest";
import {
  CAMERA_REACH,
  FAR_DISTANCE,
  FLOAT_STYLES,
  RING_CLEARANCE,
  STAR_DIRECTION,
  ARRIVE_HOLD,
  arriveEase,
  CLIMB_ANGLE,
  arrivePose,
  clearanceOf,
  departPose,
  noseDirection,
  shipRoll,
  SHIP_ROLL_AMOUNT,
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
    it(`style ${s}: leaving starts in the floating pose, never brings the planet closer, and ends far away`, () => {
      const start = departPose(c, 0);
      expect(lengthOf({ x: start.centre.x - c.x, y: start.centre.y - c.y, z: start.centre.z - c.z })).toBeLessThan(1e-9);
      expect(start.pitch).toBe(0);
      let last = lengthOf(c);
      for (let i = 1; i <= 100; i++) {
        const d = lengthOf(departPose(c, i / 100).centre);
        expect(d).toBeGreaterThanOrEqual(last - 1e-9);
        last = d;
      }
      expect(last).toBeGreaterThan(FAR_DISTANCE * 0.8);
    });
    it(`style ${s}: leaving pitches the nose up, then straightens out again so it is level when the warp starts`, () => {
      expect(departPose(c, 0).pitch).toBe(0);
      expect(departPose(c, 1).pitch).toBeCloseTo(0, 9);
      let peak = 0;
      let last = 0;
      for (let i = 0; i <= 200; i++) {
        const a = departPose(c, i / 200).pitch;
        peak = Math.max(peak, a);
        expect(Math.abs(a - last)).toBeLessThan(0.03); // no sudden turns
        last = a;
      }
      expect(peak).toBeCloseTo(CLIMB_ANGLE, 1);
    });
    it(`style ${s}: arriving only ever brings the planet closer, nose slightly down, and ends in the floating pose`, () => {
      let last = Infinity;
      for (let i = 0; i <= 100; i++) {
        const pose = arrivePose(c, i / 100);
        const d = lengthOf(pose.centre);
        expect(d).toBeLessThanOrEqual(last + 1e-9);
        expect(pose.pitch).toBeLessThanOrEqual(1e-9);
        last = d;
      }
      const end = arrivePose(c, 1);
      expect(lengthOf({ x: end.centre.x - c.x, y: end.centre.y - c.y, z: end.centre.z - c.z })).toBeLessThan(1e-9);
      expect(end.pitch).toBeCloseTo(0, 9);
      expect(lengthOf(arrivePose(c, 0).centre)).toBeGreaterThan(FAR_DISTANCE * 0.8);
      expect(arrivePose(c, 0).pitch).toBeCloseTo(0, 9); // level, like the warp it comes out of
      // The first part of the approach holds still (same view as the warp), then it eases into the arrival.
      expect(lengthOf(arrivePose(c, 0).centre)).toBeCloseTo(lengthOf(arrivePose(c, ARRIVE_HOLD).centre), 6);
    });
    it(`style ${s}: the planet is never in the way (the ship stays clear of the surface all through leaving and arriving)`, () => {
      const r = floatLayout(s).radius;
      for (let i = 0; i <= 100; i++) {
        expect(lengthOf(departPose(c, i / 100).centre)).toBeGreaterThan(r + CAMERA_REACH);
        expect(lengthOf(arrivePose(c, i / 100).centre)).toBeGreaterThan(r + CAMERA_REACH);
      }
    });
  }
  it("docks use the same arrival easing: holds, then eases to 1", () => {
    expect(arriveEase(0)).toBe(0);
    expect(arriveEase(ARRIVE_HOLD)).toBe(0);
    expect(arriveEase(1)).toBe(1);
    let last = 0;
    for (let i = 0; i <= 100; i++) {
      const v = arriveEase(i / 100);
      expect(v).toBeGreaterThanOrEqual(last - 1e-12);
      last = v;
    }
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

describe("floating scene: nose along the surface, roll, launch from the surface", () => {
  for (const s of FLOAT_STYLES) {
    it(`style ${s}: the ship's nose (0,0,-1) is along the surface`, () => {
      const c = floatLayout(s).centre;
      const d = lengthOf(c);
      const n = ringNormalWorld({ x: -c.x / d, y: -c.y / d, z: -c.z / d }, tiltForClearance(d));
      const nose = noseDirection(n, c);
      expect(nose.x).toBeCloseTo(0, 6);
      expect(nose.y).toBeCloseTo(0, 6);
      expect(nose.z).toBeCloseTo(-1, 6);
      expect(Math.abs(dot(nose, c))).toBeLessThan(1e-6); // at a right angle to the line to the planet: along the surface
    });
  }
  it("the roll is slow and gentle, and goes both ways", () => {
    let lo = 0;
    let hi = 0;
    for (let t = 0; t < 120; t += 0.5) {
      lo = Math.min(lo, shipRoll(t));
      hi = Math.max(hi, shipRoll(t));
    }
    expect(hi).toBeLessThanOrEqual(SHIP_ROLL_AMOUNT + 1e-9);
    expect(lo).toBeGreaterThanOrEqual(-SHIP_ROLL_AMOUNT - 1e-9);
    expect(hi).toBeGreaterThan(0.1);
    expect(lo).toBeLessThan(-0.1);
    expect(shipRoll(0)).toBe(0);
  });
});
