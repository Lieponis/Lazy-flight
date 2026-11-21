// Stage NAV-1 (Agent 4): the hopping flight plan (planRoute, nextHop).
import { describe, expect, it } from "vitest";
import { Game, MAX_PLAN_HOPS, createClock, newGameState, type GameState, type RoutePlan } from "../src/game";
import { START_POINT, WORLD_SEED, distanceBetweenSystems, getDock, getSite, nearestDocks, startDockOf, type Vec3 } from "../src/universe";

const START = startDockOf(WORLD_SEED).id;

function makeGame(dockId: string = START, now = 1_000_000_000) {
  let t = now;
  const game = new Game(WORLD_SEED, dockId, createClock(1, () => t));
  return { game, advance: (ms: number) => void (t += ms) };
}
const dockNear = (p: Vec3): string => nearestDocks(WORLD_SEED, p, 1)[0]!.dockId;
const at = (dx: number, dz: number): Vec3 => ({ x: START_POINT.x + dx, y: START_POINT.y, z: START_POINT.z + dz });
const posOf = (systemId: number): Vec3 => getSite(WORLD_SEED, systemId)!.position;
const dist = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** A rim dock whose ship can reach other docks but is blocked on the way to the start (found by scanning; fixed forever). */
function rimDock(radius: number, angle: number): string {
  return dockNear({ x: radius * Math.cos(angle), y: 0, z: radius * Math.sin(angle) });
}

const TARGETS: [string, Vec3][] = [
  ["60 ly east", at(60, 0)],
  ["150 ly north", at(0, 150)],
  ["300 ly south-west", at(-210, -210)],
  ["1000 ly west", at(-1000, 0)],
];

describe("a plan is made of real docks, each within one full tank, each closer to the target", () => {
  for (const [label, p] of TARGETS) {
    it(label, () => {
      const { game } = makeGame();
      const targetDock = dockNear(p);
      const plan = game.planRoute(targetDock);
      expect(plan.status).toBe("ok");
      expect(plan.hops.length).toBeGreaterThan(0);
      expect(plan.hops.length).toBeLessThanOrEqual(MAX_PLAN_HOPS);
      expect(plan.rangeLy).toBe(29); // 60 fuel tank minus the 1 fuel strand reserve = 59 fuel = 29 ly
      expect(plan.rangeLy).toBeLessThanOrEqual(game.getPlaceInfo().rangeLy);
      const target = posOf(plan.target!.systemId);
      let prev = game.currentSystemId();
      let remaining = dist(posOf(prev), target);
      const seen = new Set<number>([prev]);
      let ly = 0;
      for (const [i, hop] of plan.hops.entries()) {
        expect(hop.index).toBe(i + 1);
        expect(getDock(WORLD_SEED, hop.dockId)?.systemId).toBe(hop.systemId); // a real dock
        const d = distanceBetweenSystems(WORLD_SEED, prev, hop.systemId)!;
        expect(d).toBeLessThanOrEqual(plan.rangeLy);
        expect(Math.abs(hop.distanceLy - d)).toBeLessThan(0.06);
        expect(hop.fuelNeeded).toBeLessThanOrEqual(game.getShipStats().fuelTankSize);
        const now = dist(posOf(hop.systemId), target);
        expect(now).toBeLessThan(remaining); // gets closer each hop
        remaining = now;
        expect(seen.has(hop.systemId)).toBe(false); // no system twice
        seen.add(hop.systemId);
        prev = hop.systemId;
        ly += d;
      }
      expect(Math.abs(plan.totalLy - ly)).toBeLessThan(0.5);
      expect(plan.totalFuel).toBe(plan.hops.reduce((s, h) => s + h.fuelNeeded, 0));
      if (!plan.moreHops) {
        expect(plan.hops[plan.hops.length - 1]?.dockId).toBe(targetDock); // lands exactly at the target dock
        expect(plan.message).toBeNull();
      }
    });
  }

  it("a target 1,000 ly away gives a 20-hop plan and says it is the next 20 of about N", () => {
    const { game } = makeGame();
    const plan = game.planRoute(dockNear(at(-1000, 0)));
    expect(plan.hops.length).toBe(20);
    expect(plan.moreHops).toBe(true);
    expect(plan.hopsTotalEstimate).toBeGreaterThan(30);
    expect(plan.hopsTotalEstimate).toBeLessThan(45);
    expect(plan.message).toBe(`The plan shows the next 20 hops of about ${plan.hopsTotalEstimate}. Ask again after you arrive.`);
  });
});

describe("special targets", () => {
  it("the same star system, and the place you are at: 'here', no hops", () => {
    const { game } = makeGame();
    for (const id of [START, String(game.currentSystemId())]) {
      const plan = game.planRoute(id);
      expect(plan.status).toBe("here");
      expect(plan.hops).toEqual([]);
      expect(plan.message).toContain("already");
      expect(game.nextHop(id)).toBeNull();
    }
  });

  it("a star system number works as a target (its first dock)", () => {
    const { game } = makeGame();
    const d = nearestDocks(WORLD_SEED, at(100, 0), 1)[0]!;
    const plan = game.planRoute(String(d.systemId));
    expect(plan.status).toBe("ok");
    expect(plan.hops[plan.hops.length - 1]?.systemId).toBe(d.systemId);
  });

  it("unknown and old-shape ids: no-such-place, never a crash", () => {
    const { game } = makeGame();
    for (const id of ["3:-2:5:0/2", "", "x", "12/99", "99999999999999"]) {
      const plan = game.planRoute(id);
      expect(plan.status).toBe("no-such-place");
      expect(plan.hops).toEqual([]);
      expect(plan.target).toBeNull();
    }
  });

  it("at the rim: no dock within one tank is 'too-far-no-docks' with the gap; a blocked way is 'stuck' with closest and gap", () => {
    const lonely = makeGame(rimDock(38000, 0)).game;
    const a = lonely.planRoute(START);
    expect(a.status).toBe("too-far-no-docks");
    expect(a.hops).toEqual([]);
    expect(a.message).toContain("No dock lies within one tank");
    const blocked = makeGame(rimDock(30000, 1)).game;
    const b = blocked.planRoute(START);
    expect(b.status).toBe("stuck");
    expect(b.closestLy).toBeGreaterThan(1000);
    expect(b.gapLy).toBeGreaterThan(0);
    expect(b.message).toContain("gap");
    expect(b.hops).toEqual([]);
  });
});

describe("cheap, deterministic, read-only", () => {
  it("the same question gives the same answer, also from a fresh game; the game is not changed", () => {
    const a = makeGame().game;
    const before = JSON.stringify(a.state);
    const target = dockNear(at(-400, 100));
    const p1 = a.planRoute(target);
    const p2 = a.planRoute(target);
    const p3 = makeGame().game.planRoute(target);
    expect(p2).toEqual(p1);
    expect(p3).toEqual(p1);
    expect(JSON.stringify(a.state)).toBe(before);
    expect(a.nextHop(target)).toEqual(p1.hops[0]);
  });

  it("time: start region, 300 ly out and the rim stay cheap (the plan runs in one call)", () => {
    const rows: [string, Game, string][] = [
      ["start region", makeGame().game, dockNear(at(100, 0))],
      ["300 ly out", makeGame(dockNear(at(300, 0))).game, dockNear(at(-300, 0))],
      ["rim", makeGame(rimDock(30000, 1)).game, START],
    ];
    for (const [, game, target] of rows) {
      game.planRoute(target); // warm up
      const t0 = Date.now();
      for (let i = 0; i < 3; i++) game.planRoute(target);
      expect((Date.now() - t0) / 3).toBeLessThan(150);
    }
  });
});

describe("fuel and money", () => {
  it("full tank: the first hops need no refuel until the tank runs dry; each refuel fills the tank at 2 credits a unit", () => {
    const { game } = makeGame();
    const plan = game.planRoute(dockNear(at(-300, 0)));
    expect(plan.hops[0]?.refuelBefore).toBe(false);
    let fuel = game.state.fuel;
    let credits = 0;
    for (const h of plan.hops) {
      if (fuel - h.fuelNeeded < 1) {
        expect(h.refuelBefore).toBe(true);
        expect(h.refuelCredits).toBe((60 - fuel) * 2);
        fuel = 60;
        credits += h.refuelCredits;
      } else {
        expect(h.refuelBefore).toBe(false);
        expect(h.refuelCredits).toBe(0);
      }
      fuel -= h.fuelNeeded;
    }
    expect(plan.totalRefuelCredits).toBe(credits);
    expect(credits).toBeGreaterThan(0);
  });

  it("with little fuel the first hop says refuel first", () => {
    const { game } = makeGame();
    game.state = { ...game.state, fuel: 2 };
    const plan = game.planRoute(dockNear(at(100, 0)));
    expect(plan.hops[0]?.refuelBefore).toBe(true);
    expect(plan.hops[0]?.refuelCredits).toBe(116);
  });

  it("an outpost in the star system you leave makes that refuel cheaper", () => {
    const { game } = makeGame();
    const outpost = nearestDocks(WORLD_SEED, START_POINT, 60).find((d) => game.getOutpostOffer(d.dockId).isOutpost && d.systemId === game.currentSystemId());
    if (!outpost) return; // the start system has no outpost dock: nothing to compare
    game.state = { ...game.state, fuel: 2, ownedOutposts: [outpost.dockId], outpostCount: 1 };
    const plan = game.planRoute(dockNear(at(100, 0)));
    expect(plan.hops[0]?.refuelCredits).toBeLessThan(116);
  });

  it("a bigger-range ship (Scout) needs fewer hops for the same trip", () => {
    const hauler = makeGame().game;
    const target = dockNear(at(-600, 0));
    const h = hauler.planRoute(target);
    const scout = makeGame().game;
    scout.state = { ...scout.state, shipId: "scout", fuel: 121 } as GameState;
    expect(scout.getShipStats().fuelTankSize).toBeGreaterThan(hauler.getShipStats().fuelTankSize);
    const s = scout.planRoute(target);
    expect(s.status).toBe("ok");
    expect(s.rangeLy).toBeGreaterThan(h.rangeLy);
    expect(s.hopsTotalEstimate).toBeLessThan(h.hopsTotalEstimate);
  });
});

describe("flying the plan hop by hop with the existing free travel", () => {
  it("three hops: every hop is allowed, arrival docks there, and the next plan starts from the new place", () => {
    const h = makeGame();
    const target = dockNear(at(-400, 0));
    let remaining = dist(posOf(h.game.currentSystemId()), posOf(h.game.planRoute(target).target!.systemId));
    let credits = h.game.state.credits;
    for (let i = 0; i < 3; i++) {
      const plan: RoutePlan = h.game.planRoute(target);
      const hop = plan.hops[0]!;
      if (hop.refuelBefore) expect(h.game.refuel().ok).toBe(true);
      const check = h.game.canFreeTravel(hop.dockId);
      expect(check.ok).toBe(true);
      const r = h.game.freeTravel(hop.dockId);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      h.advance((r.seconds + 5) * 1000);
      h.game.update();
      expect(h.game.state.currentDockId).toBe(hop.dockId);
      expect(h.game.state.recentDocks[0]).toBe(hop.dockId);
      const now = dist(posOf(h.game.currentSystemId()), posOf(plan.target!.systemId));
      expect(now).toBeLessThan(remaining);
      remaining = now;
      expect(h.game.state.credits).toBeGreaterThanOrEqual(credits - 200); // refuel only; discovery adds
      credits = h.game.state.credits;
    }
    expect(Object.keys(h.game.state.explored).length).toBeGreaterThanOrEqual(3); // discovery counts as for any free trip
  });

  it("old saves and new games are fine with planRoute (no plan fields in the save)", () => {
    const st = newGameState(START);
    expect(Object.keys(st)).not.toContain("plan");
  });
});
