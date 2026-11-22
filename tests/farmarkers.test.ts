// 3q: far place markers (home, outposts, starred, recent) sit at their TRUE place on the galaxy map, not pinned to the screen edge.
// Real three.js, no screen: the finer marker layer is replaced by a recorder, so the exact spots can be compared with the projection.
// Also: the plan's target under the two edge options (A: nothing at the edge, the default Andy chose; B: one edge marker), far markers dimmer, and
// far markers cannot be tapped.

import { readFileSync } from "node:fs";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { MarkSink } from "../src/render/routeglyphs";
import { RouteLayer } from "../src/render/routelayer";
import { markerBox, routeLine, type MapPlace, type MapPlaceKind, type MapRoute, type SafeRect } from "../src/render/routemath";
import { MAP_FAR_MARK_OPACITY, MAP_TARGET_MODE } from "../src/render/settings";

const W = 180;
const H = 320;
const FREE: SafeRect = { left: 0, top: 0, right: 0, bottom: 0 };
const ORIGIN = { x: 0, y: 0, z: 0 };
const BALL = 150; // the drawn stars end at 150 ly

/** A camera 200 ly from the ship looking at it. */
function camera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(50, W / H, 0.2, 800);
  cam.position.set(0, 0, 200);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  return cam;
}

interface Logged {
  name: string;
  x: number;
  y: number;
  dim: boolean | undefined;
}

function recorder() {
  const log = { marks: [] as Logged[] };
  const sink: MarkSink = {
    begin: () => {
      log.marks = [];
    },
    add: (name, x, y, dim) => log.marks.push({ name, x, y, dim }),
    end: () => {},
    clear: () => {},
  };
  return { sink, log };
}

function placeAt(x: number, y: number, z: number, kind: MapPlaceKind, id = 1): MapPlace {
  return { systemId: id, position: { x, y, z }, kinds: [kind], name: "P" };
}

/** Where a point of the real galaxy lands on the picture, from three's own projection (what a star at that place would get). */
function projected(cam: THREE.PerspectiveCamera, x: number, y: number, z: number): { x: number; y: number; inFront: boolean } {
  const v = new THREE.Vector3(x, y, z).project(cam);
  const clipW = new THREE.Vector4(x, y, z, 1).applyMatrix4(cam.matrixWorldInverse).z; // negative = in front of the camera
  return { x: (v.x * 0.5 + 0.5) * W, y: (0.5 - v.y * 0.5) * H, inFront: clipW < 0 };
}

describe("far places are drawn at their true place", () => {
  it("puts a far marker exactly where its real position projects (no clamp, no pinning)", () => {
    const { sink, log } = recorder();
    const layer = new RouteLayer("line");
    layer.setSink(sink);
    const cam = camera();
    // Far (beyond 150 ly), ahead of the camera, a little left, a little up, thousands of light years away.
    const spots: [number, number, number][] = [
      [-300, 120, -3000],
      [250, -200, -4000],
      [0, 0, -20000],
    ];
    layer.setPlaces(spots.map((p, i) => placeAt(p[0], p[1], p[2], "starred", i + 1)), ORIGIN);
    layer.update(0.016, cam, 200, W, H, FREE, BALL);
    expect(log.marks).toHaveLength(3);
    expect(layer.counts().far).toBe(3);
    for (const p of spots) {
      const want = projected(cam, p[0], p[1], p[2]);
      expect(want.inFront).toBe(true);
      const got = log.marks.find((m) => Math.abs(m.x - want.x) < 1e-3 && Math.abs(m.y - want.y) < 1e-3);
      expect(got, `a marker at ${want.x.toFixed(2)}, ${want.y.toFixed(2)}`).toBeDefined();
    }
    // None of them sits on the border: the old pinning put them on the edge of the picture.
    for (const m of log.marks) {
      expect(m.x).toBeGreaterThan(1);
      expect(m.x).toBeLessThan(W - 1);
      expect(m.y).toBeGreaterThan(1);
      expect(m.y).toBeLessThan(H - 1);
    }
  });

  it("leaves out a far place that is off the picture or behind the camera instead of pushing it to the edge", () => {
    const { sink, log } = recorder();
    const layer = new RouteLayer("line");
    layer.setSink(sink);
    layer.setPlaces(
      [
        placeAt(3000, 0, 0, "starred", 1), // far, far to the right of where the camera looks
        placeAt(0, 4000, 0, "outpost", 2), // far, above
        placeAt(0, 0, 4000, "start", 3), // far, behind the camera (it looks towards -z)
        placeAt(0, 0, -2000, "recent", 4), // far, straight ahead: the only one on the picture
      ],
      ORIGIN,
    );
    layer.update(0.016, camera(), 200, W, H, FREE, BALL);
    expect(log.marks.map((m) => m.name)).toEqual(["recent"]);
    expect(layer.counts().far).toBe(1);
    expect(log.marks[0]!.x).toBeCloseTo(W / 2, 3);
    expect(log.marks[0]!.y).toBeCloseTo(H / 2, 3);
  });

  it("moves with the sky while the map turns: it follows the projection and leaves the picture, it never slides along the border", () => {
    const { sink, log } = recorder();
    const layer = new RouteLayer("line");
    layer.setSink(sink);
    const far = placeAt(1200, 100, -2500, "starred");
    layer.setPlaces([far], ORIGIN);
    let shown = 0;
    let hidden = 0;
    let last: number | null = null;
    // Turn the camera round the ship in one-degree steps (the ship stays in the middle, 200 ly in front of the camera).
    for (let deg = -60; deg <= 60; deg++) {
      const yaw = (deg * Math.PI) / 180;
      const cam = new THREE.PerspectiveCamera(50, W / H, 0.2, 800);
      cam.position.set(Math.sin(yaw) * 200, 0, Math.cos(yaw) * 200);
      cam.lookAt(0, 0, 0);
      cam.updateMatrixWorld();
      layer.update(0.016, cam, 200, W, H, FREE, BALL);
      const want = projected(cam, far.position.x, far.position.y, far.position.z);
      const inside = want.inFront && want.x >= 0 && want.x <= W && want.y >= 0 && want.y <= H;
      if (inside) {
        shown++;
        expect(log.marks).toHaveLength(1);
        expect(log.marks[0]!.x).toBeCloseTo(Math.min(W - 0.5, Math.max(0.5, want.x)), 3);
        expect(log.marks[0]!.y).toBeCloseTo(Math.min(H - 0.5, Math.max(0.5, want.y)), 3);
        if (last !== null) expect(Math.abs(log.marks[0]!.x - last)).toBeLessThan(12); // glides in small steps, never jumps to a border
        last = log.marks[0]!.x;
      } else {
        hidden++;
        expect(log.marks).toHaveLength(0); // not drawn, and not pinned anywhere
        last = null;
      }
    }
    expect(shown).toBeGreaterThan(3);
    expect(hidden).toBeGreaterThan(20);
  });

  it("draws far markers dim and near markers at full strength, same pictures", () => {
    const { sink, log } = recorder();
    const layer = new RouteLayer("line");
    layer.setSink(sink);
    layer.setPlaces([placeAt(0, 0, -2000, "starred", 1), placeAt(20, 0, -60, "starred", 2)], ORIGIN); // one far, one near, both ahead (side by side)
    layer.update(0.016, camera(), 200, W, H, FREE, BALL);
    expect(log.marks).toHaveLength(2);
    expect(log.marks.every((m) => m.name === "starred")).toBe(true); // the same glyph for both
    expect(log.marks.filter((m) => m.dim === true)).toHaveLength(1);
    expect(log.marks.filter((m) => m.dim !== true)).toHaveLength(1);
    expect(MAP_FAR_MARK_OPACITY).toBeGreaterThan(0.2);
    expect(MAP_FAR_MARK_OPACITY).toBeLessThan(1);
  });

  it("gives a far marker the same box size wherever it is: the size comes from the glyph, never from the distance", () => {
    const view = { left: 0, top: 100, width: 420, height: 756, picW: 180, picH: 324, dpr: 3 };
    const box = { left: 0, top: 0, size: 0, texelDevice: 1 };
    const sizes = new Set<number>();
    for (const [x, y] of [[90, 160], [5, 5], [175, 300], [40.37, 211.9]] as const) sizes.add(markerBox(view, x, y, 9, box).size);
    expect(sizes.size).toBe(1);
  });

  it("keeps near places as they were: at the place of their star, left out when off the picture, at full strength", () => {
    const { sink, log } = recorder();
    const layer = new RouteLayer("line");
    layer.setSink(sink);
    const cam = camera();
    layer.setPlaces([placeAt(20, 10, 0, "outpost", 1), placeAt(500, 0, 0, "recent", 2)], ORIGIN); // 22 ly (in the picture) and 500 ly (off to the side)
    layer.update(0.016, cam, 200, W, H, FREE, 800);
    expect(log.marks).toHaveLength(1); // the second is near (inside 800 ly) but off the picture: left out
    expect(log.marks[0]!.name).toBe("outpost");
    expect(log.marks[0]!.dim).toBe(false);
    expect(layer.counts().far).toBe(0);
  });
});

describe("the plan's target under the two edge options", () => {
  const farTarget = (x: number, y: number, z: number): MapRoute => ({ hops: [], target: { position: { x, y, z }, name: "HOME" } });

  it("the default is A (Andy: the target also sits at its real place, nothing slides along the edge)", () => {
    expect(MAP_TARGET_MODE).toBe("A");
    const layer = new RouteLayer("line"); // no option given: the default
    layer.setRoute(routeLine(ORIGIN, farTarget(1240, 0, 0), 40));
    expect(layer.update(0.016, camera(), 200, W, H, FREE, BALL)).toBeNull();
  });

  it("B: a far target to the side still gets its edge marker with the words beside it", () => {
    const { sink, log } = recorder();
    const layer = new RouteLayer("line", "B");
    layer.setSink(sink);
    layer.setRoute(routeLine(ORIGIN, farTarget(1240, 0, 0), 40));
    const tag = layer.update(0.016, camera(), 200, W, H, FREE, BALL);
    expect(tag?.side).toBe("right");
    expect(layer.counts().target).toBe(1);
    expect(log.marks.map((m) => m.name)).toEqual(["target"]);
    expect(log.marks[0]!.dim).toBe(false); // the target is never dimmed
  });

  it("A: the same far target gets nothing at the edge", () => {
    const { sink, log } = recorder();
    const layer = new RouteLayer("line", "A");
    layer.setSink(sink);
    layer.setRoute(routeLine(ORIGIN, farTarget(1240, 0, 0), 40));
    const tag = layer.update(0.016, camera(), 200, W, H, FREE, BALL);
    expect(tag).toBeNull();
    expect(layer.counts().target).toBe(0);
    expect(log.marks).toHaveLength(0);
  });

  it("A: a far target that really is on the picture is drawn at its true place, with its words beside it", () => {
    const { sink, log } = recorder();
    const layer = new RouteLayer("line", "A");
    layer.setSink(sink);
    const cam = camera();
    layer.setRoute(routeLine(ORIGIN, farTarget(-250, 100, -3000), 40));
    const tag = layer.update(0.016, cam, 200, W, H, FREE, BALL);
    const want = projected(cam, -250, 100, -3000);
    expect(tag?.side).toBe("inside");
    expect(tag!.x).toBeCloseTo(want.x, 3);
    expect(tag!.y).toBeCloseTo(want.y, 3);
    expect(log.marks[0]!.name).toBe("target");
  });

  it("A: a target behind the camera gets nothing either (B puts it at the bottom edge)", () => {
    const a = new RouteLayer("line", "A");
    a.setRoute(routeLine(ORIGIN, farTarget(0, 0, 600), 40));
    expect(a.update(0.016, camera(), 200, W, H, FREE, BALL)).toBeNull();
    const b = new RouteLayer("line", "B");
    b.setRoute(routeLine(ORIGIN, farTarget(0, 0, 600), 40));
    expect(b.update(0.016, camera(), 200, W, H, FREE, BALL)?.side).toBe("bottom");
  });

  it("the hops and the line are the same under both options", () => {
    for (const mode of ["A", "B"] as const) {
      const layer = new RouteLayer("dashed", mode);
      const plan: MapRoute = {
        hops: [
          { position: { x: 15, y: 0, z: 0 }, refuel: true },
          { position: { x: 30, y: 0, z: 0 }, refuel: false },
        ],
        target: { position: { x: 45, y: 0, z: 0 }, name: "HOME" },
      };
      layer.setRoute(routeLine(ORIGIN, plan, 40));
      layer.update(0.016, camera(), 200, W, H, FREE, 500);
      expect(layer.counts()).toMatchObject({ hop: 1, refuel: 1, target: 1 });
      expect(layer.counts().dashes).toBeGreaterThan(3);
    }
  });
});

describe("far markers cannot be tapped", () => {
  const read = (p: string): string => readFileSync(new URL(`../src/render/${p}`, import.meta.url), "utf8");

  it("the marker layers know nothing about taps, stars or selection: a far place has no star under it", () => {
    for (const file of ["routelayer.ts", "markeroverlay.ts"]) {
      const code = read(file).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(code, file).not.toMatch(/handleTap|tapRay|tapVis|grid|selected|onOpenSystem|addEventListener|onclick|onpointer/i);
    }
  });

  it("the little pictures let every touch through to the map", () => {
    const css = read("route.css");
    for (const rule of [".route-marks {", ".route-mark {"]) {
      const start = css.indexOf(rule);
      expect(start, rule).toBeGreaterThanOrEqual(0);
      const body = css.slice(start, css.indexOf("}", start));
      expect(body, rule).toMatch(/pointer-events:\s*none/);
    }
  });

  it("the tap picks only from the tappable stars (the grid), which a far place is never part of", () => {
    const code = read("starmap.ts");
    const tap = code.slice(code.indexOf("private handleTap"));
    expect(tap).toMatch(/grid/);
    expect(tap.slice(0, 1800)).not.toMatch(/nav\.places|this\.route|MapPlace/);
  });
});
