// Stage F1 (Agent 4f): free travel (no job), scenery planets, strand protection, discovery credits, Explorer rank, save.
import { describe, expect, it } from "vitest";
import {
  EXPLORER_RANK_NAMES,
  Game,
  MAX_EXPLORED_SYSTEMS,
  cleanExplored,
  createClock,
  discoveryBase,
  explorerInfo,
  exploredCounts,
  newGameState,
  normalizeState,
  recordArrival,
  tripFuelCost,
  tripSeconds,
  type GameState,
} from "../src/game";
import { simulateExplorer } from "./sim/explorer-sim";
import { MESSAGE_REBUILT, fitToUniverse, loadIntoGame, makeSaveData, migrateSave, readSave, type SaveData } from "../src/save";
import {
  distanceBetweenSystems,
  docksOf,
  getDock,
  getPlanetsOfSystem,
  getSystem,
  listSystemsNear,
  startDockOf,
  type Planet,
  type StarSystem,
} from "../src/universe";

const SEED = 12345;
const ORIGIN = { x: 0, y: 0, z: 0 };

/** A game on a clock we move by hand. */
function makeGame(startDockId: string = startDockOf(SEED).id, seed = SEED) {
  let t = 1_000_000_000;
  const game = new Game(seed, startDockId, createClock(1, () => t));
  return {
    game,
    advance: (ms: number) => {
      t += ms;
    },
    now: () => t,
  };
}

function sceneryOf(system: StarSystem, seed = SEED): Planet[] {
  const docks = new Set(docksOf(seed, system).map((d) => d.id));
  return getPlanetsOfSystem(seed, system.id).filter((p) => !docks.has(p.id));
}

/** The first near system that has at least one planet without a dock, with that planet and one of its docks. */
function systemWithScenery(minDocks = 1, maxDocks = 3): { system: StarSystem; planet: Planet; dockId: string } {
  for (const system of listSystemsNear(SEED, ORIGIN, 40)) {
    const docks = docksOf(SEED, system);
    const scenery = sceneryOf(system);
    if (scenery.length > 0 && docks.length >= minDocks && docks.length <= maxDocks) {
      return { system, planet: scenery[0] as Planet, dockId: (docks[0] as { id: string }).id };
    }
  }
  throw new Error("no system with scenery");
}

/** A dock in ANOTHER star system, near the start, that the starter ship can reach with fuel to spare. */
function dockInAnotherSystem(fromSystemId: string, maxLy = 12): { dockId: string; systemId: string; ly: number } {
  const here = getSystem(SEED, fromSystemId) as StarSystem;
  for (const system of listSystemsNear(SEED, here.position, maxLy)) {
    if (system.id === fromSystemId) continue;
    const dock = docksOf(SEED, system)[0];
    if (dock) return { dockId: dock.id, systemId: system.id, ly: distanceBetweenSystems(SEED, fromSystemId, system.id) as number };
  }
  throw new Error("no other system");
}

describe("free travel to a dock (no job)", () => {
  it("costs fuel only, takes the same time as a job of that length, and ends docked at the target", () => {
    const { game, advance } = makeGame();
    const startSystem = game.currentSystemId();
    const target = dockInAnotherSystem(startSystem);
    const ranks = { ...game.state.completedJobs };
    const credits = game.state.credits;
    const fuel = game.state.fuel;
    const check = game.canFreeTravel(target.dockId);
    expect(check.ok).toBe(true);
    const need = tripFuelCost(game.state, target.ly);
    const result = game.freeTravel(target.dockId);
    expect(result).toEqual({ ok: true, fuelUsed: need, seconds: tripSeconds(target.ly) });
    expect(game.state.fuel).toBe(fuel - need);
    expect(game.state.freeTrip).not.toBeNull();
    expect(game.state.currentJob).toBeNull();
    expect(game.getBoard()).toEqual([]); // no job while flying
    expect(game.progress()?.totalMs).toBe(tripSeconds(target.ly) * 1000);
    advance(tripSeconds(target.ly) * 1000 - 1);
    expect(game.update()).toBeNull();
    expect(game.state.freeTrip).not.toBeNull();
    advance(1);
    expect(game.update()).toBeNull(); // update() reports job arrivals; a free arrival is in lastFreeArrival
    expect(game.lastFreeArrival?.isDock).toBe(true);
    expect(game.state.freeTrip).toBeNull();
    expect(game.state.currentDockId).toBe(target.dockId);
    expect(game.state.spacePlanetId).toBeNull();
    expect(game.state.completedJobs).toEqual(ranks); // no job rank progress
    expect(game.state.credits).toBe(credits + (game.lastFreeArrival?.discovery ?? 0)); // no pay, only discovery
    expect(game.getBoard().length).toBeGreaterThan(0); // docked: the job board is back
  });

  it("canFreeTravel gives the numbers: fuel needed, fuel left, time, discovery", () => {
    const { game } = makeGame();
    const target = dockInAnotherSystem(game.currentSystemId());
    const c = game.canFreeTravel(target.dockId);
    if (!c.ok) throw new Error(c.reason);
    expect(c.isDock).toBe(true);
    expect(c.fuelNeeded).toBe(tripFuelCost(game.state, target.ly));
    expect(c.fuelLeft).toBe(game.state.fuel - c.fuelNeeded);
    expect(c.seconds).toBe(tripSeconds(target.ly));
    expect(c.newSystem).toBe(true);
    expect(c.discoveryCredits).toBe(discoveryBase(SEED, target.systemId));
    expect(c.targetName).toBe((getDock(SEED, target.dockId) as { name: string }).name);
  });

  it("refuses a place that does not exist, the place you are at, and a second trip while flying", () => {
    const { game } = makeGame();
    const target = dockInAnotherSystem(game.currentSystemId());
    expect(game.canFreeTravel("nope")).toEqual({ ok: false, reason: "There is no such place." });
    expect(game.canFreeTravel("1:1:1:1/99")).toEqual({ ok: false, reason: "There is no such place." });
    expect(game.freeTravel(game.state.currentDockId)).toEqual({ ok: false, reason: "You are already there." });
    expect(game.freeTravel(target.dockId).ok).toBe(true);
    const again = game.freeTravel(target.dockId);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toContain("already flying");
  });

  it("is refused while a job is in flight", () => {
    const { game } = makeGame();
    const entry = game.getBoard().find((e) => !e.block);
    if (!entry) return; // this board has nothing takeable; the other tests cover the rule
    expect(game.accept(entry.job.id).ok).toBe(true);
    const target = dockInAnotherSystem(game.currentSystemId());
    const r = game.freeTravel(target.dockId);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("already have a job");
  });
});

describe("free travel to a planet without a dock", () => {
  it("you float there: no dock, the last dock stays as your base, the trip inside one system is the short one", () => {
    const { system, planet, dockId } = systemWithScenery();
    const { game, advance } = makeGame(dockId);
    expect(game.currentSystemId()).toBe(system.id);
    const fuel = game.state.fuel;
    const r = game.freeTravel(planet.id);
    expect(r).toEqual({ ok: true, fuelUsed: tripFuelCost(game.state, 0), seconds: 20 });
    expect(game.state.fuel).toBe(fuel - 1);
    advance(20_000);
    game.update();
    expect(game.state.spacePlanetId).toBe(planet.id);
    expect(game.state.currentDockId).toBe(dockId);
    expect(game.lastFreeArrival?.isDock).toBe(false);
    expect(game.lastFreeArrival?.line).toContain(planet.name);
    expect(game.currentSystemId()).toBe(system.id);
  });

  it("from a planet there are no jobs, no refuel, no shop; the answers are plain text", () => {
    const { planet, dockId } = systemWithScenery();
    const { game, advance } = makeGame(dockId);
    const job = game.getBoard()[0]?.job;
    game.freeTravel(planet.id);
    advance(20_000);
    game.update();
    expect(game.getBoard()).toEqual([]);
    if (job) {
      const accept = game.accept(job.id);
      expect(accept.ok).toBe(false);
      if (!accept.ok) expect(accept.block.text).toContain(planet.name);
    }
    game.state = { ...game.state, fuel: 10, credits: 99999 };
    const refuel = game.refuel();
    expect(refuel.ok).toBe(false);
    expect(game.state.fuel).toBe(10);
    expect(game.state.credits).toBe(99999);
    expect(game.buyShip("scout").ok).toBe(false);
    expect(game.buyUpgrade("cargo-hauler", "tank").ok).toBe(false);
    expect(game.getOutpostOffer(dockId).canBuy).toBe(false);
    expect(game.buyOutpost(dockId).ok).toBe(false);
    expect(game.state.credits).toBe(99999);
  });

  it("from a planet you can fly on, counted from that planet's star system, and switch ships", () => {
    const { planet, dockId, system } = systemWithScenery();
    const { game, advance } = makeGame(dockId);
    game.freeTravel(planet.id);
    advance(20_000);
    game.update();
    const other = dockInAnotherSystem(system.id);
    const c = game.canFreeTravel(other.dockId);
    if (!c.ok) throw new Error(c.reason);
    expect(c.distanceLy).toBeCloseTo(other.ly, 9);
    expect(game.freeTravel(other.dockId).ok).toBe(true);
    advance(tripSeconds(other.ly) * 1000);
    game.update();
    expect(game.state.spacePlanetId).toBeNull();
    expect(game.state.currentDockId).toBe(other.dockId);
    // switching ships is allowed while floating
    const g2 = makeGame(dockId);
    g2.game.state = { ...g2.game.state, ownedShips: { scout: { fuel: 50 } } };
    g2.game.freeTravel(planet.id);
    g2.advance(20_000);
    g2.game.update();
    expect(g2.game.switchShip("scout").ok).toBe(true);
    expect(g2.game.state.shipId).toBe("scout");
  });

  it("a one-dock system works: fly to its dock, to its scenery planet, and back", () => {
    const { system, planet, dockId } = systemWithScenery(1, 1);
    expect(docksOf(SEED, system).length).toBe(1);
    const { game, advance } = makeGame(dockId);
    expect(game.freeTravel(planet.id).ok).toBe(true);
    advance(20_000);
    game.update();
    expect(game.state.spacePlanetId).toBe(planet.id);
    expect(game.freeTravel(dockId).ok).toBe(true);
    advance(20_000);
    game.update();
    expect(game.state.spacePlanetId).toBeNull();
    expect(game.state.currentDockId).toBe(dockId);
    expect(game.getBoard().length).toBeGreaterThan(0);
  });
});

describe("strand protection and the emergency refuel", () => {
  it("a trip is refused when it would leave less than the fuel to reach a dock; the text has the numbers", () => {
    const { game } = makeGame();
    const target = dockInAnotherSystem(game.currentSystemId());
    const need = tripFuelCost(game.state, target.ly);
    game.state = { ...game.state, fuel: need };
    const r = game.canFreeTravel(target.dockId);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain("0 fuel");
      expect(r.reason).toContain("need 1");
    }
    expect(game.freeTravel(target.dockId).ok).toBe(false);
    expect(game.state.fuel).toBe(need); // nothing was spent
    game.state = { ...game.state, fuel: need + 1 };
    expect(game.canFreeTravel(target.dockId).ok).toBe(true);
  });

  it("not enough fuel at all, and a tank that is too small, give plain text with numbers", () => {
    const { game } = makeGame();
    const target = dockInAnotherSystem(game.currentSystemId());
    const need = tripFuelCost(game.state, target.ly);
    game.state = { ...game.state, fuel: need - 1 };
    const low = game.canFreeTravel(target.dockId);
    expect(low.ok).toBe(false);
    if (!low.ok) expect(low.reason).toContain(`needs ${need}, you have ${need - 1}`);
    // a place so far (over 30 ly) that the 60-unit tank cannot do it
    const far = listSystemsNear(SEED, ORIGIN, 60).find((s) => (distanceBetweenSystems(SEED, game.currentSystemId(), s.id) as number) > 32);
    const farDock = far ? docksOf(SEED, far)[0] : undefined;
    if (farDock) {
      const tooFar = game.canFreeTravel(farDock.id);
      expect(tooFar.ok).toBe(false);
      if (!tooFar.ok) expect(tooFar.reason).toContain("tank holds");
    }
  });

  it("emergency refuel works from a planet when no trip is possible, and not when you have fuel", () => {
    const { planet, dockId } = systemWithScenery();
    const { game, advance } = makeGame(dockId);
    game.freeTravel(planet.id);
    advance(20_000);
    game.update();
    expect(game.isStuck()).toBe(false);
    expect(game.emergencyRefuel().ok).toBe(false);
    game.state = { ...game.state, fuel: 0, credits: 0 };
    expect(game.isStuck()).toBe(true);
    const r = game.emergencyRefuel();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.units).toBe(20);
    expect(game.state.fuel).toBe(20);
    expect(game.state.credits).toBe(0); // it is free
    expect(game.isStuck()).toBe(false);
  });

  it("no emergency refuel and no stuck state while flying", () => {
    const { game } = makeGame();
    const target = dockInAnotherSystem(game.currentSystemId());
    game.freeTravel(target.dockId);
    expect(game.isStuck()).toBe(false);
    expect(game.emergencyRefuel().ok).toBe(false);
  });
});

describe("discovery credits", () => {
  it("are 50 to 100 for every star system near the start, and the same every time", () => {
    for (const system of listSystemsNear(SEED, ORIGIN, 40)) {
      const c = discoveryBase(SEED, system.id);
      expect(c).toBeGreaterThanOrEqual(50);
      expect(c).toBeLessThanOrEqual(100);
      expect(discoveryBase(SEED, system.id)).toBe(c);
    }
    const all = new Set(listSystemsNear(SEED, ORIGIN, 40).map((s) => discoveryBase(SEED, s.id)));
    expect(all.size).toBeGreaterThan(10); // not all the same number
    expect(new Set(listSystemsNear(SEED, ORIGIN, 40).map((s) => discoveryBase(777, s.id) - discoveryBase(SEED, s.id))).size).toBeGreaterThan(1);
  });

  it("are paid on the first arrival in a system, once, and the planet count still rises", () => {
    const { game, advance } = makeGame();
    const target = dockInAnotherSystem(game.currentSystemId());
    const credits = game.state.credits;
    game.freeTravel(target.dockId);
    advance(tripSeconds(target.ly) * 1000);
    game.update();
    const pay = discoveryBase(SEED, target.systemId);
    expect(game.lastFreeArrival?.discovery).toBe(pay);
    expect(game.lastFreeArrival?.newSystem).toBe(true);
    expect(game.state.credits).toBe(credits + pay);
    expect(game.getExplorer().systems).toBe(1);
    expect(game.getExplorer().planets).toBe(1);
    // a second planet in the same star system: no credits, planet count rises
    const scenery = sceneryOf(getSystem(SEED, target.systemId) as StarSystem)[0];
    if (scenery) {
      game.freeTravel(scenery.id);
      advance(20_000);
      game.update();
      expect(game.lastFreeArrival?.discovery).toBe(0);
      expect(game.lastFreeArrival?.newSystem).toBe(false);
      expect(game.lastFreeArrival?.newPlanet).toBe(true);
      expect(game.state.credits).toBe(credits + pay);
      expect(game.getExplorer().systems).toBe(1);
      expect(game.getExplorer().planets).toBe(2);
    }
    // the same place again: nothing new
    game.freeTravel(target.dockId);
    advance(20_000);
    game.update();
    expect(game.lastFreeArrival?.discovery).toBe(0);
    expect(game.lastFreeArrival?.newPlanet).toBe(false);
  });

  it("are the same amount in another game of the same seed", () => {
    const a = makeGame();
    const b = makeGame();
    const target = dockInAnotherSystem(a.game.currentSystemId());
    for (const g of [a, b]) {
      g.game.freeTravel(target.dockId);
      g.advance(tripSeconds(target.ly) * 1000);
      g.game.update();
    }
    expect(a.game.state.credits).toBe(b.game.state.credits);
    expect(a.game.state.explored).toEqual(b.game.state.explored);
  });

  it("are paid for a job's arrival too, on top of the job's pay, and a job pays its reward exactly as before", () => {
    const { game, advance } = makeGame();
    const entry = game.getBoard().find((e) => !e.block);
    if (!entry) return;
    const credits = game.state.credits;
    game.accept(entry.job.id);
    advance(entry.tripSeconds * 1000);
    const arrival = game.update();
    expect(arrival?.reward).toBe(entry.job.reward);
    const systemId = entry.job.destinationDockId.split("/")[0] as string;
    expect(arrival?.discovery).toBe(discoveryBase(SEED, systemId));
    expect(arrival?.newSystem).toBe(true);
    expect(game.state.credits).toBe(credits + entry.job.reward + discoveryBase(SEED, systemId));
    expect(game.getExplorer().systems).toBe(1);
  });
});

describe("Explorer rank", () => {
  /** An explored list with exactly `n` discoveries made of made-up systems (2 discoveries each: the system and one planet). */
  function exploredWith(n: number): Record<string, number> {
    const out: Record<string, number> = {};
    for (let i = 0; i < Math.floor(n / 2); i++) out[`fake:${i}`] = 1;
    return out;
  }

  it("has the rank names Andy chose, and the thresholds 50 and 200 discoveries", () => {
    expect(EXPLORER_RANK_NAMES).toEqual(["Lost in Space", "Cartographer", "Mr Galaxy-wide"]);
    expect(explorerInfo({}).rankNumber).toBe(1);
    expect(explorerInfo({}).rankName).toBe("Lost in Space");
    expect(explorerInfo(exploredWith(48)).rankNumber).toBe(1);
    expect(explorerInfo(exploredWith(48)).discoveriesToNext).toBe(2);
    expect(explorerInfo(exploredWith(50)).rankName).toBe("Cartographer");
    expect(explorerInfo(exploredWith(50)).discoveryBonusPercent).toBe(10);
    expect(explorerInfo(exploredWith(198)).rankNumber).toBe(2);
    expect(explorerInfo(exploredWith(200)).rankName).toBe("Mr Galaxy-wide");
    expect(explorerInfo(exploredWith(200)).discoveryBonusPercent).toBe(20);
    expect(explorerInfo(exploredWith(200)).nextRankName).toBeNull();
    expect(explorerInfo(exploredWith(200)).discoveriesToNext).toBeNull();
  });

  it("counts a system and each planet of it (several planets of one system share one number)", () => {
    // planets 0, 2 and 9 of one system, planet 1 of another
    expect(exploredCounts({ a: 0b1000000101, b: 0b10 })).toEqual({ systems: 2, planets: 4 });
    expect(explorerInfo({ a: 0b1000000101, b: 0b10 }).discoveries).toBe(6);
  });

  it("the rank-up is reported on the arrival that earns it; the bonus counts from the NEXT system", () => {
    const base = (id: string) => discoveryBase(SEED, id);
    const first = recordArrival(exploredWith(48), "9:9:9:0/0", base); // +2 discoveries: system and planet = 50
    expect(first.discovery.explorerRankUp).toEqual({ rankNumber: 2, rankName: "Cartographer" });
    expect(first.discovery.credits).toBe(base("9:9:9:0")); // paid at the old rank (+0%)
    const second = recordArrival(first.explored, "9:9:9:1/0", base);
    expect(second.discovery.credits).toBe(Math.round(base("9:9:9:1") * 1.1)); // rank 2: +10%
    expect(second.discovery.explorerRankUp).toBeNull();
    const third = recordArrival(exploredWith(198), "8:8:8:0/0", base);
    expect(third.discovery.explorerRankUp).toEqual({ rankNumber: 3, rankName: "Mr Galaxy-wide" });
    expect(recordArrival(third.explored, "8:8:8:1/0", base).discovery.credits).toBe(Math.round(base("8:8:8:1") * 1.2));
  });

  it("game.getExplorer follows real arrivals", () => {
    const { game, advance } = makeGame();
    game.state = { ...game.state, explored: exploredWith(48) };
    const target = dockInAnotherSystem(game.currentSystemId());
    game.freeTravel(target.dockId);
    advance(tripSeconds(target.ly) * 1000);
    game.update();
    expect(game.getExplorer().rankName).toBe("Cartographer");
    expect(game.lastFreeArrival?.explorerRankUp?.rankName).toBe("Cartographer");
  });

  it("never changes the job ranks or job pay", () => {
    const { game } = makeGame();
    game.state = { ...game.state, explored: exploredWith(200) };
    expect(game.getRanks().map((r) => r.rankNumber)).toEqual([1, 1, 1]);
    const plain = makeGame().game.getBoard().map((e) => e.job.reward);
    expect(game.getBoard().map((e) => e.job.reward)).toEqual(plain);
  });
});

describe("the save", () => {
  it("an old save (no new fields) loads: docked, nothing explored, no trip", () => {
    const old = { ...newGameState(startDockOf(SEED).id) } as Partial<GameState> & { currentDockId: string };
    delete old.spacePlanetId;
    delete old.freeTrip;
    delete old.explored;
    const state = normalizeState(old);
    expect(state.spacePlanetId).toBeNull();
    expect(state.freeTrip).toBeNull();
    expect(state.explored).toEqual({});
  });

  it("a save made BEFORE stage F1 (the new fields missing) loads through the whole path without crashing", () => {
    // This is exactly what every existing player has in the browser. (A first version of F1 crashed here.)
    const start = startDockOf(SEED).id;
    const raw: Record<string, unknown> = { ...newGameState(start), credits: 4321 };
    delete raw.spacePlanetId;
    delete raw.freeTrip;
    delete raw.explored;
    const rawState = raw as unknown as GameState;
    expect(() => fitToUniverse(rawState, SEED, start)).not.toThrow();
    const save: SaveData = { version: 1, seed: SEED, savedAtRealMs: 1, gameNowMs: 1, universeVersion: 2, state: rawState };
    const { game } = makeGame();
    expect(() => loadIntoGame(game, save, rawState, start, 1)).not.toThrow();
    expect(game.state.credits).toBe(4321);
    expect(game.state.spacePlanetId).toBeNull();
    expect(game.state.freeTrip).toBeNull();
    expect(game.state.explored).toEqual({});
    expect(game.getBoard().length).toBe(6);
    // the same with explicit nulls and with wrong types in those fields
    for (const bad of [null, 7, {}, []]) {
      const odd = { ...raw, spacePlanetId: bad, freeTrip: bad } as unknown as GameState;
      expect(() => fitToUniverse(odd, SEED, start)).not.toThrow();
      expect(() => makeGame().game.loadState(odd)).not.toThrow();
    }
    // and through planStart (the real start path) with the old save in storage
    const storage = new Map<string, string>();
    const fake = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v), removeItem: (k: string) => void storage.delete(k) };
    fake.setItem("lazy-freight.save", JSON.stringify(save));
    expect(readSave(fake).kind).toBe("ok");
  });

  it("garbage in the new fields is repaired, never a crash", () => {
    const base = newGameState(startDockOf(SEED).id);
    const bad = normalizeState({
      ...base,
      spacePlanetId: 42 as unknown as string,
      freeTrip: { fromId: 1, toId: "", distanceLy: -4 } as unknown as GameState["freeTrip"],
      explored: { ok: 5, zero: 0, neg: -3, text: "x", nan: NaN, big: 99999, "": 3 } as unknown as Record<string, number>,
      travelStartMs: 1,
      travelEndMs: 2,
    });
    expect(bad.spacePlanetId).toBeNull();
    expect(bad.freeTrip).toBeNull();
    expect(bad.travelStartMs).toBeNull(); // no valid job or trip, so no times
    expect(Object.keys(bad.explored).sort()).toEqual(["big", "ok"]);
    expect(bad.explored.ok).toBe(5);
    expect(bad.explored.big).toBe(99999 & 1023);
    expect(normalizeState({ ...base, explored: [1, 2] as unknown as Record<string, number> }).explored).toEqual({});
    expect(normalizeState({ ...base, explored: null as unknown as Record<string, number> }).explored).toEqual({});
  });

  it("the explored list stays small: capped, and tiny per system", () => {
    const many: Record<string, number> = {};
    for (let i = 0; i < MAX_EXPLORED_SYSTEMS + 50; i++) many[`${i}:0:0:0`] = 1023;
    expect(Object.keys(cleanExplored(many)).length).toBe(MAX_EXPLORED_SYSTEMS);
    // a full list is well under 1 MB in the save
    const full = cleanExplored(many);
    expect(JSON.stringify(full).length).toBeLessThan(700_000);
    // 1,000 real-looking systems are about 24 KB
    const thousand: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) thousand[`${i}:-3:7:2`] = 0b1011;
    expect(JSON.stringify(thousand).length).toBeLessThan(30_000);
    // at the cap, a NEW system is not recorded (and pays nothing); a planet of a known one still is
    const atCap = recordArrival(full, "999999:0:0:0/0", () => 75);
    expect(atCap.explored).toBe(full);
    expect(atCap.discovery.credits).toBe(0);
  });

  it("save and load in the middle of a free trip: the trip continues and pays discovery once", () => {
    const a = makeGame();
    const target = dockInAnotherSystem(a.game.currentSystemId());
    a.game.freeTravel(target.dockId);
    a.advance(5_000);
    const save: SaveData = JSON.parse(JSON.stringify(makeSaveData(SEED, a.game.state, a.now(), 5_000_000)));
    const b = makeGame();
    loadIntoGame(b.game, save, save.state as GameState, startDockOf(SEED).id, 5_000_000 + 60_000);
    expect(b.game.state.freeTrip?.toId).toBe(target.dockId);
    expect(b.game.progress()).not.toBeNull();
    const credits = b.game.state.credits;
    b.advance(tripSeconds(target.ly) * 1000);
    b.game.update();
    expect(b.game.state.currentDockId).toBe(target.dockId);
    expect(b.game.state.credits).toBe(credits + discoveryBase(SEED, target.systemId));
    b.game.update();
    expect(b.game.state.credits).toBe(credits + discoveryBase(SEED, target.systemId)); // not twice
  });

  it("floating at a planet is saved and loaded; a place that does not exist sends you back to your dock", () => {
    const { planet, dockId } = systemWithScenery();
    const a = makeGame(dockId);
    a.game.freeTravel(planet.id);
    a.advance(20_000);
    a.game.update();
    const save: SaveData = JSON.parse(JSON.stringify(makeSaveData(SEED, a.game.state, a.now(), 1)));
    const b = makeGame();
    loadIntoGame(b.game, save, save.state as GameState, startDockOf(SEED).id, 1);
    expect(b.game.state.spacePlanetId).toBe(planet.id);
    expect(b.game.currentSystemId()).toBe(planet.systemId);
    // a dock id is not a scenery planet, and a made-up id is nothing
    const base = newGameState(dockId);
    expect(fitToUniverse({ ...base, spacePlanetId: dockId }, SEED, dockId).spacePlanetId).toBeNull();
    expect(fitToUniverse({ ...base, spacePlanetId: "1:1:1:1/3" }, SEED, dockId).spacePlanetId).toBeNull();
    const c = makeGame();
    c.game.loadState({ ...base, spacePlanetId: "1:1:1:1/3" });
    expect(c.game.state.spacePlanetId).toBeNull();
  });

  it("a v1 save with a free trip or a float is moved to the start dock; explored is cleared; v2 saves are untouched", () => {
    const start = startDockOf(SEED).id;
    const { planet } = systemWithScenery();
    const v1 = (state: Partial<GameState>): SaveData => ({
      version: 1,
      seed: SEED,
      savedAtRealMs: 1,
      gameNowMs: 1,
      state: { ...newGameState(start), credits: 777, ...state } as GameState,
    });
    const floating = migrateSave(v1({ spacePlanetId: planet.id, explored: { "1:1:1:1": 3 } }));
    expect(floating.message).toBe(MESSAGE_REBUILT);
    expect(floating.data.state?.spacePlanetId).toBeNull();
    expect(floating.data.state?.explored).toEqual({});
    expect(floating.data.state?.currentDockId).toBe(start);
    expect(floating.data.state?.credits).toBe(777);
    const trip = migrateSave(
      v1({
        freeTrip: { fromId: start, toId: planet.id, distanceLy: 6 },
        travelStartMs: 10,
        travelEndMs: 20,
        fuel: 30,
      }),
    );
    expect(trip.data.state?.freeTrip).toBeNull();
    expect(trip.data.state?.travelEndMs).toBeNull();
    expect(trip.fuelBack).toBe(12); // 6 ly x 2 fuel, given back
    expect(trip.data.state?.fuel).toBe(42);
    const v2: SaveData = { ...v1({ spacePlanetId: planet.id, explored: { "1:1:1:1": 3 } }), universeVersion: 2 };
    const same = migrateSave(v2);
    expect(same.data).toBe(v2);
    expect(same.message).toBeNull();
  });
});

describe("the same things still work as before", () => {
  it("refuel, accept and the board work while docked, and a fresh game has the new fields empty", () => {
    const { game } = makeGame();
    expect(game.state.spacePlanetId).toBeNull();
    expect(game.state.freeTrip).toBeNull();
    expect(game.state.explored).toEqual({});
    expect(game.getExplorer()).toMatchObject({ systems: 0, planets: 0, discoveries: 0, rankNumber: 1, rankName: "Lost in Space" });
    expect(game.whyNotDocked()).toBeNull();
    game.state = { ...game.state, fuel: 10 };
    expect(game.refuel().ok).toBe(true);
    expect(game.getBoard().length).toBe(6);
  });

  it("a ship upgrade and a ship purchase work docked (not blocked by the new rules)", () => {
    const { game } = makeGame();
    game.state = { ...game.state, credits: 100000 };
    expect(game.buyUpgrade("cargo-hauler", "tank").ok).toBe(true);
    expect(game.buyShip("scout").ok).toBe(true);
  });
});

describe("the explorer simulator (real rules, no jobs)", () => {
  it("explores without ever being stranded, earns discovery credits and reaches rank 2 within a few hours", () => {
    for (const style of ["docks", "all"] as const) {
      const r = simulateExplorer(SEED, style, 4);
      expect(r.gaveUp).toBe(0);
      expect(r.systems).toBeGreaterThan(20);
      expect(r.discoveryEarned).toBeGreaterThan(1000);
      expect(r.rankHours[0]).not.toBeNull();
      expect(r.rankHours[0] as number).toBeLessThan(4);
      expect(r.creditsEnd).toBeGreaterThan(200); // exploring pays for its own fuel
    }
  });
});
