import { describe, expect, it } from "vitest";
import {
  Game,
  OUTPOST_REFUND_ESTIMATE,
  checkJob,
  createClock,
  newGameState,
  normalizeState,
  tripFuelCost,
  type GameState,
} from "../src/game";
import {
  MESSAGE_REBUILT,
  SAVE_KEY,
  fitToUniverse,
  makeSaveData,
  migrateSave,
  planStart,
  readSave,
  startAutoSave,
  universeVersionOf,
  writeSave,
  type SaveData,
  type StorageLike,
} from "../src/save";
import {
  UNIVERSE_VERSION,
  distanceBetweenDocks,
  docksOf,
  generateJobBoard,
  getDock,
  getJobBoard,
  getPlanetsOfSystem,
  listSystemsNear,
  startDockOf,
  type Job,
} from "../src/universe";

const SEED = 12345;
const ORIGIN = { x: 0, y: 0, z: 0 };

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.has(k) ? (this.data.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
}

/** A real job from this universe that the starter ship can fly (so a v1 save can hold it in flight). */
function someJob(): Job {
  for (const system of listSystemsNear(SEED, ORIGIN, 40).slice(0, 12)) {
    for (const dock of docksOf(SEED, system)) {
      const job = getJobBoard(SEED, dock.id, 0)?.find((j) => j.kind === "TRADE" && j.amount <= 30);
      if (job) return job;
    }
  }
  throw new Error("no job found");
}

/** Two real outposts (any two docks of kind OUTPOST). */
function twoOutposts(): string[] {
  const ids: string[] = [];
  for (const system of listSystemsNear(SEED, ORIGIN, 40)) {
    for (const dock of docksOf(SEED, system)) {
      if (dock.kind === "OUTPOST" && ids.length < 2) ids.push(dock.id);
    }
  }
  return ids;
}

/** A save as universe version 1 wrote it: no universeVersion, old dock ids, a job in flight, two outposts. */
function version1Save(patch: Partial<GameState> = {}): SaveData {
  const job = someJob();
  const [a, b] = twoOutposts() as [string, string];
  const state: GameState = {
    ...newGameState("3:-2:5:0/6"), // a dock id of the OLD universe
    credits: 4321,
    fuel: 20,
    shipId: "scout",
    ownedShips: { "cargo-hauler": { fuel: 33 } },
    shipUpgrades: { scout: { tank: 2, hold: 0, engines: 1, comfort: 0 } },
    completedJobs: { TRADE: 7, PASSENGER: 2, TOUR: 0 },
    ownedOutposts: [a, b],
    outpostCount: 2,
    currentJob: job,
    travelStartMs: 1000,
    travelEndMs: 5_000_000,
    deliveredJobIds: ["old-1", "old-2"],
    ...patch,
  };
  const data = makeSaveData(SEED, state, 9000, 9000);
  const { universeVersion: _drop, ...v1 } = data; // version 1 saves have no such field
  void _drop;
  return v1;
}

describe("startDockOf", () => {
  it("is a real dock, the same every time, and the first dock of the start system", () => {
    for (const seed of [SEED, 999, 1, 42, 31337]) {
      const a = startDockOf(seed);
      expect(getDock(seed, a.id)).not.toBeNull();
      expect(startDockOf(seed).id).toBe(a.id);
      const system = listSystemsNear(seed, ORIGIN, 320)[0]!;
      expect(a.systemId).toBe(system.id);
      expect(a.id).toBe(docksOf(seed, system)[0]!.id);
    }
  });

  it("gives a new player a full board of 6 jobs, with a job to take on the default seed", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const game = new Game(seed, startDockOf(seed).id, createClock(1, () => 40 * 3_600_000));
      expect(game.getBoard().length).toBe(6);
    }
    const game = new Game(SEED, startDockOf(SEED).id, createClock(1, () => 40 * 3_600_000));
    expect(game.getBoard().some((e) => e.block === null)).toBe(true);
  });

  it("most seeds give a new Cargo Hauler player something to take at the start (the old universe: 28 in 300 did not)", () => {
    let none = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const game = new Game(seed, startDockOf(seed).id, createClock(1, () => 40 * 3_600_000));
      if (!game.getBoard().some((e) => e.block === null)) none++;
    }
    expect(none).toBeLessThanOrEqual(12); // measured: about 7 in 100 (universe v1: about 9 in 100)
  });
});

describe("docks only", () => {
  it("jobs start and end at real docks, for many seeds", () => {
    let checked = 0;
    for (const seed of [SEED, 7, 99, 2024]) {
      for (const system of listSystemsNear(seed, ORIGIN, 25).slice(0, 12)) {
        for (const dock of docksOf(seed, system)) {
          for (const job of generateJobBoard(seed, dock, 0)) {
            expect(getDock(seed, job.originDockId)).not.toBeNull();
            expect(getDock(seed, job.destinationDockId)).not.toBeNull();
            for (const stop of job.stops ?? []) expect(getDock(seed, stop)).not.toBeNull();
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("a system with one dock works: board, accept, arrive, paid", () => {
    const single = listSystemsNear(SEED, ORIGIN, 40).find((s) => docksOf(SEED, s).length === 1 && s.planetCount > 1);
    expect(single).toBeDefined();
    if (!single) return;
    const dock = docksOf(SEED, single)[0]!;
    let real = 40 * 3_600_000;
    const game = new Game(SEED, dock.id, createClock(1, () => real));
    game.state = { ...game.state, completedJobs: { TRADE: 99, PASSENGER: 99, TOUR: 99 } };
    const entry = game.getBoard().find((e) => e.block === null);
    expect(entry).toBeDefined();
    if (!entry) return;
    expect(entry.job.destinationDockId).not.toBe(dock.id); // one dock: nothing to deliver to in the same system
    expect(game.accept(entry.job.id).ok).toBe(true);
    real += 5 * 3_600_000;
    const arrival = game.update();
    expect(arrival).not.toBeNull();
    expect(game.state.currentDockId).toBe(entry.job.destinationDockId);
    expect(game.state.credits).toBeGreaterThan(200 - entry.fuelNeeded);
  });

  it("planets without a dock have no board and no distance", () => {
    for (const system of listSystemsNear(SEED, ORIGIN, 30).slice(0, 10)) {
      const dockIds = new Set(docksOf(SEED, system).map((d) => d.id));
      for (const planet of getPlanetsOfSystem(SEED, system.id)) {
        if (dockIds.has(planet.id)) continue;
        expect(getDock(SEED, planet.id)).toBeNull();
        expect(getJobBoard(SEED, planet.id, 0)).toBeNull();
        expect(distanceBetweenDocks(SEED, planet.id, startDockOf(SEED).id)).toBeNull();
      }
    }
  });

  it("a save sitting on a planet without a dock is moved to the start dock", () => {
    const system = listSystemsNear(SEED, ORIGIN, 40).find((s) => s.planetCount > docksOf(SEED, s).length)!;
    const dockIds = new Set(docksOf(SEED, system).map((d) => d.id));
    const noDock = getPlanetsOfSystem(SEED, system.id).find((p) => !dockIds.has(p.id))!;
    const fitted = fitToUniverse(newGameState(noDock.id), SEED, startDockOf(SEED).id);
    expect(fitted.currentDockId).toBe(startDockOf(SEED).id);
  });
});

describe("outposts remember the price paid", () => {
  it("buyOutpost stores the price, and it survives load and the Game", () => {
    const outpost = twoOutposts()[0]!;
    const g = new Game(SEED, outpost, createClock(1, () => 0));
    g.state = { ...g.state, credits: 999_999 };
    const price = g.getOutpostOffer(outpost).price!;
    expect(g.buyOutpost(outpost).ok).toBe(true);
    expect(g.state.outpostPrices[outpost]).toBe(price);
    const copy = new Game(SEED, outpost, createClock(1, () => 0));
    copy.loadState(JSON.parse(JSON.stringify(g.state)));
    expect(copy.state.outpostPrices).toEqual({ [outpost]: price });
  });

  it("repairs bad prices and drops prices of outposts you do not own", () => {
    const s = normalizeState({
      currentDockId: "a/0",
      ownedOutposts: ["a/1"],
      outpostPrices: { "a/1": 1234.6, "a/2": 500 },
    } as unknown as Partial<GameState> & { currentDockId: string });
    expect(s.outpostPrices).toEqual({ "a/1": 1235 });
    const bad = normalizeState({ currentDockId: "a/0", ownedOutposts: ["a/1"], outpostPrices: { "a/1": -5 } } as unknown as Partial<GameState> & { currentDockId: string });
    expect(bad.outpostPrices).toEqual({});
  });
});

describe("old saves: move + refund", () => {
  it("a save without universeVersion counts as version 1; new saves are the current version", () => {
    expect(universeVersionOf(version1Save())).toBe(1);
    expect(makeSaveData(SEED, newGameState("x/0"), 0, 0).universeVersion).toBe(UNIVERSE_VERSION);
  });

  it("moves a v1 save with a job in flight and 2 outposts, keeping progress", () => {
    const old = version1Save();
    const before = old.state!;
    const m = migrateSave(old);
    const s = m.data.state!;
    expect(m.data.universeVersion).toBe(UNIVERSE_VERSION);
    expect(m.message).toContain(MESSAGE_REBUILT);
    // moved, job cancelled, outposts gone, list cleared
    expect(s.currentDockId).toBe(startDockOf(SEED).id);
    expect(s.currentJob).toBeNull();
    expect(s.travelStartMs).toBeNull();
    expect(s.travelEndMs).toBeNull();
    expect(s.ownedOutposts).toEqual([]);
    expect(s.outpostCount).toBe(0);
    expect(s.outpostPrices).toEqual({});
    expect(s.deliveredJobIds).toEqual([]);
    // refunded at the flat estimate (these old saves stored no price)
    expect(m.refund).toBe(2 * OUTPOST_REFUND_ESTIMATE);
    expect(s.credits).toBe(before.credits + 2 * OUTPOST_REFUND_ESTIMATE);
    expect(m.data.state!.credits).toBe(4321 + 40000);
    // kept: ships, upgrades, ranks
    expect(s.shipId).toBe("scout");
    expect(s.ownedShips).toEqual(before.ownedShips);
    expect(s.shipUpgrades["scout"]).toEqual({ tank: 2, hold: 0, engines: 1, comfort: 0 });
    expect(s.completedJobs).toEqual({ TRADE: 7, PASSENGER: 2, TOUR: 0 });
    // the cancelled trip gives its fuel back (no penalty)
    expect(m.fuelBack).toBe(tripFuelCost(normalizeState(before), before.currentJob!.totalDistance));
    expect(s.fuel).toBeGreaterThan(before.fuel);
    // seed and times of the save are untouched
    expect(m.data.seed).toBe(SEED);
    expect(m.data.savedAtRealMs).toBe(old.savedAtRealMs);
    // and the original object was not changed
    expect(old.state!.credits).toBe(4321);
    expect(old.state!.currentJob).not.toBeNull();
  });

  it("refunds the stored price when the save has one", () => {
    const [a, b] = twoOutposts() as [string, string];
    const old = version1Save({ outpostPrices: { [a]: 7000 } });
    const m = migrateSave(old);
    expect(m.refund).toBe(7000 + OUTPOST_REFUND_ESTIMATE);
    expect(b).toBeDefined();
  });

  it("never fills the tank above its size", () => {
    const m = migrateSave(version1Save({ fuel: 110 }));
    expect(m.data.state!.fuel).toBeLessThanOrEqual(132);
  });

  it("a save with no job and no outposts still gets moved and the message, without the refund sentence", () => {
    const m = migrateSave(version1Save({ currentJob: null, travelStartMs: null, travelEndMs: null, ownedOutposts: [], outpostCount: 0 }));
    expect(m.message).toBe(MESSAGE_REBUILT);
    expect(m.refund).toBe(0);
    expect(m.fuelBack).toBe(0);
  });

  it("a version 2 save is left untouched (same object)", () => {
    const current = makeSaveData(SEED, newGameState(startDockOf(SEED).id), 5, 5);
    const m = migrateSave(current);
    expect(m.data).toBe(current);
    expect(m.message).toBeNull();
  });

  it("a v1 save that held no progress is just stamped, with no message", () => {
    const m = migrateSave({ version: 1, seed: SEED, savedAtRealMs: 1, gameNowMs: 1, state: null });
    expect(m.data.universeVersion).toBe(UNIVERSE_VERSION);
    expect(m.message).toBeNull();
  });

  it("the moved game works: board, accept", () => {
    const m = migrateSave(version1Save());
    const game = new Game(SEED, startDockOf(SEED).id, createClock(1, () => 40 * 3_600_000));
    game.loadState(m.data.state!);
    expect(game.getBoard().length).toBe(6);
    expect(game.getShipStats().fuelTankSize).toBeGreaterThan(110);
  });
});

describe("old saves: through planStart (the real load path)", () => {
  it("moves the save once: message the first time, written back, nothing the second time", () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify(version1Save()));
    const first = planStart("", storage, SEED);
    expect(first.why).toBe("continue");
    expect(first.notice).toContain(MESSAGE_REBUILT);
    expect(first.state?.currentDockId).toBe(startDockOf(SEED).id);
    const stored = readSave(storage);
    expect(stored.kind === "ok" && stored.data.universeVersion).toBe(UNIVERSE_VERSION);
    const second = planStart("", storage, SEED);
    expect(second.why).toBe("continue");
    expect(second.notice).toBeNull();
    expect(second.state).toEqual(first.state);
  });

  it("a version 2 save loads untouched, with no message", () => {
    const storage = new MemoryStorage();
    const state: GameState = { ...newGameState(startDockOf(SEED).id), credits: 777 };
    writeSave(storage, makeSaveData(SEED, state, 0, 0));
    const before = storage.getItem(SAVE_KEY);
    const plan = planStart("", storage, SEED);
    expect(plan.notice).toBeNull();
    expect(plan.state).toEqual(state);
    expect(storage.getItem(SAVE_KEY)).toBe(before);
  });

  it("the autosaver after a move keeps the new version", () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify(version1Save()));
    const plan = planStart("", storage, SEED);
    const game = new Game(plan.seed, startDockOf(plan.seed).id, createClock(1, () => 0));
    game.loadState(plan.state!);
    startAutoSave(game, storage, null);
    const stored = readSave(storage);
    expect(stored.kind === "ok" && stored.data.universeVersion).toBe(UNIVERSE_VERSION);
  });

  it("garbage never crashes: bad JSON, odd shapes, bad universeVersion", () => {
    const cases = [
      "not json {{{",
      "null",
      "42",
      JSON.stringify({ version: 1 }),
      JSON.stringify({ version: 1, seed: SEED, savedAtRealMs: 1, gameNowMs: 1, universeVersion: "two", state: null }),
      JSON.stringify({ version: 1, seed: SEED, savedAtRealMs: 1, gameNowMs: 1, universeVersion: 0, state: null }),
      JSON.stringify({ version: 1, seed: SEED, savedAtRealMs: 1, gameNowMs: 1, state: { currentDockId: "" } }),
    ];
    for (const text of cases) {
      const storage = new MemoryStorage();
      storage.setItem(SAVE_KEY, text);
      const plan = planStart("", storage, SEED);
      expect(plan.why).toBe("bad-save");
      expect(plan.state).toBeNull();
    }
  });

  it("a v1 save with damaged contents is repaired while it moves", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({ version: 1, seed: SEED, savedAtRealMs: 1, gameNowMs: 1, state: { currentDockId: "x/9", credits: "lots", ownedOutposts: [5, null, "q/1"], currentJob: { nope: true } } }),
    );
    const plan = planStart("", storage, SEED);
    expect(plan.why).toBe("continue");
    expect(plan.state?.currentDockId).toBe(startDockOf(SEED).id);
    expect(plan.state?.ownedOutposts).toEqual([]);
    expect(plan.state?.credits).toBe(200 + OUTPOST_REFUND_ESTIMATE); // credits repaired to the start amount, one outpost id refunded
  });
});

describe("determinism", () => {
  it("the same old save moves to the same result", () => {
    expect(migrateSave(version1Save())).toEqual(migrateSave(version1Save()));
  });

  it("checkJob on the moved state does not mention a missing dock", () => {
    const m = migrateSave(version1Save());
    const game = new Game(SEED, startDockOf(SEED).id, createClock(1, () => 40 * 3_600_000));
    game.loadState(m.data.state!);
    for (const e of game.getBoard()) expect(checkJob(game.state, e.job)?.code).not.toBe("wrong-dock");
  });
});
