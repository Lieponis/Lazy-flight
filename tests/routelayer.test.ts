// NAV-2: the flight-plan line and the place markers inside the map's picture (real three.js, no screen needed: only the markers' places
// are checked, not pixels).

import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { RouteLayer } from "../src/render/routelayer";
import { routeLine, type MapPlace, type MapPlaceKind, type MapRoute, type SafeRect } from "../src/render/routemath";

const W = 180;
const H = 320;
const FREE: SafeRect = { left: 0, top: 0, right: 0, bottom: 0 };
const ORIGIN = { x: 0, y: 0, z: 0 };

/** A camera 200 ly from the ship looking at it (the small picture is 180 x 320, like a phone). */
function camera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(50, W / H, 0.2, 800);
  cam.position.set(0, 0, 200);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  return cam;
}

function plan(hops: [number, number, number][], target: [number, number, number], refuelAt: number[] = []): MapRoute {
  return {
    hops: hops.map((h, i) => ({ position: { x: h[0], y: h[1], z: h[2] }, refuel: refuelAt.includes(i) })),
    target: { position: { x: target[0], y: target[1], z: target[2] }, name: "HOME" },
  };
}

function place(x: number, kind: MapPlaceKind): MapPlace {
  return { systemId: 1, position: { x, y: 0, z: 0 }, kinds: [kind], name: "P" };
}

describe("the plan line and markers layer", () => {
  it("is hidden and draws nothing without a plan or places", () => {
    const layer = new RouteLayer("line");
    expect(layer.update(0.016, camera(), 200, W, H, FREE, 500)).toBeNull();
    expect(layer.group.visible).toBe(false);
    expect(layer.extentLy()).toBe(0);
  });

  it("puts a marker on every stop and one on the target, in the picture", () => {
    const layer = new RouteLayer("line");
    layer.setRoute(routeLine(ORIGIN, plan([[15, 0, 0], [30, 0, 0]], [45, 0, 0], [0]), 40));
    const tag = layer.update(0.016, camera(), 200, W, H, FREE, 500);
    expect(layer.group.visible).toBe(true);
    const c = layer.counts();
    expect(c.refuel).toBe(1); // the first stop is a refuel stop
    expect(c.hop).toBe(1);
    expect(c.target).toBe(1);
    expect(tag?.side).toBe("inside"); // the target is inside the drawn stars and the picture
    expect(tag!.x).toBeGreaterThan(90); // to the right of the middle, where +x is
    expect(layer.extentLy()).toBe(45);
  });

  it("pins a far target to the edge of the picture in its direction", () => {
    const layer = new RouteLayer("line");
    layer.setRoute(routeLine(ORIGIN, plan([[15, 0, 0]], [1240, 0, 0]), 40));
    const tag = layer.update(0.016, camera(), 200, W, H, FREE, 100); // the drawn stars end at 100 ly
    expect(tag?.side).toBe("right");
    expect(tag!.x).toBeGreaterThan(170);
    const up = new RouteLayer("line");
    up.setRoute(routeLine(ORIGIN, plan([], [0, 900, 0]), 40));
    const safe: SafeRect = { left: 8, top: 60, right: 8, bottom: 80 };
    const t2 = up.update(0.016, camera(), 200, W, H, safe, 100);
    expect(t2?.side).toBe("top");
    expect(t2!.y).toBeGreaterThanOrEqual(60); // not under the title
  });

  it("pins a target behind the camera to the bottom edge", () => {
    const layer = new RouteLayer("line");
    layer.setRoute(routeLine(ORIGIN, plan([], [0, 0, 600]), 40)); // the camera is at z = 200 looking towards -z: this is behind it
    const tag = layer.update(0.016, camera(), 200, W, H, FREE, 100);
    expect(tag?.side).toBe("bottom");
  });

  it("marks at most a few places, the important kinds first", () => {
    const layer = new RouteLayer("line");
    const kinds: MapPlaceKind[] = ["recent", "recent", "recent", "recent", "recent", "recent", "recent", "starred", "starred", "starred", "outpost", "start"];
    layer.setPlaces(kinds.map((k, i) => place(-40 + i * 6, k)), ORIGIN);
    layer.update(0.016, camera(), 200, W, H, FREE, 500);
    const c = layer.counts();
    expect(c.start).toBe(1);
    expect(c.outpost).toBe(1);
    expect(c.starred).toBe(3);
    expect(c.recent).toBe(3); // 8 in all
    expect(c.start + c.outpost + c.starred + c.recent).toBe(8);
  });

  it("pins far places on the edge, at most four, and leaves out a near place that is off the picture", () => {
    const layer = new RouteLayer("line");
    const places: MapPlace[] = [];
    for (let i = 0; i < 6; i++) places.push({ systemId: i, position: { x: 3000, y: i * 400 - 1000, z: 0 }, kinds: ["starred"], name: "F" });
    places.push(place(-4000, "start")); // also far
    places.push({ systemId: 99, position: { x: 0, y: 0, z: -90 }, kinds: ["outpost"], name: "N" }); // near, straight ahead of the ship, in the picture
    layer.setPlaces(places, ORIGIN);
    layer.update(0.016, camera(), 200, W, H, FREE, 150);
    const c = layer.counts();
    const edge = c.start + c.starred;
    expect(edge).toBeLessThanOrEqual(4);
    expect(c.start).toBe(1);
    expect(c.outpost).toBe(1);
  });

  it("takes the places relative to the ship's place", () => {
    const layer = new RouteLayer("line");
    layer.setPlaces([{ systemId: 1, position: { x: 1030, y: 5, z: 7 }, kinds: ["outpost"], name: "O" }], { x: 1000, y: 5, z: 7 });
    layer.update(0.016, camera(), 200, W, H, FREE, 500);
    expect(layer.counts().outpost).toBe(1); // 30 ly from the ship: inside the picture
  });

  it("builds dashes for the dashed look and moving dots for the dots look, nothing extra for the plain line", () => {
    const line = routeLine(ORIGIN, plan([[15, 0, 0], [30, 0, 0]], [45, 0, 0]), 40);
    const plain = new RouteLayer("line");
    plain.setRoute(line);
    plain.update(0.016, camera(), 200, W, H, FREE, 500);
    expect(plain.counts().dashes).toBe(0);
    expect(plain.counts().dots).toBe(0);
    const dashed = new RouteLayer("dashed");
    dashed.setRoute(line);
    dashed.update(0.016, camera(), 200, W, H, FREE, 500);
    expect(dashed.counts().dashes).toBeGreaterThan(3);
    expect(dashed.counts().dots).toBe(0);
    const dots = new RouteLayer("dots");
    dots.setRoute(line);
    dots.update(0.016, camera(), 200, W, H, FREE, 500);
    expect(dots.counts().dots).toBeGreaterThan(3);
    expect(dots.counts().dashes).toBe(0);
  });

  it("changes look without a new plan", () => {
    const layer = new RouteLayer("line");
    layer.setRoute(routeLine(ORIGIN, plan([[15, 0, 0], [30, 0, 0]], [45, 0, 0]), 40));
    layer.setLook("dashed");
    layer.update(0.016, camera(), 200, W, H, FREE, 500);
    expect(layer.counts().dashes).toBeGreaterThan(3);
  });

  it("never draws more dashes or dots than the limits, however long the line", () => {
    const hops: [number, number, number][] = Array.from({ length: 20 }, (_, i) => [(i + 1) * 90, 0, 0]);
    const line = routeLine(ORIGIN, plan(hops, [60000, 0, 0]), 40);
    const dashed = new RouteLayer("dashed");
    dashed.setRoute(line);
    dashed.update(0.016, camera(), 5, W, H, FREE, 500); // zoomed far in: the dashes would be tiny
    expect(dashed.counts().dashes).toBeLessThanOrEqual(1200);
    const dots = new RouteLayer("dots");
    dots.setRoute(line);
    dots.update(0.016, camera(), 5, W, H, FREE, 500);
    expect(dots.counts().dots).toBeLessThanOrEqual(400);
  });

  it("forgets the plan and its markers when it is cleared", () => {
    const layer = new RouteLayer("line");
    layer.setRoute(routeLine(ORIGIN, plan([[15, 0, 0]], [30, 0, 0]), 40));
    layer.update(0.016, camera(), 200, W, H, FREE, 500);
    expect(layer.counts().target).toBe(1);
    layer.setRoute(null);
    expect(layer.update(0.016, camera(), 200, W, H, FREE, 500)).toBeNull();
    expect(layer.counts().target).toBe(0);
    expect(layer.extentLy()).toBe(0);
  });

  it("is fully removable", () => {
    const parent = new THREE.Group();
    const layer = new RouteLayer("dashed");
    parent.add(layer.group);
    layer.dispose();
    expect(parent.children).toHaveLength(0);
  });
});
