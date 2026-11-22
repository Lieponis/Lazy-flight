// Brief 3o, fix 3: the faint sky ahead of the ship is the sky that really lies ahead on the trip.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { makeMapSource } from "../src/mapsource";
import { START_POINT, WORLD_SEED, nearestSystems } from "../src/universe";
import { sampleRings } from "../src/render/galaxy/skysphere";
import { SkyBuilder } from "../src/render/galaxy/skyglow";
import { skyToTexels } from "../src/render/galaxy/skylook";
import { layerNearRadius } from "../src/render/galaxy/skylayermath";
import { UNIVERSE_BULGE_REACH_LY, universeField } from "../src/render/galaxy/universefield";
import { SkyView } from "../src/render/galaxy/skyview";
import {
  MIN_TRIP_LY,
  headingQuaternion,
  inwardScore,
  parseTripHeading,
  pickByHeading,
  rotateBy,
  tripDirection,
  type Vec3,
} from "../src/render/skyheading";

const AHEAD: Vec3 = { x: 0, y: 0, z: -1 }; // the ship's nose, in the flight scene
const P: Vec3 = { x: START_POINT.x, y: START_POINT.y, z: START_POINT.z }; // a system a third of the way out
const along = (from: Vec3, dir: Vec3, ly: number): Vec3 => ({ x: from.x + dir.x * ly, y: from.y + dir.y * ly, z: from.z + dir.z * ly });
const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / l, y: v.y / l, z: v.z / l };
};
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const TOWARDS_CENTRE = unit({ x: -P.x, y: -P.y, z: -P.z });
const TOWARDS_RIM = { x: -TOWARDS_CENTRE.x, y: -TOWARDS_CENTRE.y, z: -TOWARDS_CENTRE.z };

describe("3o fix 3: the direction of a trip", () => {
  it("is a unit direction from the system you left to the system you go to; the same two systems give the same answer", () => {
    const a = tripDirection({ x: 0, y: 0, z: 0 }, { x: 30, y: 40, z: 0 });
    expect(a).not.toBeNull();
    expect(a!.x).toBeCloseTo(0.6, 9);
    expect(a!.y).toBeCloseTo(0.8, 9);
    expect(tripDirection({ x: 0, y: 0, z: 0 }, { x: 30, y: 40, z: 0 })).toEqual(a);
  });

  it("a hop with no length (the same system, or a missing place) has no direction: the sky stays as it was", () => {
    expect(tripDirection(P, P)).toBeNull();
    expect(tripDirection(P, along(P, TOWARDS_CENTRE, MIN_TRIP_LY / 2))).toBeNull();
    expect(tripDirection(null, P)).toBeNull();
    expect(tripDirection(P, undefined)).toBeNull();
    expect(headingQuaternion(null)).toBeNull();
  });
});

describe("3o fix 3: what is ahead of the ship", () => {
  it("the ship's nose (-z) ends up pointing exactly along the trip, for many different trips", () => {
    for (let i = 0; i < 400; i++) {
      const a = (i * 2.399963) % (Math.PI * 2);
      const b = Math.asin(((i * 0.618034) % 2) - 1);
      const dir = { x: Math.cos(b) * Math.cos(a), y: Math.sin(b), z: Math.cos(b) * Math.sin(a) };
      const q = headingQuaternion(dir)!;
      expect(Math.hypot(q.x, q.y, q.z, q.w)).toBeCloseTo(1, 9);
      const ahead = rotateBy(q, AHEAD);
      expect(ahead.x).toBeCloseTo(dir.x, 9);
      expect(ahead.y).toBeCloseTo(dir.y, 9);
      expect(ahead.z).toBeCloseTo(dir.z, 9);
    }
  });

  it("a trip along the disc keeps the disc level: up stays up", () => {
    for (let a = 0; a < Math.PI * 2; a += 0.3) {
      const q = headingQuaternion({ x: Math.cos(a), y: 0, z: Math.sin(a) })!;
      const up = rotateBy(q, { x: 0, y: 1, z: 0 });
      expect(up.x).toBeCloseTo(0, 9);
      expect(up.y).toBeCloseTo(1, 9);
      expect(up.z).toBeCloseTo(0, 9);
    }
  });

  it("a trip towards the centre and a trip towards the rim have opposite skies ahead", () => {
    const inward = rotateBy(headingQuaternion(tripDirection(P, along(P, TOWARDS_CENTRE, 60)))!, AHEAD);
    const outward = rotateBy(headingQuaternion(tripDirection(P, along(P, TOWARDS_RIM, 60)))!, AHEAD);
    expect(dot(inward, TOWARDS_CENTRE)).toBeCloseTo(1, 9);
    expect(dot(outward, TOWARDS_RIM)).toBeCloseTo(1, 9);
    expect(dot(inward, outward)).toBeCloseTo(-1, 9);
    // and what is behind the ship is where you came from
    const behind = rotateBy(headingQuaternion(tripDirection(P, along(P, TOWARDS_CENTRE, 60)))!, { x: 0, y: 0, z: 1 });
    expect(dot(behind, TOWARDS_RIM)).toBeCloseTo(1, 9);
  });

  it("a short hop is steady: a small change of where you go gives a small change of the sky (also for a hop of a few light years)", () => {
    for (let i = 0; i < 60; i++) {
      const a = i * 0.7;
      const to = { x: P.x + Math.cos(a) * 4, y: Math.sin(a * 0.5) * 2, z: P.z + Math.sin(a) * 4 }; // about 4 ly away
      const nudged = { x: to.x + 0.02, y: to.y - 0.02, z: to.z + 0.01 };
      const a1 = rotateBy(headingQuaternion(tripDirection(P, to))!, AHEAD);
      const a2 = rotateBy(headingQuaternion(tripDirection(P, nudged))!, AHEAD);
      expect(Math.acos(Math.min(1, dot(a1, a2)))).toBeLessThan(0.02); // under about one degree
    }
  });
});

describe("3o fix 3: the test trips (?warppreview=1&heading=in or out)", () => {
  it("reads the word", () => {
    expect(parseTripHeading("?warppreview=1&heading=in")).toBe("in");
    expect(parseTripHeading("?heading=OUT")).toBe("out");
    expect(parseTripHeading("?heading=sideways")).toBeNull();
    expect(parseTripHeading("")).toBeNull();
  });

  it("picks real nearby systems: one that lies towards the centre and one towards the rim", () => {
    const list = nearestSystems(WORLD_SEED, START_POINT, 400)
      .map((n) => n.system)
      .filter((s) => s.position.x !== P.x || s.position.z !== P.z);
    const inward = pickByHeading(P, list, "in")!;
    const outward = pickByHeading(P, list, "out")!;
    expect(inwardScore(P, inward.position)).toBeGreaterThan(0.9);
    expect(inwardScore(P, outward.position)).toBeLessThan(-0.9);
    expect(pickByHeading(P, [], "in")).toBeNull();
  });
});

describe("3o fix 3: the real sky really differs ahead (the centre glows, the rim is dark)", () => {
  it("the glow towards the centre is brighter than the glow towards the rim, from a system a third of the way out", () => {
    const fns = makeMapSource(WORLD_SEED).sky!;
    const near = layerNearRadius(fns.spacing(Math.hypot(P.x, P.z)), 3);
    const builder = new SkyBuilder(universeField(fns), P, { faceSize: 24, steps: 24, nearRadius: near, bulgeReach: UNIVERSE_BULGE_REACH_LY });
    builder.run(1e9);
    expect(builder.done).toBe(true);
    const texels = skyToTexels(builder.raw); // 4 bytes per square: the last one is how bright the glow is there
    const look = (d: Vec3): number => sampleRings(builder.layout, texels, d.x, d.y, d.z, [])[3] ?? 0;
    expect(look(TOWARDS_CENTRE)).toBeGreaterThan(look(TOWARDS_RIM));
  });
});

describe("3o fix 3: the sky view and the flight screen", () => {
  it("a sky frame turns the sky camera by that frame; null puts it back as it was", () => {
    const view = new SkyView();
    const camera = new THREE.PerspectiveCamera(50, 1.5, 0.1, 100);
    camera.quaternion.setFromEuler(new THREE.Euler(0.3, 1.1, 0));
    const q = headingQuaternion(tripDirection(P, along(P, TOWARDS_CENTRE, 60)))!;
    const frame = new THREE.Quaternion(q.x, q.y, q.z, q.w);
    view.setSkyFrame(frame);
    view.follow(camera);
    const want = frame.clone().multiply(camera.quaternion);
    expect(view.camera.quaternion.angleTo(want)).toBeCloseTo(0, 6);
    // looking along the ship's nose, the sky camera looks along the trip
    camera.quaternion.identity();
    view.follow(camera);
    const look = new THREE.Vector3(0, 0, -1).applyQuaternion(view.camera.quaternion);
    expect(look.x).toBeCloseTo(TOWARDS_CENTRE.x, 6);
    expect(look.y).toBeCloseTo(TOWARDS_CENTRE.y, 6);
    expect(look.z).toBeCloseTo(TOWARDS_CENTRE.z, 6);
    view.setSkyFrame(null);
    view.follow(camera);
    expect(view.camera.quaternion.angleTo(camera.quaternion)).toBeCloseTo(0, 6);
  });

  it("the flight screen sets the frame when it opens, gives it back when it closes, and leaves floating alone", () => {
    const src = readFileSync("src/render/flight.ts", "utf8");
    expect(src).toContain("this.sky?.view.setSkyFrame(this.skyFrame);");
    expect(src).toContain("this.sky?.view.setSkyFrame(null);");
    expect(src).toContain("this.pointSkyFrame(parseDockId(info.originDockId)?.systemId ?? null, parseDockId(info.destinationDockId)?.systemId ?? null);");
    const floatAt = src.indexOf("beginFloat(planetId: string)");
    expect(src.slice(floatAt, floatAt + 700)).toContain("this.skyFrame = null;");
  });
});
