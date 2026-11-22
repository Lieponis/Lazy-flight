// Brief 3p: the sky turn stays when the ship lands and when it takes off. The numbers (pure) here; the wiring in skymemorywiring.test.ts.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAUNCH_MODE,
  IDENTITY_QUAT,
  SkyMemory,
  angleBetween,
  headingQuaternion,
  inverseQuat,
  multiplyQuat,
  parseLaunchMode,
  rotateBy,
  slerpQuat,
  tripDirection,
  tripSkyAt,
  type LaunchMode,
  type Quat,
  type Vec3,
} from "../src/render/skyheading";

const MODES: LaunchMode[] = ["A", "B", "C"];
const P: Vec3 = { x: 12_000, y: 0, z: -11_000 };
const toward = (from: Vec3, dir: Vec3, ly: number): Vec3 => ({ x: from.x + dir.x * ly, y: from.y + dir.y * ly, z: from.z + dir.z * ly });
const tripFrame = (dir: Vec3): Quat => headingQuaternion(tripDirection(P, toward(P, dir, 60)))!;
const IN = tripFrame({ x: -0.7, y: 0, z: 0.7 });
const OUT = tripFrame({ x: 0.7, y: 0, z: -0.7 });
const SIDE = tripFrame({ x: 0.6, y: 0.1, z: 0.79 });

describe("3p: turns (the small maths)", () => {
  it("multiplying by the opposite turn gives no turn; the identity changes nothing", () => {
    for (const q of [IN, OUT, SIDE]) {
      expect(angleBetween(multiplyQuat(q, inverseQuat(q)), IDENTITY_QUAT)).toBeCloseTo(0, 6);
      expect(angleBetween(multiplyQuat(IDENTITY_QUAT, q), q)).toBeCloseTo(0, 6);
    }
  });

  it("slerp starts at the first turn, ends at the second, and goes steadily between", () => {
    expect(angleBetween(slerpQuat(IN, OUT, 0), IN)).toBeCloseTo(0, 6);
    expect(angleBetween(slerpQuat(IN, OUT, 1), OUT)).toBeCloseTo(0, 6);
    const whole = angleBetween(IN, OUT);
    expect(angleBetween(IN, slerpQuat(IN, OUT, 0.5))).toBeCloseTo(whole / 2, 5);
    expect(angleBetween(IN, slerpQuat(IN, OUT, 0.25))).toBeCloseTo(whole / 4, 5);
  });
});

describe("3p: the sky turn on a trip", () => {
  it("a hop with no direction leaves the turn exactly as it was (all three take-off options, any moment of the launch)", () => {
    for (const mode of MODES) {
      for (const p of [0, 0.3, 1]) {
        expect(tripSkyAt(SIDE, null, mode, p)).toBe(SIDE);
        expect(tripSkyAt(null, null, mode, p)).toBeNull();
      }
    }
  });

  it("A: starts as the docked sky, turns smoothly during the launch, and is the trip's sky when the launch is over", () => {
    expect(angleBetween(tripSkyAt(SIDE, IN, "A", 0)!, SIDE)).toBeCloseTo(0, 6);
    expect(angleBetween(tripSkyAt(SIDE, IN, "A", 1)!, IN)).toBeCloseTo(0, 6);
    let before = angleBetween(SIDE, tripSkyAt(SIDE, IN, "A", 0)!);
    let biggestStep = 0;
    for (let i = 1; i <= 100; i++) {
      const a = angleBetween(SIDE, tripSkyAt(SIDE, IN, "A", i / 100)!);
      expect(a).toBeGreaterThanOrEqual(before - 1e-9); // never turns back
      biggestStep = Math.max(biggestStep, a - before);
      before = a;
    }
    expect(biggestStep).toBeLessThan(angleBetween(SIDE, IN) * 0.03); // no jump: at most 3 percent of the whole turn in one hundredth of the launch
  });

  it("A with nothing remembered starts from the plain default sky", () => {
    expect(angleBetween(tripSkyAt(null, OUT, "A", 0)!, IDENTITY_QUAT)).toBeCloseTo(0, 6);
    expect(angleBetween(tripSkyAt(null, OUT, "A", 1)!, OUT)).toBeCloseTo(0, 6);
  });

  it("B keeps the docked sky for the whole trip, C jumps to the trip's sky at once", () => {
    for (const p of [0, 0.5, 1]) {
      expect(tripSkyAt(SIDE, IN, "B", p)).toBe(SIDE);
      expect(tripSkyAt(SIDE, IN, "C", p)).toBe(IN);
    }
  });

  it("the word ?skylaunch=A|B|C picks the option; A is the default", () => {
    expect(parseLaunchMode("?skylaunch=b")).toBe("B");
    expect(parseLaunchMode("?x=1&skylaunch=C")).toBe("C");
    expect(parseLaunchMode("?skylaunch=A")).toBe("A");
    expect(parseLaunchMode("?skylaunch=zzz")).toBeNull();
    expect(parseLaunchMode("")).toBeNull();
    expect(DEFAULT_LAUNCH_MODE).toBe("A");
  });
});

describe("3p: landing keeps the sky of the end of the trip", () => {
  it("docked or floating right after a trip uses exactly the turn the trip ended with, for every take-off option", () => {
    for (const mode of MODES) {
      const memory = new SkyMemory();
      const end = tripSkyAt(SIDE, IN, mode, 1); // the turn at the end of the flight
      memory.remember(end, 777);
      const docked = memory.frameFor(777); // what the docked view (or the floating view) starts with
      if (end === null) expect(docked).toBeNull();
      else expect(angleBetween(docked!, end)).toBeCloseTo(0, 9);
    }
  });

  it("a trip with no direction then leaves the remembered turn unchanged for the next landing", () => {
    const memory = new SkyMemory();
    memory.remember(tripSkyAt(null, IN, "A", 1), 10); // a real trip: we land in system 10
    const landed = memory.frameFor(10)!;
    const hop = tripSkyAt(landed, null, "A", 1); // a hop inside the system: no direction
    memory.remember(hop, 10);
    expect(angleBetween(memory.frameFor(10)!, IN)).toBeCloseTo(0, 9);
  });

  it("a sky is only kept for the place the trip ended in: another system, or nowhere, gets the default sky", () => {
    const memory = new SkyMemory();
    expect(memory.frameFor(10)).toBeNull(); // nothing remembered yet (first start, or after a page reload)
    memory.remember(IN, 10);
    expect(memory.frameFor(10)).toBe(IN);
    expect(memory.frameFor(11)).toBeNull();
    expect(memory.frameFor(null)).toBeNull();
    expect(memory.frameFor(undefined)).toBeNull();
    memory.remember(OUT, 11); // the next trip ended elsewhere
    expect(memory.frameFor(10)).toBeNull();
    expect(memory.frameFor(11)).toBe(OUT);
  });

  it("the centre stays where it was: what is ahead at the end of a trip inward is still the centre in the docked turn", () => {
    const centre = { x: -P.x, y: 0, z: -P.z };
    const l = Math.hypot(centre.x, centre.z);
    const towardsCentre = { x: centre.x / l, y: 0, z: centre.z / l };
    const end = tripSkyAt(null, tripFrame(towardsCentre), "A", 1)!;
    const memory = new SkyMemory();
    memory.remember(end, 5);
    const ahead = rotateBy(memory.frameFor(5)!, { x: 0, y: 0, z: -1 }); // looking along the ship's nose, in the docked view
    expect(ahead.x * towardsCentre.x + ahead.z * towardsCentre.z).toBeCloseTo(1, 9);
  });
});
