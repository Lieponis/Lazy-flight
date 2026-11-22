// NAV-2: the flight-plan line and the place markers on the galaxy map. The pure parts: hop list to line points, markers pinned to the
// edge of the picture, dashes and moving dots, the camera framing, the plan-to-map converters, the little marker pictures.

import { describe, expect, it } from "vitest";
import {
  dashSegments,
  demoPlan,
  dotPositions,
  fitPeriod,
  formatLy,
  frameBounds,
  NavInput,
  ndcOfClip,
  parseMapLine,
  parseMapPlan,
  parseMapTarget,
  pickPlaces,
  pinToSafeRect,
  placeGlyphKind,
  placesFromRows,
  quantizePeriod,
  routeFromPlan,
  routeLine,
  tagPosition,
  targetTagText,
  tooClose,
  trueSpot,
  type MapRoute,
  type SafeRect,
} from "../src/render/routemath";
import { GLYPHS, glyphTexels, type GlyphName } from "../src/render/routeglyphs";

const NO_INSET: SafeRect = { left: 0, top: 0, right: 0, bottom: 0 };

function route(hops: [number, number, number][], target: [number, number, number]): MapRoute {
  return {
    hops: hops.map((h, i) => ({ position: { x: h[0], y: h[1], z: h[2] }, refuel: i === 1 })),
    target: { position: { x: target[0], y: target[1], z: target[2] }, name: "HOME" },
  };
}

describe("hop list to line points", () => {
  it("makes the line relative to the ship, ship first", () => {
    const line = routeLine({ x: 100, y: 10, z: -5 }, route([[130, 10, -5], [160, 10, 25]], [160, 10, 25]), 40);
    expect(line.count).toBe(3);
    expect(Array.from(line.points)).toEqual([0, 0, 0, 30, 0, 0, 60, 0, 30]);
    expect(line.refuel).toEqual([false, true]);
    expect(line.hasRest).toBe(false); // the last hop IS the target
    expect(line.targetLy).toBeCloseTo(Math.hypot(60, 30), 3);
    expect(line.extentLy).toBeCloseTo(Math.hypot(60, 30), 3);
  });

  it("adds the rest of the way when the target is beyond the last hop", () => {
    const line = routeLine({ x: 0, y: 0, z: 0 }, route([[30, 0, 0], [60, 0, 0]], [1240, 0, 0]), 40);
    expect(line.hasRest).toBe(true);
    expect(line.targetLy).toBe(1240);
    expect(line.extentLy).toBe(1240);
  });

  it("copes with a plan without hops (the ship cannot go): only the way to the target", () => {
    const line = routeLine({ x: 0, y: 0, z: 0 }, route([], [0, 0, 500]), 40);
    expect(line.count).toBe(1);
    expect(line.hasRest).toBe(true);
    expect(line.extentLy).toBe(500);
  });

  it("uses only the first maxHops hops", () => {
    const hops: [number, number, number][] = Array.from({ length: 30 }, (_, i) => [(i + 1) * 10, 0, 0]);
    expect(routeLine({ x: 0, y: 0, z: 0 }, route(hops, [300, 0, 0]), 20).count).toBe(21);
  });
});

describe("words next to the target", () => {
  it("writes light years with thousands commas, one decimal when short", () => {
    expect(formatLy(1240)).toBe("1,240");
    expect(formatLy(12.4)).toBe("12");
    expect(formatLy(4.04)).toBe("4.0");
    expect(formatLy(-3)).toBe("0");
    expect(formatLy(Number.NaN)).toBe("0");
    expect(targetTagText("HOME", 1240)).toBe("HOME, 1,240 ly");
  });
});

describe("markers on the edge of the picture", () => {
  it("projects a point in front of the camera as usual and points the way for one behind", () => {
    expect(ndcOfClip(1, -2, 4)).toEqual({ x: 0.25, y: -0.5, behind: false });
    const behind = ndcOfClip(2, 0, -3);
    expect(behind.behind).toBe(true);
    expect(behind.x).toBe(10); // turn right
    expect(behind.y).toBe(0);
    expect(ndcOfClip(0, 0, -1)).toEqual({ x: 0, y: -10, behind: true }); // dead behind: at the bottom
  });

  it("leaves a point inside the free area where it is", () => {
    const p = pinToSafeRect(0, 0, false, 200, 100, NO_INSET, false);
    expect(p).toEqual({ x: 100, y: 50, pinned: false, side: "inside" });
  });

  it("pushes a point outside to the edge, along the line from the middle", () => {
    const p = pinToSafeRect(3, 0, false, 200, 100, NO_INSET, false);
    expect(p.pinned).toBe(true);
    expect(p.side).toBe("right");
    expect(p.x).toBe(200);
    expect(p.y).toBe(50);
    const q = pinToSafeRect(0.5, 4, false, 200, 100, NO_INSET, false);
    expect(q.side).toBe("top");
    expect(q.y).toBe(0);
    expect(q.x).toBeGreaterThan(100); // up and a little to the right
  });

  it("keeps clear of the title and the bottom bar", () => {
    const safe: SafeRect = { left: 8, top: 20, right: 8, bottom: 30 };
    const up = pinToSafeRect(0, 5, false, 200, 100, safe, false);
    expect(up.y).toBe(20);
    const down = pinToSafeRect(0, -5, false, 200, 100, safe, false);
    expect(down.y).toBe(70);
    const left = pinToSafeRect(-9, 0, false, 200, 100, safe, false);
    expect(left.x).toBe(8);
  });

  it("always pins a far marker and one behind the camera, even when it would be inside", () => {
    expect(pinToSafeRect(0.2, 0.1, false, 200, 100, NO_INSET, true).pinned).toBe(true);
    const behind = pinToSafeRect(-10, 0, true, 200, 100, NO_INSET, false);
    expect(behind.pinned).toBe(true);
    expect(behind.side).toBe("left");
  });

  it("puts a marker straight ahead (dead in the middle) at the top, and survives a too small free area", () => {
    const top = pinToSafeRect(0, 0, false, 200, 100, NO_INSET, true);
    expect(top.side).toBe("top");
    expect(top.y).toBe(0);
    const tiny = pinToSafeRect(5, 0, false, 200, 100, { left: 100, top: 0, right: 100, bottom: 0 }, false);
    expect(tiny.x).toBe(200); // the free area was ignored
  });

  it("never lands outside the free area", () => {
    const safe: SafeRect = { left: 10, top: 25, right: 10, bottom: 35 };
    for (let a = 0; a < 360; a += 15) {
      const nx = Math.cos((a * Math.PI) / 180) * 7;
      const ny = Math.sin((a * Math.PI) / 180) * 7;
      const p = pinToSafeRect(nx, ny, false, 180, 320, safe, false);
      expect(p.x).toBeGreaterThanOrEqual(10 - 1e-6);
      expect(p.x).toBeLessThanOrEqual(170 + 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(25 - 1e-6);
      expect(p.y).toBeLessThanOrEqual(285 + 1e-6);
    }
  });

  it("tooClose finds a neighbour inside the separation", () => {
    const xs = [10, 50];
    const ys = [10, 50];
    expect(tooClose(xs, ys, 2, 12, 11, 5)).toBe(true);
    expect(tooClose(xs, ys, 2, 20, 10, 5)).toBe(false);
    expect(tooClose(xs, ys, 0, 10, 10, 5)).toBe(false);
  });
});

describe("which places get a marker", () => {
  const items = [
    { kind: "recent" as const, distanceLy: 5 },
    { kind: "starred" as const, distanceLy: 900 },
    { kind: "outpost" as const, distanceLy: 20 },
    { kind: "start" as const, distanceLy: 3000 },
    { kind: "starred" as const, distanceLy: 40 },
  ];

  it("takes start, outpost, starred, recent in that order, nearer first inside one kind", () => {
    expect(pickPlaces(items, 100000, 10, 10)).toEqual([3, 2, 4, 1, 0]);
  });

  it("limits the far ones (beyond the drawn stars) and the total", () => {
    expect(pickPlaces(items, 100, 10, 1)).toEqual([3, 2, 4, 0]); // only the start is far-allowed; the far starred star is left out
    expect(pickPlaces(items, 100, 2, 4)).toEqual([3, 2]);
  });

  it("draws a place as the first of its kinds", () => {
    expect(placeGlyphKind(["recent", "outpost"])).toBe("outpost");
    expect(placeGlyphKind(["starred", "start"])).toBe("start");
    expect(placeGlyphKind(["nonsense"])).toBeNull();
  });
});

describe("dashes and moving dots", () => {
  it("dashes a straight line half and half", () => {
    const out = new Float32Array(6 * 50);
    const n = dashSegments([0, 0, 0, 10, 0, 0], 2, 2, 0.5, out);
    expect(n).toBe(5);
    expect(Array.from(out.subarray(0, 6))).toEqual([0, 0, 0, 1, 0, 0]);
    expect(Array.from(out.subarray(6, 12))).toEqual([2, 0, 0, 3, 0, 0]);
    expect(out[(n - 1) * 6 + 3]).toBe(9);
  });

  it("keeps the pattern running round a corner", () => {
    // Two legs of 1.5 each, period 2, dash 1: dash 0..1, gap 1..2, dash 2..3 (the second dash starts 0.5 into the second leg).
    const out = new Float32Array(6 * 20);
    const pts = [0, 0, 0, 1.5, 0, 0, 1.5, 1.5, 0];
    const n = dashSegments(pts, 3, 2, 0.5, out);
    let total = 0;
    for (let i = 0; i < n; i++) total += Math.hypot(out[i * 6 + 3]! - out[i * 6]!, out[i * 6 + 4]! - out[i * 6 + 1]!, out[i * 6 + 5]! - out[i * 6 + 2]!);
    expect(total).toBeCloseTo(2, 4); // 3 long in all: the dashes 0..1 and 2..3
  });

  it("stops when the buffer is full and never loops on a silly period", () => {
    const small = new Float32Array(6 * 3);
    expect(dashSegments([0, 0, 0, 1000, 0, 0], 2, 2, 0.5, small)).toBe(3);
    expect(dashSegments([0, 0, 0, 1000, 0, 0], 2, 0, 0.5, new Float32Array(60))).toBe(0);
    expect(dashSegments([0, 0, 0], 1, 2, 0.5, new Float32Array(60))).toBe(0);
  });

  it("raises the period so a long line has at most the allowed dashes", () => {
    expect(fitPeriod(1000, 1, 1200)).toBe(1); // fits already
    expect(fitPeriod(100000, 1, 1200)).toBeGreaterThan(90);
    const q = quantizePeriod(0.8);
    expect(q).toBeGreaterThan(0.6);
    expect(q).toBeLessThan(1.0);
    expect(quantizePeriod(q * 1.02)).toBe(q); // a small zoom does not change the step
  });

  it("puts one dot every period, starting at the offset", () => {
    const out = new Float32Array(3 * 20);
    const n = dotPositions([0, 0, 0, 10, 0, 0], 2, 2, 0.5, out);
    expect(n).toBe(5);
    expect(out[0]).toBeCloseTo(0.5, 5);
    expect(out[3]).toBeCloseTo(2.5, 5);
    expect(out[12]).toBeCloseTo(8.5, 5);
  });

  it("moves the dots along as the offset grows, and wraps it", () => {
    const a = new Float32Array(3 * 20);
    const b = new Float32Array(3 * 20);
    dotPositions([0, 0, 0, 10, 0, 0], 2, 2, 0.5, a);
    dotPositions([0, 0, 0, 10, 0, 0], 2, 2, 0.9, b);
    expect(b[0]).toBeCloseTo(0.9, 5);
    dotPositions([0, 0, 0, 10, 0, 0], 2, 2, 2.5, b); // one whole period more: the same as 0.5
    expect(b[0]).toBeCloseTo(0.5, 5);
    dotPositions([0, 0, 0, 10, 0, 0], 2, 2, -1.5, b); // negative offsets wrap too
    expect(b[0]).toBeCloseTo(0.5, 5);
  });

  it("follows corners and stops at a full buffer", () => {
    const out = new Float32Array(3 * 3);
    const n = dotPositions([0, 0, 0, 1, 0, 0, 1, 5, 0], 3, 2, 0, out);
    expect(n).toBe(3);
    expect(out[0]).toBe(0); // at the ship
    expect(out[3]).toBeCloseTo(1, 5); // 1 ly along the second leg
    expect(out[4]).toBeCloseTo(1, 5);
  });
});

describe("camera help: framing the first hops", () => {
  const pts = [0, 0, 0, 20, 0, 0];

  it("looks at the middle of the points from far enough to see them whole", () => {
    const f = frameBounds(pts, 2, 50, 1, 1.3);
    expect(f.centre).toEqual({ x: 10, y: 0, z: 0 });
    expect(f.dist).toBeCloseTo((10 * 1.3) / Math.sin((25 * Math.PI) / 180), 3);
  });

  it("goes farther back on a tall (narrow) picture", () => {
    const wide = frameBounds(pts, 2, 50, 1.78, 1.3).dist;
    const tall = frameBounds(pts, 2, 50, 0.5, 1.3).dist;
    expect(tall).toBeGreaterThan(wide);
  });

  it("uses only the first count points, and never less than 1 ly", () => {
    const many = [0, 0, 0, 20, 0, 0, 500, 0, 0];
    expect(frameBounds(many, 2, 50, 1, 1).centre.x).toBe(10);
    expect(frameBounds([0, 0, 0], 1, 50, 1, 1).dist).toBe(1);
  });
});

describe("testing words in the address", () => {
  it("?mapline=a|b|c", () => {
    expect(parseMapLine("?mapline=a")).toBe("line");
    expect(parseMapLine("?mapline=B")).toBe("dashed");
    expect(parseMapLine("?mapline=dots")).toBe("dots");
    expect(parseMapLine("?mapline=zzz")).toBeNull();
    expect(parseMapLine("")).toBeNull();
  });

  it("?mapplan=N", () => {
    expect(parseMapPlan("?mapplan=20")).toBe(20);
    expect(parseMapPlan("?mapplan=500")).toBe(40);
    expect(parseMapPlan("?mapplan=0")).toBeNull();
    expect(parseMapPlan("?mapplan=x")).toBeNull();
    expect(parseMapPlan("")).toBeNull();
  });
});

describe("the made-up plan of the testing aid", () => {
  // A square grid of "stars" 5 ly apart around the ship.
  const pos: number[] = [];
  const ids: number[] = [];
  for (let x = -100; x <= 100; x += 5) {
    for (let z = -100; z <= 100; z += 5) {
      pos.push(x, 0, z);
      ids.push(1000 + ids.length);
    }
  }
  const near = { count: ids.length, positions: pos, ids };

  it("hops through real stars towards one direction, then straight on when the stars run out", () => {
    const demo = demoPlan({ x: 1000, y: 0, z: 0 }, near, 30, 20);
    expect(demo.route.hops).toHaveLength(20);
    let prev = { x: 1000, y: 0, z: 0 };
    for (const h of demo.route.hops) {
      expect(Math.hypot(h.position.x - prev.x, h.position.y - prev.y, h.position.z - prev.z)).toBeLessThanOrEqual(30 + 1e-6);
      prev = h.position;
    }
    const last = demo.route.hops[19]!.position;
    expect(Math.hypot(last.x - 1000, last.z) > 200).toBe(true); // left the drawn stars
    expect(demo.route.hops.map((h) => h.refuel).filter(Boolean)).toHaveLength(4); // every fifth stop
  });

  it("puts the target 1,240 ly away and some places on real stars plus two far ones", () => {
    const demo = demoPlan({ x: 1000, y: 0, z: 0 }, near, 30, 5);
    const t = demo.route.target.position;
    expect(Math.hypot(t.x - 1000, t.y, t.z)).toBeCloseTo(1240, 3);
    expect(demo.places).toHaveLength(7);
    expect(demo.places.filter((p) => p.systemId >= 1000)).toHaveLength(5);
    expect(demo.places.map((p) => p.kinds[0])).toEqual(["start", "outpost", "starred", "recent", "recent", "starred", "outpost"]);
  });

  it("is the same every time", () => {
    const a = demoPlan({ x: 0, y: 0, z: 0 }, near, 30, 12);
    const b = demoPlan({ x: 0, y: 0, z: 0 }, near, 30, 12);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("the game's answers turned into what the map draws", () => {
  const known: Record<number, { x: number; y: number; z: number }> = { 1: { x: 10, y: 0, z: 0 }, 2: { x: 40, y: 0, z: 0 }, 3: { x: 70, y: 0, z: 0 }, 9: { x: 500, y: 0, z: 0 } };
  const positionOf = (id: number) => known[id] ?? null;

  it("marks the refuel on the stop BEFORE the hop that needs it", () => {
    const r = routeFromPlan(positionOf, {
      status: "ok",
      target: { name: "HOME", systemId: 9 },
      hops: [
        { systemId: 1, refuelBefore: false },
        { systemId: 2, refuelBefore: true },
        { systemId: 3, refuelBefore: false },
      ],
    });
    expect(r?.hops.map((h) => h.refuel)).toEqual([true, false, false]); // hop 2 needs fuel, so the ship refuels at stop 1
    expect(r?.target.name).toBe("HOME");
    expect(r?.target.position.x).toBe(500);
  });

  it("gives nothing for 'here', and still the target when there are no hops", () => {
    expect(routeFromPlan(positionOf, { status: "here", target: { name: "X", systemId: 1 }, hops: [] })).toBeNull();
    const stuck = routeFromPlan(positionOf, { status: "stuck", target: { name: "X", systemId: 9 }, hops: [] });
    expect(stuck?.hops).toHaveLength(0);
    expect(routeFromPlan(positionOf, { status: "ok", target: { name: "X", systemId: 77 }, hops: [] })).toBeNull(); // unknown star
  });

  it("skips a hop whose star is unknown", () => {
    const r = routeFromPlan(positionOf, { status: "ok", target: { name: "X", systemId: 9 }, hops: [{ systemId: 77, refuelBefore: false }, { systemId: 2, refuelBefore: false }] });
    expect(r?.hops).toHaveLength(1);
  });

  it("turns my places into markers in the order of importance of their kinds", () => {
    const list = placesFromRows(positionOf, [
      { kinds: ["recent", "outpost"], name: "A", systemId: 1 },
      { kinds: ["starred"], name: "B", systemId: 2 },
      { kinds: ["recent"], name: "C", systemId: 77 },
      { kinds: ["unknown-kind"], name: "D", systemId: 3 },
    ]);
    expect(list).toHaveLength(2);
    expect(list[0]?.kinds).toEqual(["outpost", "recent"]);
    expect(list[1]?.name).toBe("B");
  });
});

describe("the little marker pictures", () => {
  const names = Object.keys(GLYPHS) as GlyphName[];

  it("are all square with an odd size, so they sit on the middle of a pixel", () => {
    for (const name of names) {
      const def = GLYPHS[name];
      for (const row of def.rows) expect(row.length).toBe(def.rows.length);
      expect(glyphTexels(def).size % 2).toBe(1);
    }
  });

  it("have a one-pixel dark edge around the picture and nothing in the corners", () => {
    for (const name of names) {
      const t = glyphTexels(GLYPHS[name]);
      expect(t.data.length).toBe(t.size * t.size * 4);
      const alphaAt = (x: number, y: number) => t.data[(y * t.size + x) * 4 + 3]!;
      expect(alphaAt(0, 0)).toBe(0);
      expect(alphaAt(t.size - 1, t.size - 1)).toBe(0);
      let solid = 0;
      let edge = 0;
      for (let i = 3; i < t.data.length; i += 4) {
        if (t.data[i] === 255) solid++;
        else if (t.data[i] === 235) edge++;
        else expect(t.data[i]).toBe(0);
      }
      expect(solid).toBeGreaterThan(5);
      expect(edge).toBeGreaterThan(5);
    }
  });

  it("start with the top row (the house roof is at the top)", () => {
    const t = glyphTexels(GLYPHS.start);
    // The roof tip is a single pixel in the middle of the first picture row (texture row 1).
    const x = Math.floor(t.size / 2);
    expect(t.data[(1 * t.size + x) * 4 + 3]).toBe(255);
    expect(t.data[(1 * t.size + 1) * 4 + 3]).toBe(0);
    // The bottom picture row (the doorstep) is wide.
    expect(t.data[((t.size - 2) * t.size + 3) * 4 + 3]).toBe(255);
  });

  it("use two colours where a second colour is drawn", () => {
    const t = glyphTexels(GLYPHS.refuel);
    const mid = Math.floor(t.size / 2);
    const o = (mid * t.size + mid) * 4;
    expect([t.data[o], t.data[o + 1], t.data[o + 2]]).toEqual([255, 255, 255]); // the white dot
    const ring = (1 * t.size + mid) * 4; // top of the ring
    expect([t.data[ring], t.data[ring + 1], t.data[ring + 2]]).toEqual([0xff, 0xb5, 0x47]);
  });
});

describe("the words next to the marker", () => {
  const bounds = { left: 0, top: 50, right: 400, bottom: 700 };

  it("sit towards the middle of the picture from the edge the marker is on", () => {
    expect(tagPosition(0, 300, 100, 20, "left", bounds)).toEqual({ x: 16, y: 290 });
    expect(tagPosition(400, 300, 100, 20, "right", bounds)).toEqual({ x: 284, y: 290 });
    expect(tagPosition(200, 50, 100, 20, "top", bounds)).toEqual({ x: 150, y: 66 });
    expect(tagPosition(200, 700, 100, 20, "bottom", bounds)).toEqual({ x: 150, y: 664 });
  });

  it("stay inside the free area", () => {
    const p = tagPosition(20, 60, 300, 40, "top", bounds);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(50);
    const q = tagPosition(390, 690, 300, 40, "inside", bounds);
    expect(q.x + 300).toBeLessThanOrEqual(400);
    expect(q.y + 40).toBeLessThanOrEqual(700);
  });

  it("go to the left of a marker inside the picture when there is no room on the right", () => {
    expect(tagPosition(380, 300, 100, 20, "inside", bounds).x).toBe(264);
    expect(tagPosition(100, 300, 100, 20, "inside", bounds).x).toBe(116);
  });
});

describe("what the map was told to draw (the app's plan and the made-up one)", () => {
  const demoRoute = route([[10, 0, 0]], [500, 0, 0]);
  const realRoute = route([[0, 10, 0]], [0, 900, 0]);
  const demoSpots: MapPlace[] = [{ systemId: -1, position: { x: 1, y: 2, z: 3 }, kinds: ["starred"], name: "demo" }];
  const mine: MapPlace[] = [{ systemId: 5, position: { x: 0, y: 0, z: 0 }, kinds: ["start"], name: "start dock" }];

  it("keeps the made-up plan when the app hands over its places (this was the first-try bug: no line showed)", () => {
    const nav = new NavInput(true);
    nav.setPlaces(mine);
    nav.setDemo(demoRoute, demoSpots);
    expect(nav.demo).toBe(true);
    expect(nav.route()).toBe(demoRoute);
    expect(nav.places().map((p) => p.name)).toEqual(["start dock", "demo"]);
    nav.setPlaces(mine); // handed over again
    expect(nav.route()).toBe(demoRoute);
  });

  it("lets a real plan replace the made-up one, and the made-up places go with it", () => {
    const nav = new NavInput(true);
    nav.setPlaces(mine);
    nav.setDemo(demoRoute, demoSpots);
    nav.setRoute(realRoute);
    expect(nav.demo).toBe(false);
    expect(nav.route()).toBe(realRoute);
    expect(nav.places()).toHaveLength(1);
    nav.setDemo(demoRoute, demoSpots); // asked again later: ignored
    expect(nav.route()).toBe(realRoute);
    nav.setRoute(null);
    expect(nav.route()).toBeNull();
  });

  it("ignores 'no plan' while only the made-up plan is shown", () => {
    const nav = new NavInput(true);
    nav.setDemo(demoRoute, demoSpots);
    nav.setRoute(null);
    expect(nav.route()).toBe(demoRoute);
  });

  it("does nothing made-up unless the testing aid is on", () => {
    const nav = new NavInput(false);
    nav.setDemo(demoRoute, demoSpots);
    expect(nav.route()).toBeNull();
    expect(nav.places()).toHaveLength(0);
    nav.setRoute(realRoute);
    nav.setPlaces(mine);
    expect(nav.route()).toBe(realRoute);
    expect(nav.places()).toHaveLength(1);
  });
});

describe("far places at their true spot (3q)", () => {
  it("is the plain projection: the middle of the picture for (0, 0), the corners for +-1", () => {
    expect(trueSpot(0, 0, false, 180, 320)).toEqual({ x: 90, y: 160 });
    expect(trueSpot(-1, 1, false, 180, 320)).toEqual({ x: 0, y: 0 });
    expect(trueSpot(1, -1, false, 180, 320)).toEqual({ x: 180, y: 320 });
    const q = trueSpot(0.25, 0.5, false, 200, 100)!;
    expect(q.x).toBeCloseTo(125, 9);
    expect(q.y).toBeCloseTo(25, 9);
  });

  it("is not clamped: nothing is returned for a place off the picture or behind the camera", () => {
    expect(trueSpot(1.01, 0, false, 180, 320)).toBeNull();
    expect(trueSpot(0, -1.2, false, 180, 320)).toBeNull();
    expect(trueSpot(0, 0, true, 180, 320)).toBeNull(); // behind the camera, even if the mirrored picture says "middle"
    expect(trueSpot(Number.NaN, 0, false, 180, 320)).toBeNull();
    // the old way pushed such a place onto the edge instead
    expect(pinToSafeRect(3, 0, false, 180, 320, NO_INSET, true).pinned).toBe(true);
  });

  it("moves with the sky: a turn of the picture moves the spot by the same amount, no sliding along a border", () => {
    const a = trueSpot(0.4, 0.1, false, 180, 320)!;
    const b = trueSpot(0.4 - 0.2, 0.1, false, 180, 320)!;
    expect(a.x - b.x).toBeCloseTo(0.2 * 90, 9);
    expect(a.y).toBe(b.y);
    expect(trueSpot(0.4 - 1.5, 0.1, false, 180, 320)).toBeNull(); // turned further: gone, not stuck on the edge
  });

  it("reads the testing word ?maptarget=a|b", () => {
    expect(parseMapTarget("?maptarget=a")).toBe("A");
    expect(parseMapTarget("?x=1&maptarget=B")).toBe("B");
    expect(parseMapTarget("?maptarget=edge")).toBe("B");
    expect(parseMapTarget("?maptarget=true")).toBe("A");
    expect(parseMapTarget("")).toBeNull();
    expect(parseMapTarget("?maptarget=green")).toBeNull();
  });
});
