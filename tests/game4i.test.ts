// Stage G4 (Agent 4): the game and save layers on universe v3 (the spiral galaxy).
// Reach cards, the board summary, the place info, the nearby lists, the reward curve, the first hour at the start dock,
// the explored cap, and moving REAL old saves (made by main's code, tests/fixtures/old-saves) through the WHOLE load path.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  Game,
  MAX_EXPLORED_SYSTEMS,
  checkJob,
  cleanExplored,
  createClock,
  newGameState,
  normalizeState,
  rangeForFuel,
  reachOf,
  recordArrival,
  tripFuelCost,
  type GameState,
} from "../src/game";
import {
  MESSAGE_REBUILT,
  SAVE_KEY,
  applyImport,
  exportSaveFile,
  fitToUniverse,
  hasLegacyIds,
  loadIntoGame,
  makeSaveData,
  migrateSave,
  planStart,
  readSave,
  type SaveData,
  type StorageLike,
} from "../src/save";
import {
  REWARD_FULL_PAY_LY,
  START_POINT,
  UNIVERSE_VERSION,
  WORLD_SEED,
  findDockById,
  getJobBoard,
  isLegacyId,
  nearestDocks,
  nearestSystems,
  paidDistance,
  startDockOf,
  type Vec3,
} from "../src/universe";

const SEED = WORLD_SEED;
const RIM: Vec3 = { x: 49000, y: 0, z: 0 };

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  writes = 0;
  getItem(k: string): string | null {
    return this.data.has(k) ? (this.data.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.writes++;
    this.data.set(k, v);
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
}

function makeGame(dockId: string = startDockOf(SEED).id) {
  let t = 1_000_000_000;
  const game = new Game(SEED, dockId, createClock(1, () => t));
  return { game, advance: (ms: number) => void (t += ms), now: () => t };
}

/** The first dock near `centre` whose board a new Cargo Hauler cannot use at all. */
function deadBoardDockNear(centre: Vec3): string {
  for (const d of nearestDocks(SEED, centre, 40)) {
    const st = newGameState(d.dockId);
    const jobs = getJobBoard(SEED, d.dockId, 0) ?? [];
    if (jobs.length > 0 && jobs.every((j) => checkJob(st, j) !== null && reachOf(st, j.totalDistance).reach !== "now")) return d.dockId;
  }
  throw new Error("no dead board near that place");
}

const takeable = (dockId: string, slot: number) => (getJobBoard(SEED, dockId, slot) ?? []).filter((j) => checkJob(newGameState(dockId), j) === null);

// ------------------------------------------------------------------ ids

describe("ids in the game", () => {
  it("system ids are numbers, dock and job ids are text", () => {
    const { game } = makeGame();
    expect(startDockOf(SEED).id).toBe("44776692551/2");
    expect(game.currentSystemId()).toBe(44776692551);
    expect(typeof game.currentSystemId()).toBe("number");
    expect(game.currentSystemName()).toBe("Bimvik Deep JR62R-MT37");
    const entry = game.getBoard()[0];
    expect(typeof entry?.job.id).toBe("string");
    expect(typeof entry?.job.destinationDockId).toBe("string");
  });

  it("old-shape ids match nothing: free travel says there is no such place, never a crash", () => {
    const { game } = makeGame();
    for (const id of ["3:-2:5:0/2", "3:-2:5:0", "", "x", "12/99", "44776692551/99"]) {
      const r = game.canFreeTravel(id);
      expect(r.ok).toBe(false);
      expect(game.freeTravel(id).ok).toBe(false);
    }
    expect(isLegacyId("3:-2:5:0/2")).toBe(true);
    expect(isLegacyId("44776692551/2")).toBe(false);
  });

  it("the explored list is keyed by the system number written as digits", () => {
    const place = nearestDocks(SEED, START_POINT, 3)[1]!;
    const r = recordArrival({}, place.dockId, (id) => id % 50 + 50);
    expect(Object.keys(r.explored)).toEqual([String(place.systemId)]);
    expect(r.discovery.newSystem).toBe(true);
  });
});

// ------------------------------------------------------------------ reach on the cards

describe("job cards say whether the ship can do them", () => {
  it("every card has a reach and a sentence; 'now' when the fuel is there", () => {
    const { game } = makeGame();
    const board = game.getBoard();
    expect(board.length).toBe(6);
    for (const e of board) {
      expect(["now", "refuel", "never"]).toContain(e.reach);
      expect(e.reachText.length).toBeGreaterThan(5);
      if (e.reach === "now") expect(e.fuelNeeded).toBeLessThanOrEqual(game.state.fuel);
    }
  });

  it("with too little fuel a card that fits the tank says 'refuel'; with a long trip it says 'never'", () => {
    const low = { ...newGameState(startDockOf(SEED).id), fuel: 2 };
    expect(reachOf(low, 20)).toMatchObject({ reach: "refuel", fuelNeeded: 40 });
    expect(reachOf(low, 20).text).toBe("Needs 40 fuel, you have 2. Refuel first.");
    expect(reachOf(low, 31)).toMatchObject({ reach: "never" });
    expect(reachOf(low, 31).text).toBe("Too far for this ship: needs 62 fuel, the tank holds 60.");
    expect(reachOf(newGameState("x"), 5)).toMatchObject({ reach: "now", fuelNeeded: 10 });
    const { game } = makeGame();
    game.state = { ...game.state, fuel: 2 };
    const refuelCards = game.getBoard().filter((e) => e.reach === "refuel");
    for (const e of refuelCards) expect(e.block?.code === "not-enough-fuel" || e.block !== null).toBe(true);
  });

  it("the range is whole light years and matches the fuel rule", () => {
    const st = newGameState("x");
    expect(rangeForFuel(st, 60)).toBe(30);
    expect(rangeForFuel(st, 61)).toBe(30);
    expect(rangeForFuel(st, 1)).toBe(0);
    expect(rangeForFuel(st, 0)).toBe(0);
    for (const fuel of [1, 2, 7, 33, 60, 100]) {
      const d = rangeForFuel(st, fuel);
      expect(tripFuelCost(st, d)).toBeLessThanOrEqual(Math.max(fuel, 1));
      expect(tripFuelCost(st, d + 1)).toBeGreaterThan(fuel);
    }
  });
});

describe("the board summary and the place info", () => {
  it("at the start dock: something can be taken, no message", () => {
    const { game } = makeGame();
    const s = game.getBoardSummary();
    expect(s.total).toBe(6);
    expect(s.doNow).toBeGreaterThanOrEqual(2);
    expect(s.message).toBeNull();
    const info = game.getPlaceInfo();
    expect(info).toMatchObject({ systemId: 44776692551, systemName: "Bimvik Deep JR62R-MT37", isDocked: true, rangeLy: 30, fuelRangeLy: 30, isRemote: false, remoteMessage: null });
    expect(info.nearestOtherDock?.distanceLy).toBeGreaterThan(2);
    expect(info.nearestOtherDock?.distanceLy).toBeLessThan(13);
    expect(info.nearestOtherDock?.systemId).not.toBe(info.systemId);
  });

  it("a far dock (rim): the board is not empty, every card says why, and a plain message appears; nothing throws", () => {
    const dock = deadBoardDockNear(RIM);
    const { game } = makeGame(dock);
    const board = game.getBoard();
    expect(board.length).toBe(6);
    expect(board.every((e) => e.reach === "never" || e.block !== null)).toBe(true);
    const s = game.getBoardSummary();
    expect(s.doNow + s.afterRefuel).toBe(0);
    expect(typeof s.message).toBe("string");
    const info = game.getPlaceInfo();
    expect(info.isRemote).toBe(true);
    expect(info.remoteMessage).toContain("ly away");
    expect(info.nearestOtherDock?.distanceLy).toBeGreaterThan(info.rangeLy);
    expect(game.nearbySystems(20).length).toBe(20);
    expect(game.nearbyDocks(5).length).toBe(5);
    // free travel anywhere is refused with a sentence, not a crash
    const far = game.nearbyDocks(3)[2]!;
    const r = game.canFreeTravel(far.dockId);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.length).toBeGreaterThan(10);
    expect(game.isStuck()).toBeDefined();
  });

  it("no message while flying or floating, and an empty board is explained", () => {
    const { game } = makeGame();
    const e = game.getBoard().find((x) => !x.block)!;
    expect(game.accept(e.job.id).ok).toBe(true);
    expect(game.getBoard()).toEqual([]);
    expect(game.getBoardSummary()).toMatchObject({ total: 0, doNow: 0, message: null });
    expect(game.getPlaceInfo().isDocked).toBe(false);
  });
});

describe("nearby lists for the map", () => {
  it("systems: the nearest N around you, your own first, nearest first, a smaller count is a prefix", () => {
    const { game } = makeGame();
    const a = game.nearbySystems(40);
    expect(a.length).toBe(40);
    expect(a[0]?.system.id).toBe(game.currentSystemId());
    expect(a[0]?.distance).toBe(0);
    for (let i = 1; i < a.length; i++) expect(a[i]!.distance).toBeGreaterThanOrEqual(a[i - 1]!.distance);
    const b = game.nearbySystems(10);
    expect(b.map((x) => x.system.id)).toEqual(a.slice(0, 10).map((x) => x.system.id));
    expect(game.nearbySystems(40).map((x) => x.system.id)).toEqual(a.map((x) => x.system.id));
    expect(typeof a[0]?.system.id).toBe("number");
  });

  it("docks: nearest first with text dock ids; 0 gives nothing", () => {
    const { game } = makeGame();
    const docks = game.nearbyDocks(12);
    expect(docks.length).toBe(12);
    for (let i = 1; i < docks.length; i++) expect(docks[i]!.distance).toBeGreaterThanOrEqual(docks[i - 1]!.distance);
    expect(docks.every((d) => typeof d.dockId === "string" && d.dockId.includes("/"))).toBe(true);
    expect(game.nearbyDocks(0)).toEqual([]);
  });

  it("the position follows the player (a free trip moves the lists)", () => {
    const { game, advance } = makeGame();
    const before = game.nearbySystems(5).map((x) => x.system.id);
    const target = game.nearbyDocks(12).find((d) => game.canFreeTravel(d.dockId).ok && d.systemId !== game.currentSystemId());
    expect(target).toBeDefined();
    expect(game.freeTravel(target!.dockId).ok).toBe(true);
    advance(3 * 3_600_000);
    game.update();
    expect(game.currentSystemId()).toBe(target!.systemId);
    expect(game.nearbySystems(5)[0]?.system.id).toBe(target!.systemId);
    expect(game.nearbySystems(5).map((x) => x.system.id)).not.toEqual(before);
  });
});

// ------------------------------------------------------------------ the reward curve

describe("the reward curve (long trips pay less per light year)", () => {
  it("is the straight line up to 50 ly, then a square root that joins smoothly", () => {
    expect(REWARD_FULL_PAY_LY).toBe(50);
    for (const d of [0, 0.5, 1, 5, 10, 25, 35, 50]) expect(paidDistance(d)).toBeCloseTo(Math.max(d, 1), 9);
    expect(paidDistance(100)).toBeCloseTo(50 * Math.sqrt(3), 6);
    expect(paidDistance(650)).toBeCloseTo(250, 6);
    // smooth at 50: the slope just after is almost 1
    expect((paidDistance(50.01) - paidDistance(50)) / 0.01).toBeGreaterThan(0.99);
    let last = 0;
    for (let d = 0; d <= 700; d += 5) {
      expect(paidDistance(d)).toBeGreaterThanOrEqual(last);
      last = paidDistance(d);
    }
    expect(paidDistance(650) / 650).toBeLessThan(0.4);
  });

  it("start boards pay as before (all trips there are under 50 ly); rim boards pay far less than the straight line", () => {
    // formula of a trade job before G4: amount * price * 0.25 + distance * amount * 0.6 + 30
    let checked = 0;
    for (const d of nearestDocks(SEED, RIM, 12)) {
      for (const j of getJobBoard(SEED, d.dockId, 0) ?? []) {
        if (j.kind !== "TRADE" || j.totalDistance < 130) continue;
        const straight = j.amount * (j.unitPriceAtDestination ?? 0) * 0.25 + j.totalDistance * j.amount * 0.6 + 30;
        expect(j.reward).toBeLessThan(straight * 0.9);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
    for (const d of nearestDocks(SEED, START_POINT, 12)) {
      for (const j of getJobBoard(SEED, d.dockId, 0) ?? []) {
        if (j.kind !== "TRADE" || j.totalDistance > 50) continue;
        const straight = j.amount * (j.unitPriceAtDestination ?? 0) * 0.25 + Math.max(j.totalDistance, 1) * j.amount * 0.6 + 30;
        expect(Math.abs(j.reward - straight)).toBeLessThan(1.5); // only the rounding
      }
    }
  });
});

// ------------------------------------------------------------------ the first hour at the start dock

describe("the first hour", () => {
  it("the start dock always has at least 2 jobs a new full-tank Hauler can take, in every time slot of a week", () => {
    const dock = startDockOf(SEED).id;
    for (let slot = 0; slot < 24 * 7; slot += 6) expect(takeable(dock, slot).length).toBeGreaterThanOrEqual(2);
  });

  it("a good first job exists: at least one takeable job leads to a dock that has something to take as well (no dead end)", () => {
    const dock = startDockOf(SEED).id;
    for (let slot = 0; slot < 24 * 7; slot += 6) {
      const ok = takeable(dock, slot).filter((job) => takeable(job.destinationDockId, slot).length >= 1);
      expect(ok.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("around the start, most boards are fine for a new player (measured share, see the report)", () => {
    const docks = nearestDocks(SEED, START_POINT, 600);
    let ge1 = 0;
    let ge2 = 0;
    for (const d of docks) {
      const n = takeable(d.dockId, 0).length;
      if (n >= 1) ge1++;
      if (n >= 2) ge2++;
    }
    expect(ge1 / docks.length).toBeGreaterThan(0.88);
    expect(ge2 / docks.length).toBeGreaterThan(0.68);
  });
});

// ------------------------------------------------------------------ the explored list

describe("the explored cap", () => {
  it("holds 100,000 systems, drops the rest, and the save text stays small and fast", () => {
    expect(MAX_EXPLORED_SYSTEMS).toBe(100000);
    const big: Record<string, number> = {};
    for (let i = 0; i < 100_000; i++) big[String(44_000_000_000 + i * 7919)] = (i % 7) + 1;
    const t0 = Date.now();
    const cleaned = cleanExplored({ ...big, "55555555555": 3 });
    expect(Object.keys(cleaned).length).toBe(100000);
    const state = normalizeState({ ...newGameState(startDockOf(SEED).id), explored: cleaned });
    const text = JSON.stringify(makeSaveData(SEED, state, 1, 2));
    expect(text.length).toBeLessThan(2_200_000);
    expect(Object.keys(JSON.parse(text).state.explored).length).toBe(100000);
    expect(Date.now() - t0).toBeLessThan(5000);
  });

  it("at the cap a new system is not recorded and pays nothing", () => {
    const full: Record<string, number> = {};
    for (let i = 0; i < MAX_EXPLORED_SYSTEMS; i++) full[String(i + 1)] = 1;
    const r = recordArrival(full, "44776692551/2", () => 80);
    expect(r.discovery.credits).toBe(0);
    expect(Object.keys(r.explored).length).toBe(MAX_EXPLORED_SYSTEMS);
  });
});

// ------------------------------------------------------------------ old saves

const fixture = (name: string): SaveData => JSON.parse(readFileSync(`tests/fixtures/old-saves/${name}.json`, "utf8")) as SaveData;

function pageLoad(storage: StorageLike) {
  const plan = planStart("", storage);
  const dock = startDockOf(plan.seed).id;
  const game = new Game(plan.seed, dock, createClock(1, () => 20_000));
  if (plan.state && plan.save) loadIntoGame(game, plan.save, plan.state, dock, Date.now());
  return { plan, game };
}
function storageWith(save: SaveData): MemoryStorage {
  const s = new MemoryStorage();
  s.data.set(SAVE_KEY, JSON.stringify(save));
  s.writes = 0;
  return s;
}

describe("real old saves (made by main's universe 2 code) move to universe 3", () => {
  const start = startDockOf(SEED).id;

  it("v2 with a job in flight, a Scout, upgrades, paint, ranks and two outposts", () => {
    const old = fixture("v2-job-in-flight");
    expect(old.universeVersion).toBe(2);
    expect(old.state?.currentJob).not.toBeNull();
    expect(hasLegacyIds(old.state)).toBe(true);
    const storage = storageWith(old);
    const { plan, game } = pageLoad(storage);
    expect(plan.why).toBe("continue");
    const oldState = normalizeState(old.state as GameState);
    const refund = 6400 + 20000; // one stored price, one estimate
    expect(plan.notice).toBe(`${MESSAGE_REBUILT} Your outposts were sold back for ${refund} credits.`);
    const s = game.state;
    expect(s.credits).toBe(oldState.credits + refund);
    expect(s.shipId).toBe("scout");
    expect(Object.keys(s.ownedShips)).toEqual(["cargo-hauler"]);
    expect(s.shipUpgrades.scout).toEqual({ tank: 1, hold: 0, engines: 2, comfort: 0 });
    expect(game.currentLivery("scout")).toBe("rescue-red");
    expect(s.completedJobs).toEqual({ TRADE: 14, PASSENGER: 3, TOUR: 1 });
    expect(s.currentJob).toBeNull();
    expect(s.freeTrip).toBeNull();
    expect(s.travelStartMs).toBeNull();
    expect(s.ownedOutposts).toEqual([]);
    expect(s.explored).toEqual({});
    expect(s.deliveredJobIds).toEqual([]);
    expect(s.currentDockId).toBe(start);
    expect(findDockById(SEED, s.currentDockId)).not.toBeNull();
    expect(game.getBoard().length).toBe(6);
    // the fuel of the cancelled trip came back (up to the tank)
    expect(s.fuel).toBeGreaterThan(oldState.fuel);
  });

  it("v2 with a free trip under way and 290 explored systems", () => {
    const old = fixture("v2-free-trip-explored");
    expect(old.state?.freeTrip).not.toBeNull();
    expect(Object.keys(old.state?.explored ?? {}).length).toBeGreaterThan(200);
    const { plan, game } = pageLoad(storageWith(old));
    expect(plan.notice).toBe(MESSAGE_REBUILT);
    expect(game.state.freeTrip).toBeNull();
    expect(game.state.explored).toEqual({});
    expect(game.state.credits).toBe(2500);
    expect(game.state.currentDockId).toBe(start);
    expect(game.getExplorer().discoveries).toBe(0);
  });

  it("v2 floating at a planet without a dock", () => {
    const old = fixture("v2-floating");
    expect(old.state?.spacePlanetId).not.toBeNull();
    const { game, plan } = pageLoad(storageWith(old));
    expect(plan.notice).toBe(MESSAGE_REBUILT);
    expect(game.state.spacePlanetId).toBeNull();
    expect(game.state.currentDockId).toBe(start);
    expect(game.whyNotDocked()).toBeNull();
  });

  it("v1 (no universe number, no ships, no paint, no explorer fields)", () => {
    const old = fixture("v1-plain");
    expect(old.universeVersion).toBeUndefined();
    const { game, plan } = pageLoad(storageWith(old));
    expect(plan.notice).toBe(MESSAGE_REBUILT);
    expect(game.state.credits).toBe(3456);
    expect(game.state.completedJobs.TRADE).toBe(5);
    expect(game.currentLivery("cargo-hauler")).toBe("standard");
    expect(game.getBoard().length).toBe(6);
  });

  it("two loads in a row: the message shows once, the second load changes nothing and writes nothing", () => {
    for (const name of ["v2-job-in-flight", "v2-free-trip-explored", "v1-plain"]) {
      const storage = storageWith(fixture(name));
      const first = pageLoad(storage);
      expect(first.plan.notice).toContain(MESSAGE_REBUILT);
      const stored = readSave(storage);
      expect(stored.kind === "ok" && stored.data.universeVersion).toBe(UNIVERSE_VERSION);
      expect(stored.kind === "ok" && stored.data.seed).toBe(SEED);
      const writes = storage.writes;
      const text = storage.getItem(SAVE_KEY);
      const second = pageLoad(storage);
      expect(second.plan.notice).toBeNull();
      expect(second.game.state.credits).toBe(first.game.state.credits);
      expect(storage.writes).toBe(writes);
      expect(storage.getItem(SAVE_KEY)).toBe(text);
    }
  });

  it("a save that says it is version 3 but still holds an old-shape id is moved too (second net)", () => {
    const old = { ...fixture("v2-job-in-flight"), universeVersion: UNIVERSE_VERSION };
    expect(hasLegacyIds(old.state)).toBe(true);
    const moved = migrateSave(old);
    expect(moved.message).toContain(MESSAGE_REBUILT);
    expect(hasLegacyIds(moved.data.state)).toBe(false);
  });

  it("a current save is untouched (same object)", () => {
    const state = { ...newGameState(start), credits: 999 };
    const data = makeSaveData(SEED, state, 1, 2);
    expect(migrateSave(data, SEED).data).toBe(data);
    expect(migrateSave(data).message).toBeNull();
  });

  it("a garbage dock id is not an old id: the load still lands at the start dock", () => {
    const state = { ...newGameState("garbage"), credits: 5 };
    expect(hasLegacyIds(state)).toBe(false);
    expect(fitToUniverse(state, SEED, start).currentDockId).toBe(start);
  });

  it("an imported FILE from universe 2 is moved the same way", () => {
    const source = storageWith(fixture("v2-job-in-flight"));
    const file = exportSaveFile(source, new Date(Date.UTC(2026, 10, 17)));
    if (!file.ok) throw new Error(file.reason);
    const target = new MemoryStorage();
    const r = applyImport(target, file.text, SEED);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings.length).toBeGreaterThan(0);
    const { plan, game } = pageLoad(target);
    expect(plan.notice).toContain(MESSAGE_REBUILT);
    expect(game.state.currentJob).toBeNull();
    expect(game.state.shipId).toBe("scout");
    expect(game.state.currentDockId).toBe(start);
  });

  it("system lookups of every old id are safe, even through loadState", () => {
    const { game } = pageLoad(storageWith(fixture("v2-floating")));
    for (const id of ["0:0:0:0/1", "-1:0:0:0/2", "0:2:0:1/4"]) {
      expect(game.placeName(id)).toBe("the place");
      expect(game.canFreeTravel(id).ok).toBe(false);
    }
    const raw = fixture("v2-job-in-flight").state as GameState;
    expect(() => game.loadState(raw)).not.toThrow();
  });

  it("nearestSystems is cheap enough to ask for the map each move", () => {
    const t0 = Date.now();
    expect(nearestSystems(SEED, START_POINT, 2000).length).toBe(2000);
    expect(Date.now() - t0).toBeLessThan(3000);
  });
});
