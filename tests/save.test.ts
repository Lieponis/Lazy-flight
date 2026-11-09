import { describe, expect, it } from "vitest";
import { Game, buyShip, createClock, newGameState, type GameState } from "../src/game";
import {
  BACKUP_KEY,
  NOTICE_BAD_SAVE,
  NOTICE_NO_STORAGE,
  SAVE_KEY,
  SAVE_VERSION,
  addressWithSeed,
  addressWithoutSeed,
  fitToUniverse,
  loadIntoGame,
  makeSaveData,
  planStart,
  randomSeed,
  readSave,
  seedFromAddress,
  shiftTravelTimes,
  startAutoSave,
  writeSave,
  type PageEvents,
  type StorageLike,
} from "../src/save";
import { getJobBoard, getPlanetsOfSystem, listSystemsNear, type Job } from "../src/universe";

const SEED = 12345;
const HOUR = 3_600_000;

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
/** Storage that throws on everything, like a blocked or full one. */
const throwing: StorageLike = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

function fakeTime(start: number) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

const startDock = (): string => {
  const system = listSystemsNear(SEED, { x: 0, y: 0, z: 0 }, 40)[0]!;
  return getPlanetsOfSystem(SEED, system.id)[0]!.id;
};

/** Some real job from this universe, starting at `dockId`. */
function someJob(): Job {
  for (const system of listSystemsNear(SEED, { x: 0, y: 0, z: 0 }, 40).slice(0, 10)) {
    for (const planet of getPlanetsOfSystem(SEED, system.id)) {
      const job = getJobBoard(SEED, planet.id, 0)?.[0];
      if (job) return job;
    }
  }
  throw new Error("no job found");
}

function flyingState(job: Job, start: number, end: number): GameState {
  return { ...newGameState(job.originDockId), currentJob: job, travelStartMs: start, travelEndMs: end };
}

describe("save: write then read", () => {
  it("gives back an identical state", () => {
    const storage = new MemoryStorage();
    const owned = buyShip({ ...newGameState(startDock()), credits: 5000 }, "scout");
    if (!owned.ok) throw new Error(owned.reason);
    const state: GameState = { ...owned.state, fuel: 17 };
    expect(writeSave(storage, makeSaveData(SEED, state, 1000, 2000))).toBe(true);
    const read = readSave(storage);
    expect(read.kind).toBe("ok");
    if (read.kind !== "ok") return;
    expect(read.data.state).toEqual(state);
    expect(read.data.seed).toBe(SEED);
    expect(read.data.version).toBe(SAVE_VERSION);
  });

  it("keeps a mid-flight job exactly", () => {
    const storage = new MemoryStorage();
    const state = flyingState(someJob(), 10_000, 10_000 + HOUR);
    writeSave(storage, makeSaveData(SEED, state, 20_000, 20_000));
    const read = readSave(storage);
    expect(read.kind === "ok" && read.data.state).toEqual(state);
  });

  it("saves a copy, not the live object", () => {
    const state = newGameState(startDock());
    const data = makeSaveData(SEED, state, 0, 0);
    state.credits = 999_999;
    expect(data.state?.credits).not.toBe(999_999);
  });
});

describe("save: broken, old and wrong-version saves never crash", () => {
  const cases: [string, string][] = [
    ["broken JSON", "{not json"],
    ["wrong version", JSON.stringify({ ...makeSaveData(SEED, newGameState("x/1"), 0, 0), version: 999 })],
    ["no version (very old)", JSON.stringify({ seed: SEED, state: newGameState("x/1") })],
    ["a plain number", "42"],
    ["bad seed", JSON.stringify({ ...makeSaveData(SEED, newGameState("x/1"), 0, 0), seed: "abc" })],
    ["no dock", JSON.stringify({ ...makeSaveData(SEED, newGameState("x/1"), 0, 0), state: { credits: 5 } })],
  ];
  for (const [name, text] of cases) {
    it(`${name}: ignored, kept once under the backup key, main key cleared`, () => {
      const storage = new MemoryStorage();
      storage.setItem(SAVE_KEY, text);
      expect(readSave(storage).kind).toBe("bad");
      expect(storage.getItem(BACKUP_KEY)).toBe(text);
      expect(storage.getItem(SAVE_KEY)).toBeNull();
      expect(readSave(storage).kind).toBe("none"); // the second load is a clean start
    });
  }

  it("a bad save starts a new game with the default seed and a notice", () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, "{oops");
    const plan = planStart("", storage, SEED);
    expect(plan).toMatchObject({ seed: SEED, state: null, why: "bad-save", notice: NOTICE_BAD_SAVE });
  });

  it("an old save without ownedShips is repaired by the game on load", () => {
    const old = newGameState(startDock()) as Partial<GameState>;
    delete old.ownedShips;
    const game = new Game(SEED, startDock(), createClock(1, () => 0));
    loadIntoGame(game, makeSaveData(SEED, old as GameState, 0, 0), old as GameState, startDock(), 0);
    expect(game.state.ownedShips).toEqual({});
  });

  it("bad numbers and unknown ships are repaired on load", () => {
    const bad = { ...newGameState(startDock()), credits: Number.NaN, fuel: -5, shipId: "x-wing" } as GameState;
    const game = new Game(SEED, startDock(), createClock(1, () => 0));
    loadIntoGame(game, makeSaveData(SEED, bad, 0, 0), bad, startDock(), 0);
    expect(game.state.shipId).toBe("cargo-hauler");
    expect(game.state.fuel).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(game.state.credits)).toBe(true);
  });

  it("a dock that does not exist in this universe sends you to the start dock", () => {
    const state = { ...newGameState("no-such-system/9"), credits: 777 };
    const fitted = fitToUniverse(state, SEED, startDock());
    expect(fitted.currentDockId).toBe(startDock());
    expect(fitted.credits).toBe(777);
  });

  it("a job to a dock that does not exist is dropped", () => {
    const job = { ...someJob(), destinationDockId: "nowhere/1" };
    const fitted = fitToUniverse(flyingState(job, 0, HOUR), SEED, startDock());
    expect(fitted.currentJob).toBeNull();
    expect(fitted.travelEndMs).toBeNull();
  });
});

describe("save: storage that throws or is missing", () => {
  it("reading and writing never throw", () => {
    expect(() => readSave(throwing)).not.toThrow();
    expect(readSave(throwing).kind).toBe("none");
    expect(writeSave(throwing, makeSaveData(SEED, newGameState("x/1"), 0, 0))).toBe(false);
    expect(readSave(null).kind).toBe("none");
    expect(writeSave(null, makeSaveData(SEED, newGameState("x/1"), 0, 0))).toBe(false);
  });

  it("no storage: a fresh game with a notice", () => {
    expect(planStart("", null, SEED)).toMatchObject({ seed: SEED, why: "fresh", notice: NOTICE_NO_STORAGE });
  });

  it("the autosaver plays on and reports it is not working", () => {
    const game = new Game(SEED, startDock(), createClock(1, () => 0));
    const saver = startAutoSave(game, throwing, null, () => 0);
    expect(() => game.refuel()).not.toThrow();
    expect(saver.working).toBe(false);
  });
});

describe("save: start-up rules", () => {
  it("?seed=NUMBER starts a new game with that seed, even with a save", () => {
    const storage = new MemoryStorage();
    writeSave(storage, makeSaveData(SEED, newGameState(startDock()), 0, 0));
    expect(planStart("?seed=777&speed=60", storage, SEED)).toMatchObject({ seed: 777, state: null, why: "seed-param" });
  });

  it("no ?seed and a good save: continue it with its own seed", () => {
    const storage = new MemoryStorage();
    const state = { ...newGameState(startDock()), credits: 4321 };
    writeSave(storage, makeSaveData(999, state, 0, 0));
    const plan = planStart("?speed=60", storage, SEED);
    expect(plan.why).toBe("continue");
    expect(plan.seed).toBe(999);
    expect(plan.state?.credits).toBe(4321);
  });

  it("no ?seed and no save: the default seed", () => {
    expect(planStart("", new MemoryStorage(), SEED)).toMatchObject({ seed: SEED, why: "fresh", notice: null });
  });

  it("NEW GAME goes to ?seed=NUMBER, keeping ?speed=", () => {
    expect(addressWithSeed("?speed=60", 4242)).toBe("?speed=60&seed=4242");
    expect(addressWithSeed("?seed=1&speed=60", 4242)).toBe("?seed=4242&speed=60");
    expect(planStart(addressWithSeed("", 4242), new MemoryStorage(), SEED)).toMatchObject({ seed: 4242, state: null });
  });

  it("reads and removes ?seed from the address", () => {
    expect(seedFromAddress("?seed=777")).toBe(777);
    expect(seedFromAddress("?speed=5&seed=-3")).toBe(-3);
    expect(seedFromAddress("?seed=abc")).toBeNull();
    expect(seedFromAddress("")).toBeNull();
    expect(addressWithoutSeed("?seed=777&speed=60")).toBe("?speed=60");
    expect(addressWithoutSeed("?seed=777")).toBe("");
  });

  it("random seeds are positive whole numbers", () => {
    for (const r of [0, 0.5, 0.999999]) {
      const s = randomSeed(() => r);
      expect(Number.isInteger(s) && s > 0).toBe(true);
    }
  });
});

describe("save: mid-flight and the clock", () => {
  it("speed 1: a trip keeps the real time it had left (and the time away counts)", () => {
    const state = flyingState(someJob(), 0, HOUR);
    const save = { gameNowMs: 10 * 60_000, savedAtRealMs: 10 * 60_000 }; // saved 10 min into a 60 min trip
    const realNow = 30 * 60_000; // page opened again 20 min later
    const shifted = shiftTravelTimes(state, save, realNow, realNow, 1);
    expect(shifted.travelEndMs! - realNow).toBe(30 * 60_000); // 30 min left
  });

  it("with ?speed=, game time that ran ahead of real time is moved back onto the new clock", () => {
    const state = flyingState(someJob(), 5_000_000, 5_000_000 + HOUR);
    // Saved at real time 1,000,000 when game time had run ahead to 5,000,000 + 30 min.
    const save = { gameNowMs: 5_000_000 + 30 * 60_000, savedAtRealMs: 1_000_000 };
    const realNow = 1_000_000 + 60_000; // one real minute later, at speed 10 = 10 game minutes
    const newGameNow = realNow; // the new clock starts at the real time
    const shifted = shiftTravelTimes(state, save, realNow, newGameNow, 10);
    expect(shifted.travelEndMs! - newGameNow).toBe(20 * 60_000);
    expect(shifted.travelEndMs! - shifted.travelStartMs!).toBe(HOUR); // trip length unchanged
  });

  it("a real clock that went backwards counts as no time away", () => {
    const state = flyingState(someJob(), 0, HOUR);
    const shifted = shiftTravelTimes(state, { gameNowMs: 1000, savedAtRealMs: 1000 }, 0, 0, 1);
    expect(shifted.travelEndMs! - 0).toBe(HOUR - 1000);
  });

  it("docked state is not changed by the shift", () => {
    const state = newGameState(startDock());
    expect(shiftTravelTimes(state, { gameNowMs: 5, savedAtRealMs: 9 }, 100, 100, 3)).toBe(state);
  });

  it("save mid-flight, reload: the flight continues and then pays on arrival", () => {
    const time = fakeTime(1_000_000);
    const storage = new MemoryStorage();
    const job = someJob();
    const game1 = new Game(SEED, job.originDockId, createClock(1, time.now));
    game1.loadState(flyingState(job, time.now(), time.now() + HOUR));
    const saver = startAutoSave(game1, storage, null, time.now);
    time.advance(15 * 60_000);
    saver.saveNow();

    time.advance(5 * 60_000); // page closed for 5 minutes
    const plan = planStart("", storage, SEED);
    expect(plan.why).toBe("continue");
    const game2 = new Game(plan.seed, startDock(), createClock(1, time.now));
    loadIntoGame(game2, plan.save!, plan.state!, startDock(), time.now());
    expect(game2.state.currentJob?.id).toBe(job.id);
    expect(game2.progress()?.fraction).toBeCloseTo(20 / 60, 3);

    const credits = game2.state.credits;
    time.advance(40 * 60_000);
    expect(game2.update()).not.toBeNull();
    expect(game2.state.currentJob).toBeNull();
    expect(game2.state.currentDockId).toBe(job.destinationDockId);
    expect(game2.state.credits).toBe(credits + job.reward);
  });
});

describe("save: autosave", () => {
  it("saves on every game change and when the page is hidden", () => {
    const storage = new MemoryStorage();
    let hidden: (() => void) | null = null;
    const page: PageEvents = { onHidden: (fn) => (hidden = fn) };
    const time = fakeTime(0);
    const game = new Game(SEED, startDock(), createClock(1, time.now));
    startAutoSave(game, storage, page, time.now);
    expect(readSave(storage).kind).toBe("ok"); // saved at once

    game.loadState({ ...game.state, credits: 5000 });
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).state.credits).toBe(5000);
    game.buyShip("scout");
    expect(Object.keys(JSON.parse(storage.getItem(SAVE_KEY)!).state.ownedShips)).toContain("scout");

    storage.data.clear();
    hidden!();
    expect(readSave(storage).kind).toBe("ok");
  });

  it("stop() means no more saves (NEW GAME, while the page restarts)", () => {
    const storage = new MemoryStorage();
    const game = new Game(SEED, startDock(), createClock(1, () => 0));
    const saver = startAutoSave(game, storage, null, () => 0);
    saver.stop();
    game.loadState({ ...game.state, credits: 9 });
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).state.credits).not.toBe(9);
  });
});

describe("save: the universe is the same after loading", () => {
  it("same seed gives the same job boards and docks before and after a save round trip", () => {
    const storage = new MemoryStorage();
    const before = getJobBoard(SEED, startDock(), 7);
    writeSave(storage, makeSaveData(SEED, newGameState(startDock()), 0, 0));
    const plan = planStart("", storage, 1);
    expect(plan.seed).toBe(SEED);
    expect(getJobBoard(plan.seed, startDock(), 7)).toEqual(before);
    expect(getPlanetsOfSystem(plan.seed, startDock().split("/")[0]!)).toEqual(
      getPlanetsOfSystem(SEED, startDock().split("/")[0]!),
    );
  });

  it("the save never contains universe data (only progress)", () => {
    const data = makeSaveData(SEED, newGameState(startDock()), 0, 0);
    expect(Object.keys(data).sort()).toEqual(["gameNowMs", "savedAtRealMs", "seed", "state", "version"]);
  });
});

describe("save: trips saved before the 6b trip-time change (8 min per ly -> 1 min per ly)", () => {
  it("an old mid-flight save with a long trip loads without crashing and still lands and pays", () => {
    const time = fakeTime(5_000_000);
    const storage = new MemoryStorage();
    const job = someJob();
    // An old save: the same job, but its trip was planned with the old, 8x longer time.
    const oldTrip = Math.round(job.totalDistance * 480 + 20) * 1000;
    const old = flyingState(job, time.now() - 60_000, time.now() - 60_000 + oldTrip);
    writeSave(storage, makeSaveData(SEED, old, time.now(), time.now()));
    const plan = planStart("", storage, SEED);
    const game = new Game(plan.seed, startDock(), createClock(1, time.now));
    expect(() => loadIntoGame(game, plan.save!, plan.state!, startDock(), time.now())).not.toThrow();
    const p = game.progress();
    expect(p && p.fraction >= 0 && p.fraction <= 1).toBe(true);
    const credits = game.state.credits;
    time.advance(oldTrip);
    expect(game.update()).not.toBeNull();
    expect(game.state.credits).toBe(credits + job.reward);
  });
});
