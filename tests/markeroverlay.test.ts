// NAV-2 (after Andy's "all icons shake when rotating the view"): the markers are laid over the map as a finer layer that glides.
// Pure parts only (where a marker's box goes, the address word) and the route layer handing its markers over.

import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { MarkSink } from "../src/render/routeglyphs";
import { RouteLayer } from "../src/render/routelayer";
import { markerBox, parseMapIcons, routeLine, type MapRoute, type MarkerBox, type MarkerView, type SafeRect } from "../src/render/routemath";

const PHONE: MarkerView = { left: 0, top: 100, width: 420, height: 756, picW: 180, picH: 324, dpr: 3 };
const FREE: SafeRect = { left: 0, top: 0, right: 0, bottom: 0 };
const out = (): MarkerBox => ({ left: 0, top: 0, size: 0, texelDevice: 1 });

describe("markerBox", () => {
  it("makes every texel a whole number of device pixels, about the size of a pixel of the small picture", () => {
    const b = markerBox(PHONE, 90, 160, 9, out());
    expect(b.texelDevice).toBe(7); // 420 css px over 180 pixels = 2.33 css px = 7 device px at 3x
    expect(b.size).toBeCloseTo((9 * 7) / 3, 9);
    expect((b.size * 3) % 1).toBeCloseTo(0, 6);
  });

  it("puts the middle of the box on the spot, to within one device pixel", () => {
    for (const [x, y] of [[90, 160], [12.3, 40.7], [170.9, 300.2]] as const) {
      const b = markerBox(PHONE, x, y, 11, out());
      const cx = b.left + b.size / 2;
      const cy = b.top + b.size / 2;
      expect(Math.abs(cx - x * (420 / 180))).toBeLessThanOrEqual(1 / 3 / 2 + 1e-9);
      expect(Math.abs(cy - (100 + y * (756 / 324)))).toBeLessThanOrEqual(1 / 3 / 2 + 1e-9);
    }
  });

  it("sits on a whole device pixel", () => {
    const b = markerBox(PHONE, 33.37, 71.91, 7, out());
    expect((b.left * 3) % 1).toBeCloseTo(0, 6);
    expect(((b.top * 3) % 1) + 1e-9).toBeLessThan(1e-6 + 1);
    expect(Math.abs(b.top * 3 - Math.round(b.top * 3))).toBeLessThan(1e-6);
  });

  it("glides: a turn of a tenth of a pixel of the small picture moves it by well under one of its pixels", () => {
    let biggest = 0;
    let last = markerBox(PHONE, 50, 80, 9, out()).left;
    for (let i = 1; i <= 100; i++) {
      const now = markerBox(PHONE, 50 + i * 0.1, 80, 9, out()).left;
      biggest = Math.max(biggest, Math.abs(now - last));
      last = now;
    }
    expect(biggest).toBeLessThanOrEqual(1 / 3 + 1e-9); // one device pixel at most per tenth of a pixel; a snapped marker would jump 2.33
    expect(last).toBeGreaterThan(markerBox(PHONE, 50, 80, 9, out()).left + 20);
  });

  it("works on a desktop screen (ratio 1) and on a tiny ratio", () => {
    const d = markerBox({ left: 10, top: 0, width: 1280, height: 720, picW: 320, picH: 180, dpr: 1 }, 160, 90, 9, out());
    expect(d.texelDevice).toBe(4);
    expect(d.size).toBe(36);
    expect(d.left).toBe(10 + 640 - 18);
    const t = markerBox({ ...PHONE, dpr: 0 }, 90, 160, 9, out());
    expect(t.texelDevice).toBeGreaterThan(0);
  });
});

describe("parseMapIcons", () => {
  it("reads fine and chunky", () => {
    expect(parseMapIcons("?mapicons=fine")).toBe("fine");
    expect(parseMapIcons("?x=1&mapicons=CHUNKY")).toBe("chunky");
    expect(parseMapIcons("?mapicons=old")).toBe("chunky");
    expect(parseMapIcons("")).toBeNull();
    expect(parseMapIcons("?mapicons=purple")).toBeNull();
  });
});

/** A sink that remembers what it was given. */
function recorder() {
  const log = { begins: 0, ends: 0, clears: 0, marks: [] as Array<{ name: string; x: number; y: number }> };
  const sink: MarkSink = {
    begin: () => {
      log.begins++;
      log.marks = [];
    },
    add: (name, x, y) => log.marks.push({ name, x, y }),
    end: () => log.ends++,
    clear: () => log.clears++,
  };
  return { sink, log };
}

function camera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(50, 180 / 320, 0.2, 800);
  cam.position.set(0, 0, 200);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  return cam;
}

const PLAN: MapRoute = {
  hops: [
    { position: { x: 15.3, y: 4.1, z: 0 }, refuel: true },
    { position: { x: 31.7, y: -3.3, z: 0 }, refuel: false },
  ],
  target: { position: { x: 47.9, y: 2.2, z: 0 }, name: "HOME" },
};

describe("the route layer with a finer marker layer", () => {
  it("hands every marker over at its exact place (not snapped to a pixel) and draws none inside the picture", () => {
    const { sink, log } = recorder();
    const layer = new RouteLayer("dashed");
    layer.setSink(sink);
    layer.setRoute(routeLine({ x: 0, y: 0, z: 0 }, PLAN, 40));
    const tag = layer.update(0.016, camera(), 200, 180, 320, FREE, 500);
    expect(log.begins).toBe(1);
    expect(log.ends).toBe(1);
    expect(log.marks.map((m) => m.name).sort()).toEqual(["hop", "refuel", "target"]);
    expect(log.marks.some((m) => m.x % 1 !== 0.5 || m.y % 1 !== 0.5)).toBe(true); // not all on pixel middles
    expect(layer.counts()).toMatchObject({ hop: 1, refuel: 1, target: 1 });
    const target = log.marks.find((m) => m.name === "target")!;
    expect(tag!.x).toBe(target.x); // the words follow the exact spot too
    expect(tag!.y).toBe(target.y);
  });

  it("without a finer layer the markers are snapped to pixel middles, as before", () => {
    const layer = new RouteLayer("dashed");
    layer.setRoute(routeLine({ x: 0, y: 0, z: 0 }, PLAN, 40));
    const tag = layer.update(0.016, camera(), 200, 180, 320, FREE, 500);
    expect(tag!.x % 1).toBeCloseTo(0.5, 9);
    expect(tag!.y % 1).toBeCloseTo(0.5, 9);
  });

  it("moves the markers a little when the camera turns a little (a snapped marker would not move at all)", () => {
    const { sink, log } = recorder();
    const layer = new RouteLayer("dashed");
    layer.setSink(sink);
    layer.setRoute(routeLine({ x: 0, y: 0, z: 0 }, PLAN, 40));
    const cam = camera();
    layer.update(0.016, cam, 200, 180, 320, FREE, 500);
    const before = log.marks.find((m) => m.name === "target")!.x;
    cam.position.x += 0.05;
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    layer.update(0.016, cam, 200, 180, 320, FREE, 500);
    const after = log.marks.find((m) => m.name === "target")!.x;
    expect(after).not.toBe(before);
    expect(Math.abs(after - before)).toBeLessThan(1);
  });

  it("tells the finer layer to clear when there is nothing left to show", () => {
    const { sink, log } = recorder();
    const layer = new RouteLayer("dashed");
    layer.setSink(sink);
    layer.setRoute(routeLine({ x: 0, y: 0, z: 0 }, PLAN, 40));
    layer.update(0.016, camera(), 200, 180, 320, FREE, 500);
    const clears = log.clears;
    layer.setRoute(null);
    expect(log.clears).toBeGreaterThan(clears);
    expect(layer.update(0.016, camera(), 200, 180, 320, FREE, 500)).toBeNull();
  });

  it("can go back to drawing inside the picture", () => {
    const { sink } = recorder();
    const layer = new RouteLayer("dashed");
    layer.setSink(sink);
    layer.setSink(null);
    layer.setRoute(routeLine({ x: 0, y: 0, z: 0 }, PLAN, 40));
    layer.update(0.016, camera(), 200, 180, 320, FREE, 500);
    expect(layer.counts().target).toBe(1);
  });
});
