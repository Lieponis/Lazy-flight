// HOTFIX 2026-11-21: the installed iPhone app crashed on every start while docked at Crooked Cove Outpost (Hobploo 9T6VR-7427 I),
// a dock 620 ly above the galaxy's middle plane. Cause: the galaxy map's background job asked for the nearest 60,000 stars, and
// from that sparse spot the search gathered about 3 million stars first (13 s, about 400 MB). These tests keep it fixed, and
// check the start-up safety nets (bad stored destination, flight plan work limit, the SAFE START decision).
import { describe, expect, it } from "vitest";
import { Game, createClock, planHops } from "../src/game";
import { MAX_PLAN_QUERIES } from "../src/game/route";
import { WORLD_SEED, findSystemByName, getDocks, getSite, nearestDocks, nearestSites } from "../src/universe";
import { cleanNavTarget } from "../src/ui/navtarget";
import { RESCUE_AFTER_FAILED_STARTS, decideRescue } from "../src/rescue";

const hobploo = findSystemByName(WORLD_SEED, "Hobploo 9T6VR-7427")!;
const andyDock = "43059078545/0";

describe("the far dock above the disc (Andy's crash place)", () => {
  it("is the place from the crash report", () => {
    expect(hobploo.id).toBe(43059078545);
    expect(getDocks(WORLD_SEED, hobploo.id).map((d) => d.id)).toEqual([andyDock]);
    expect(hobploo.position.y).toBeGreaterThan(600);
  });

  it("the map's 60,000 nearest stars come quickly, and are the true nearest ones", { timeout: 60_000 }, () => {
    const t = performance.now();
    const many = nearestSites(WORLD_SEED, hobploo.position, 60_000);
    const ms = performance.now() - t;
    expect(many.length).toBe(60_000);
    expect(ms).toBeLessThan(8_000); // was about 13,000 ms (and 400 MB) before the fix; now about 1,000 ms
    // Same answer as a small question (the nearest stars do not depend on how many are asked for), sorted by distance.
    const few = nearestSites(WORLD_SEED, hobploo.position, 500);
    expect(many.slice(0, 500).map((s) => s.id)).toEqual(few.map((s) => s.id));
    for (let i = 1; i < many.length; i++) expect(many[i]!.distance).toBeGreaterThanOrEqual(many[i - 1]!.distance);
  });

  it("a flight plan from there to a far place stays within the work limit and gives an answer", () => {
    const game = new Game(WORLD_SEED, andyDock, createClock(1, () => 1e9));
    game.state = { ...game.state, fuel: 11 };
    const p = hobploo.position;
    for (const t of [{ x: p.x + 1100, y: p.y, z: p.z + 600 }, { x: 0, y: 0, z: 0 }, { x: p.x, y: p.y + 3000, z: p.z }]) {
      const target = nearestDocks(WORLD_SEED, t, 1)[0]!.dockId;
      const plan = game.planRoute(target);
      expect(["ok", "stuck", "too-far-no-docks"]).toContain(plan.status);
    }
  });
});

describe("the flight plan work limit", () => {
  const from = getSite(WORLD_SEED, hobploo.id)!.position;
  const far = nearestDocks(WORLD_SEED, { x: from.x + 3000, y: 0, z: from.z }, 1)[0]!;
  const q = { seed: WORLD_SEED, from, fromSystemId: hobploo.id, to: far.position, toSystemId: far.systemId, toDockId: far.dockId, rangeLy: 69 };

  it("is generous for normal plans", () => {
    expect(MAX_PLAN_QUERIES).toBeGreaterThanOrEqual(400);
    expect(planHops(q)).toEqual(planHops({ ...q, maxQueries: 1_000_000 }));
  });

  it("when reached, the plan stops where it got to instead of searching on (never throws)", () => {
    const short = planHops({ ...q, maxQueries: 7 });
    expect(short.status).toBe("ok");
    expect(short.truncated).toBe(true);
    expect(short.hops.length).toBeGreaterThan(0);
    expect(short.hops.length).toBeLessThan(planHops(q).hops.length + 1);
    const none = planHops({ ...q, maxQueries: 0 });
    expect(none.status).toBe("stuck");
    expect(none.hops).toEqual([]);
  });
});

describe("a bad stored destination is dropped, never handed to the planner", () => {
  it("keeps real places", () => {
    expect(cleanNavTarget(WORLD_SEED, andyDock)).toBe(andyDock);
    expect(cleanNavTarget(WORLD_SEED, String(hobploo.id))).toBe(String(hobploo.id));
    expect(cleanNavTarget(WORLD_SEED, ` ${andyDock} `)).toBe(andyDock);
  });

  it.each([
    ["nothing", null],
    ["empty", ""],
    ["a number, not text", 42],
    ["an object", { id: andyDock }],
    ["junk text", "hello world"],
    ["JSON text", '{"id":"43059078545/0"}'],
    ["a dock number that does not exist", "43059078545/9"],
    ["a system that does not exist", "999999999999999"],
    ["an old universe id", "5:6:2:0/1"],
    ["very long", "1".repeat(5000)],
    ["minus sign", "-5/0"],
  ])("%s", (_label, raw) => {
    expect(cleanNavTarget(WORLD_SEED, raw)).toBeNull();
  });

  it("the game itself also answers a strange destination calmly", () => {
    const game = new Game(WORLD_SEED, andyDock, createClock(1, () => 1e9));
    for (const id of ["", "nonsense", "5:6:2:0/1", "43059078545/9", "1".repeat(500)]) {
      expect(() => game.planRoute(id)).not.toThrow();
      expect(game.planRoute(id).status).toBe("no-such-place");
    }
  });
});

describe("SAFE START decision", () => {
  it("starts normally on a first or second start", () => {
    expect(decideRescue("", null, false).rescue).toBe(false);
    expect(decideRescue("", "1", false).rescue).toBe(false);
  });
  it("opens after repeated unfinished starts (the installed app cannot type ?rescue=1)", () => {
    expect(decideRescue("", String(RESCUE_AFTER_FAILED_STARTS), false)).toEqual({ rescue: true, why: "crashes", failedStarts: 2 });
    expect(decideRescue("", "7", false).rescue).toBe(true);
  });
  it("START GAME on the rescue screen lets the next start go ahead once", () => {
    expect(decideRescue("", "5", true).rescue).toBe(false);
  });
  it("?rescue=1 always opens it", () => {
    expect(decideRescue("?rescue=1", null, false)).toEqual({ rescue: true, why: "asked", failedStarts: 0 });
    expect(decideRescue("?dev=1&rescue=1", null, true).rescue).toBe(true);
    expect(decideRescue("?rescue=10", null, false).rescue).toBe(false);
  });
  it("ignores a broken counter", () => {
    expect(decideRescue("", "banana", false).rescue).toBe(false);
  });
});
