// Stage N2 (Agent 4): one shared world seed. ?seed= works only with ?dev=1; a save from another seed is carried
// over ("move + refund") through the WHOLE start path; NEW GAME starts the world seed again.
// Every case below goes through planStart -> new Game -> loadIntoGame, like a real page load (the F1 crash lesson).
import { describe, expect, it } from "vitest";
import {
  Game,
  OUTPOST_REFUND_ESTIMATE,
  createClock,
  newGameState,
  normalizeState,
  shipStats,
  tripFuelCost,
  type GameState,
} from "../src/game";
import {
  MESSAGE_REBUILT,
  SAVE_KEY,
  WARN_OTHER_SEED,
  applyImport,
  devFlagFromAddress,
  devSeedFromAddress,
  exportSaveFile,
  forgetSavedGame,
  loadIntoGame,
  makeSaveData,
  migrateSave,
  planStart,
  readSave,
  writeSave,
  type SaveData,
  type StorageLike,
} from "../src/save";
import { UNIVERSE_VERSION, WORLD_SEED, docksOf, getJobBoard, getPlanetsOfSystem, listSystemsNear, startDockOf } from "../src/universe";

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

const OTHER = 777;

/** A believable seed-777 player: money, two ships, upgrades, paint, ranks, explored places, outposts (one with a stored price, one without), a trip in flight. */
function otherSeedState(): GameState {
  const near = listSystemsNear(OTHER, { x: 0, y: 0, z: 0 }, 40);
  const outposts: string[] = [];
  for (const system of near) for (const dock of docksOf(OTHER, system)) if (dock.kind === "OUTPOST" && outposts.length < 2) outposts.push(dock.id);
  const explored: Record<string, number> = {};
  for (const s of near.slice(0, 12)) explored[s.id] = 0b11;
  const start = startDockOf(OTHER).id;
  let job = null;
  for (const system of near.slice(0, 12)) {
    for (const planet of getPlanetsOfSystem(OTHER, system.id)) job = job ?? getJobBoard(OTHER, planet.id, 0)?.[0] ?? null;
  }
  if (!job) throw new Error("no job in seed 777");
  return normalizeState({
    ...newGameState(job.originDockId),
    credits: 12_345,
    fuel: 33,
    shipId: "scout",
    ownedShips: { "cargo-hauler": { fuel: 20 } },
    shipUpgrades: { scout: { tank: 1, hold: 0, engines: 2, comfort: 0 } },
    shipLiveries: { scout: { owned: ["standard", "rescue-red"], worn: "rescue-red" } },
    ownedOutposts: outposts,
    outpostPrices: outposts[0] ? { [outposts[0]]: 7_000 } : {},
    outpostCount: outposts.length,
    explored,
    deliveredJobIds: ["a", "b"],
    currentJob: job,
    travelStartMs: 1_000,
    travelEndMs: 900_000,
    currentDockId: start === job.originDockId ? start : job.originDockId,
  });
}

function storageWith(seed: number, state: GameState | null, universeVersion: number = UNIVERSE_VERSION): MemoryStorage {
  const s = new MemoryStorage();
  const data: SaveData = { ...makeSaveData(seed, state, 5_000, 10_000), universeVersion };
  s.data.set(SAVE_KEY, JSON.stringify(data));
  s.writes = 0;
  return s;
}

/** A page load, as src/ui/index.ts does it: plan, a Game for plan.seed, saved progress put in. */
function pageLoad(search: string, storage: StorageLike | null): { plan: ReturnType<typeof planStart>; game: Game } {
  const plan = planStart(search, storage);
  const dock = startDockOf(plan.seed).id;
  const game = new Game(plan.seed, dock, createClock(1, () => 20_000));
  if (plan.state && plan.save) loadIntoGame(game, plan.save, plan.state, dock, 20_000);
  return { plan, game };
}

describe("the world seed", () => {
  it("is 12345, so every existing save on the default seed stays valid", () => {
    expect(WORLD_SEED).toBe(12345);
  });
});

describe("the developer flag", () => {
  it("is ?dev=1 and nothing else", () => {
    expect(devFlagFromAddress("?dev=1")).toBe(true);
    expect(devFlagFromAddress("?speed=60&dev=1")).toBe(true);
    expect(devFlagFromAddress("?dev=1&seed=5")).toBe(true);
    expect(devFlagFromAddress("")).toBe(false);
    expect(devFlagFromAddress("?dev=0")).toBe(false);
    expect(devFlagFromAddress("?dev=10")).toBe(false);
    expect(devFlagFromAddress("?dev=true")).toBe(false);
    expect(devFlagFromAddress("?undev=1")).toBe(false);
    expect(devFlagFromAddress("?seed=777")).toBe(false);
  });

  it("?seed= counts only with the flag", () => {
    expect(devSeedFromAddress("?seed=777")).toBeNull();
    expect(devSeedFromAddress("?dev=1&seed=777")).toBe(777);
    expect(devSeedFromAddress("?seed=777&dev=1")).toBe(777);
    expect(devSeedFromAddress("?dev=1")).toBeNull();
    expect(devSeedFromAddress("?dev=1&seed=abc")).toBeNull();
  });
});

describe("a fresh start", () => {
  it("normal address with ?seed=777: still the world seed, no message", () => {
    const { plan, game } = pageLoad("?seed=777", new MemoryStorage());
    expect(plan).toMatchObject({ seed: WORLD_SEED, state: null, why: "fresh", notice: null });
    expect(game.seed).toBe(WORLD_SEED);
  });

  it("?dev=1&seed=777: a new game in universe 777", () => {
    const { plan, game } = pageLoad("?dev=1&seed=777", storageWith(WORLD_SEED, newGameState(startDockOf(WORLD_SEED).id)));
    expect(plan).toMatchObject({ seed: 777, state: null, why: "seed-param" });
    expect(Number(game.seed)).toBe(777);
  });

  it("no storage at all (private window): world seed and the plain note", () => {
    const { plan } = pageLoad("?seed=777", null);
    expect(plan.seed).toBe(WORLD_SEED);
    expect(plan.notice).toContain("Saving is off");
  });
});

describe("a save on another seed is carried over", () => {
  it("normal address: moved to the world seed, credits and ships kept, outposts refunded, trip cancelled, explored cleared", () => {
    const state = otherSeedState();
    const storage = storageWith(OTHER, state);
    const { plan, game } = pageLoad("", storage);
    const refund = 7_000 + OUTPOST_REFUND_ESTIMATE;
    expect(plan.seed).toBe(WORLD_SEED);
    expect(plan.why).toBe("continue");
    expect(plan.notice).toBe(`${MESSAGE_REBUILT} Your outposts were sold back for ${refund} credits.`);
    expect(Number(game.seed)).toBe(WORLD_SEED);
    const s = game.state;
    expect(s.credits).toBe(12_345 + refund);
    expect(s.shipId).toBe("scout");
    expect(Object.keys(s.ownedShips)).toEqual(["cargo-hauler"]);
    expect(s.shipUpgrades.scout).toEqual({ tank: 1, hold: 0, engines: 2, comfort: 0 });
    expect(s.shipLiveries).toEqual({ scout: { owned: ["standard", "rescue-red"], worn: "rescue-red" } });
    expect(game.currentLivery("scout")).toBe("rescue-red");
    expect(s.ownedOutposts).toEqual([]);
    expect(s.currentJob).toBeNull();
    expect(s.freeTrip).toBeNull();
    expect(s.explored).toEqual({});
    expect(s.deliveredJobIds).toEqual([]);
    expect(s.currentDockId).toBe(startDockOf(WORLD_SEED).id);
    // fuel for the cancelled trip came back, up to the tank
    const old = normalizeState(state);
    const back = tripFuelCost(old, old.currentJob!.totalDistance);
    expect(s.fuel).toBe(Math.min(shipStats(old).fuelTankSize, old.fuel + back));
    // the world works: a job board exists at the start dock
    expect(game.getBoard().length).toBeGreaterThan(0);
  });

  it("the save is rewritten at once with the world seed, so the message shows only once", () => {
    const storage = storageWith(OTHER, otherSeedState());
    const first = pageLoad("", storage);
    expect(first.plan.notice).toContain(MESSAGE_REBUILT);
    const stored = readSave(storage);
    expect(stored.kind === "ok" && stored.data.seed).toBe(WORLD_SEED);
    expect(stored.kind === "ok" && stored.data.universeVersion).toBe(UNIVERSE_VERSION);
    const writesAfterFirst = storage.writes;
    const second = pageLoad("", storage);
    expect(second.plan.notice).toBeNull();
    expect(second.plan.seed).toBe(WORLD_SEED);
    expect(second.game.state.credits).toBe(first.game.state.credits);
    expect(storage.writes).toBe(writesAfterFirst); // the second load wrote nothing
    expect(pageLoad("?seed=777", storage).plan.notice).toBeNull(); // a normal ?seed= does not undo it
  });

  it("a ?seed=777 in a normal address does not keep the old seed either", () => {
    const { plan } = pageLoad("?seed=777", storageWith(OTHER, otherSeedState()));
    expect(plan.seed).toBe(WORLD_SEED);
    expect(plan.notice).toContain(MESSAGE_REBUILT);
  });

  it("without outposts there is no refund text", () => {
    const plain = { ...newGameState(startDockOf(OTHER).id), credits: 900 };
    const { plan, game } = pageLoad("", storageWith(OTHER, plain));
    expect(plan.notice).toBe(MESSAGE_REBUILT);
    expect(game.state.credits).toBe(900);
  });

  it("a save of another seed with no progress is just stamped with the world seed", () => {
    const storage = storageWith(OTHER, null);
    const { plan } = pageLoad("", storage);
    expect(plan).toMatchObject({ seed: WORLD_SEED, state: null, why: "fresh", notice: null });
    const stored = readSave(storage);
    expect(stored.kind === "ok" && stored.data.seed).toBe(WORLD_SEED);
  });

  it("an old (universe v1) save on another seed is moved once, with one message", () => {
    const storage = storageWith(OTHER, { ...newGameState(startDockOf(OTHER).id), credits: 400 }, 1);
    const { plan, game } = pageLoad("", storage);
    expect(plan.notice).toBe(MESSAGE_REBUILT);
    expect(plan.seed).toBe(WORLD_SEED);
    expect(game.state.credits).toBe(400);
    expect(pageLoad("", storage).plan.notice).toBeNull();
  });

  it("a raw save from before paint jobs and exploring (fields missing) on another seed loads through the whole path", () => {
    const raw: Record<string, unknown> = { ...otherSeedState() };
    for (const key of ["shipLiveries", "explored", "freeTrip", "spacePlanetId", "shipUpgrades", "outpostPrices", "deliveredJobIds"]) delete raw[key];
    const storage = storageWith(OTHER, raw as unknown as GameState);
    expect(() => pageLoad("", storage)).not.toThrow();
    const { game } = pageLoad("", storage);
    expect(game.state.credits).toBeGreaterThanOrEqual(12_345);
    expect(game.currentLivery("scout")).toBe("standard");
  });

  it("migrateSave without a target keeps the save's own seed (developer pages)", () => {
    const data = makeSaveData(OTHER, otherSeedState(), 1, 2);
    const kept = migrateSave(data);
    expect(kept.data).toBe(data);
    expect(kept.message).toBeNull();
    const moved = migrateSave(data, WORLD_SEED);
    expect(moved.data.seed).toBe(WORLD_SEED);
    expect(moved.refund).toBe(7_000 + OUTPOST_REFUND_ESTIMATE);
    expect(moved.fuelBack).toBeGreaterThan(0);
  });
});

describe("a save on the world seed", () => {
  it("is untouched: same object, nothing written, no message, trip and outposts kept", () => {
    const start = startDockOf(WORLD_SEED).id;
    const state = { ...newGameState(start), credits: 4_321, explored: { [listSystemsNear(WORLD_SEED, { x: 0, y: 0, z: 0 }, 10)[0]!.id]: 1 } };
    const storage = storageWith(WORLD_SEED, state);
    const before = storage.getItem(SAVE_KEY);
    const { plan, game } = pageLoad("?speed=60", storage);
    expect(plan).toMatchObject({ seed: WORLD_SEED, why: "continue", notice: null });
    expect(game.state.credits).toBe(4_321);
    expect(Object.keys(game.state.explored).length).toBe(1);
    expect(storage.writes).toBe(0);
    expect(storage.getItem(SAVE_KEY)).toBe(before);
  });
});

describe("a broken save", () => {
  it("starts a new game on the world seed with the notice", () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, "{garbage");
    const { plan } = pageLoad("?seed=777", storage);
    expect(plan).toMatchObject({ seed: WORLD_SEED, state: null, why: "bad-save" });
  });
});

describe("developer mode", () => {
  it("?dev=1 without ?seed= continues a save on another seed as it is (never moved)", () => {
    const state = otherSeedState();
    const storage = storageWith(OTHER, state);
    const before = storage.getItem(SAVE_KEY);
    const { plan, game } = pageLoad("?dev=1", storage);
    expect(plan).toMatchObject({ seed: OTHER, why: "continue", notice: null });
    expect(Number(game.seed)).toBe(OTHER);
    expect(game.state.credits).toBe(12_345);
    expect(storage.getItem(SAVE_KEY)).toBe(before);
    // and the next NORMAL load is the one that moves it
    expect(pageLoad("", storage).plan.seed).toBe(WORLD_SEED);
  });
});

describe("NEW GAME", () => {
  it("forgets the save; the next load is a fresh game on the world seed", () => {
    const storage = storageWith(OTHER, otherSeedState());
    expect(forgetSavedGame(storage)).toBe(true);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    const { plan, game } = pageLoad("", storage);
    expect(plan).toMatchObject({ seed: WORLD_SEED, state: null, why: "fresh", notice: null });
    expect(game.state.credits).toBe(newGameState(startDockOf(WORLD_SEED).id).credits);
  });

  it("copes with no storage and with storage that refuses", () => {
    expect(forgetSavedGame(null)).toBe(true);
    const refusing: StorageLike = {
      getItem: () => "x",
      setItem: () => undefined,
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(forgetSavedGame(refusing)).toBe(false);
  });
});

describe("save file import", () => {
  /** Exports a file the way a seed-777 player would have made it. */
  function fileFromOtherSeed(): string {
    const s = storageWith(OTHER, otherSeedState());
    const r = exportSaveFile(s, new Date(Date.UTC(2026, 10, 14, 8, 0, 0)));
    if (!r.ok) throw new Error(r.reason);
    return r.text;
  }

  it("a seed-777 file is accepted with the 'will be moved' warning and the otherSeed flag", () => {
    const target = new MemoryStorage();
    const r = applyImport(target, fileFromOtherSeed(), WORLD_SEED);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.otherSeed).toBe(true);
    expect(r.warnings).toContain(WARN_OTHER_SEED);
    expect(r.summary.seed).toBe(OTHER);
  });

  it("after the reload the imported progress is in the world: credits, ships, paint kept; outposts refunded", () => {
    const target = new MemoryStorage();
    expect(applyImport(target, fileFromOtherSeed(), WORLD_SEED).ok).toBe(true);
    const { plan, game } = pageLoad("", target);
    expect(plan.seed).toBe(WORLD_SEED);
    expect(plan.notice).toContain(MESSAGE_REBUILT);
    expect(game.state.credits).toBe(12_345 + 7_000 + OUTPOST_REFUND_ESTIMATE);
    expect(game.currentLivery("scout")).toBe("rescue-red");
    expect(game.state.shipId).toBe("scout");
  });

  it("a file from the world seed has no such warning", () => {
    const s = storageWith(WORLD_SEED, { ...newGameState(startDockOf(WORLD_SEED).id), credits: 77 });
    const file = exportSaveFile(s, new Date(Date.UTC(2026, 10, 14)));
    if (!file.ok) throw new Error(file.reason);
    const r = applyImport(new MemoryStorage(), file.text, WORLD_SEED);
    expect(r.ok && r.otherSeed).toBe(false);
    expect(r.ok && r.warnings).not.toContain(WARN_OTHER_SEED);
  });

  it("exporting a developer save on another seed keeps it as it is", () => {
    const r = exportSaveFile(storageWith(OTHER, otherSeedState()), new Date(Date.UTC(2026, 10, 14)));
    expect(r.ok && r.summary.seed).toBe(OTHER);
    expect(r.ok && r.summary.credits).toBe(12_345); // not the refunded number: nothing was moved
  });
});

describe("storage is only written the way it should be", () => {
  it("a moved save is written once", () => {
    const storage = storageWith(OTHER, otherSeedState());
    pageLoad("", storage);
    expect(storage.writes).toBe(1);
    const stored = readSave(storage);
    expect(stored.kind).toBe("ok");
    writeSave(storage, makeSaveData(WORLD_SEED, newGameState(startDockOf(WORLD_SEED).id), 0, 0)); // sanity: still writable
  });
});
