import { describe, expect, it } from "vitest";
import {
  FUEL_PER_LY,
  Game,
  MAX_SPEED,
  MAX_TRIP_SECONDS,
  REFUEL_PRICE_PER_UNIT,
  SAME_SYSTEM_TRIP_SECONDS,
  STARTING_CREDITS,
  acceptJob,
  checkJob,
  createClock,
  fuelCost,
  getShip,
  newGameState,
  parseSpeedParam,
  refuel,
  settleArrival,
  slotOf,
  travelProgress,
  tripSeconds,
  type GameState,
} from "../src/game";
import { generateDock, generateJobBoard, getPlanetsOfSystem, listSystemsNear, type Job } from "../src/universe";

const SEED = 12345;
const ORIGIN = { x: 0, y: 0, z: 0 };
const HOUR = 3_600_000;

/** A sample of docks and the boards they show in a few time slots. */
function sampleJobs(): Job[] {
  const jobs: Job[] = [];
  for (const system of listSystemsNear(SEED, ORIGIN, 40).slice(0, 14)) {
    for (const planet of getPlanetsOfSystem(SEED, system.id)) {
      const dock = generateDock(SEED, planet);
      for (const slot of [0, 6, 13, 500]) jobs.push(...generateJobBoard(SEED, dock, slot));
    }
  }
  return jobs;
}
const JOBS = sampleJobs();

/** A state docked at the job's origin, with plenty of fuel, for testing a particular job. */
function stateFor(job: Job, patch: Partial<GameState> = {}): GameState {
  return { ...newGameState(job.originDockId), ...patch };
}

const takeable = (): Job => {
  const job = JOBS.find((j) => j.requiredHold === "CARGO_BAY" && j.amount <= getShip("cargo-hauler").cargoCapacity);
  if (!job) throw new Error("no takeable sample job");
  return job;
};

describe("travel time", () => {
  it("never exceeds 4 hours for any job the universe can generate", () => {
    expect(JOBS.length).toBeGreaterThan(100);
    for (const job of JOBS) expect(tripSeconds(job.totalDistance)).toBeLessThanOrEqual(MAX_TRIP_SECONDS);
  });

  it("never exceeds 4 hours for silly distances either", () => {
    for (const d of [25, 75, 1000, 1e9, Infinity, NaN]) expect(tripSeconds(d)).toBeLessThanOrEqual(MAX_TRIP_SECONDS);
  });

  it("takes 10 to 30 seconds inside the same system, and longer for farther trips", () => {
    expect(tripSeconds(0)).toBe(SAME_SYSTEM_TRIP_SECONDS);
    expect(tripSeconds(0)).toBeGreaterThanOrEqual(10);
    expect(tripSeconds(0)).toBeLessThanOrEqual(30);
    expect(tripSeconds(10)).toBeGreaterThan(tripSeconds(5));
    expect(tripSeconds(25)).toBeGreaterThan(tripSeconds(10));
  });
});

describe("fuel cost", () => {
  it("grows with distance", () => {
    expect(fuelCost(25)).toBeGreaterThan(fuelCost(10));
    expect(fuelCost(10)).toBeGreaterThan(fuelCost(2));
    let last = 0;
    for (let d = 0; d <= 25; d += 0.5) {
      expect(fuelCost(d)).toBeGreaterThanOrEqual(last);
      last = fuelCost(d);
    }
    expect(fuelCost(10)).toBe(10 * FUEL_PER_LY);
  });

  it("is at least 1 even inside a system", () => {
    expect(fuelCost(0)).toBeGreaterThanOrEqual(1);
  });
});

describe("accepting a job", () => {
  it("burns fuel and saves start and end times", () => {
    const job = takeable();
    const before = stateFor(job);
    const result = acceptJob(before, job, 1000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.fuel).toBe(before.fuel - fuelCost(job.totalDistance));
    expect(result.state.currentJob).toEqual(job);
    expect(result.state.travelStartMs).toBe(1000);
    expect(result.state.travelEndMs).toBe(1000 + tripSeconds(job.totalDistance) * 1000);
  });

  it("does not allow a second job while one is active", () => {
    const job = takeable();
    const first = acceptJob(stateFor(job), job, 0);
    if (!first.ok) throw new Error("first accept failed");
    const second = acceptJob(first.state, job, 5);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.block.code).toBe("busy");
  });
});

describe("blocked jobs", () => {
  it("blocks passenger and tour jobs because the starter ship has no cabin", () => {
    const passenger = JOBS.filter((j) => j.requiredHold === "PASSENGER_CABIN");
    expect(passenger.length).toBeGreaterThan(0);
    for (const job of passenger.slice(0, 40)) expect(checkJob(stateFor(job), job)?.code).toBe("no-cabin");
  });

  it("blocks cargo that is too large for the bay", () => {
    const big = JOBS.find((j) => j.requiredHold === "CARGO_BAY" && j.amount > getShip("cargo-hauler").cargoCapacity);
    if (!big) throw new Error("no oversized sample job");
    expect(checkJob(stateFor(big), big)?.code).toBe("cargo-too-large");
  });

  it("blocks a job when there is not enough fuel", () => {
    const job = takeable();
    const state = stateFor(job, { fuel: fuelCost(job.totalDistance) - 1 });
    expect(checkJob(state, job)?.code).toBe("not-enough-fuel");
    expect(checkJob({ ...state, fuel: fuelCost(job.totalDistance) }, job)).toBeNull();
  });

  it("every blocked reason comes with plain text", () => {
    for (const job of JOBS.slice(0, 200)) {
      const block = checkJob(stateFor(job), job);
      if (block) expect(block.text.length).toBeGreaterThan(5);
    }
  });
});

describe("arrival uses timestamps", () => {
  const job = takeable();
  const flying = (): GameState => {
    const r = acceptJob(stateFor(job), job, 10_000);
    if (!r.ok) throw new Error("accept failed");
    return r.state;
  };
  const name = (id: string): string => `Dock ${id}`;

  it("does nothing before the end time", () => {
    const s = flying();
    const end = s.travelEndMs ?? 0;
    expect(settleArrival(s, end - 1, name).arrival).toBeNull();
  });

  it("pays at the end time, moves to the destination dock and clears the job", () => {
    const s = flying();
    const { state, arrival } = settleArrival(s, s.travelEndMs ?? 0, name);
    expect(arrival).not.toBeNull();
    expect(state.credits).toBe(s.credits + job.reward);
    expect(state.currentDockId).toBe(job.destinationDockId);
    expect(state.currentJob).toBeNull();
    expect(state.travelStartMs).toBeNull();
    expect(state.travelEndMs).toBeNull();
    expect(arrival?.debrief.length).toBeGreaterThan(5);
  });

  it("still gives the right answer after a long pause or clock jump forward", () => {
    const s = flying();
    const { state, arrival } = settleArrival(s, 10_000 + 1000 * HOUR, name);
    expect(arrival?.reward).toBe(job.reward);
    expect(state.credits).toBe(s.credits + job.reward);
  });

  it("is not fooled by the clock jumping backward", () => {
    const s = flying();
    expect(settleArrival(s, -999_999, name).arrival).toBeNull();
    const p = travelProgress(s, -999_999);
    expect(p?.fraction).toBe(0);
    expect(p?.remainingMs).toBe(p?.totalMs);
  });

  it("pays the reward exactly once", () => {
    const s = flying();
    const first = settleArrival(s, 1e15, name);
    const second = settleArrival(first.state, 2e15, name);
    expect(second.arrival).toBeNull();
    expect(second.state.credits).toBe(s.credits + job.reward);
  });

  it("reports progress between 0 and 1", () => {
    const s = flying();
    const mid = ((s.travelStartMs ?? 0) + (s.travelEndMs ?? 0)) / 2;
    expect(travelProgress(s, mid)?.fraction).toBeCloseTo(0.5, 2);
    expect(travelProgress({ ...s, currentJob: null }, mid)).toBeNull();
  });
});

describe("refuel", () => {
  it("costs credits at the flat price and fills the tank", () => {
    const state = { ...newGameState("x/0"), fuel: 10, credits: 1000 };
    const r = refuel(state);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const tank = getShip("cargo-hauler").fuelTankSize;
    expect(r.state.fuel).toBe(tank);
    expect(r.cost).toBe((tank - 10) * REFUEL_PRICE_PER_UNIT);
    expect(r.state.credits).toBe(1000 - r.cost);
  });

  it("stops at a full tank", () => {
    const r = refuel(newGameState("x/0"));
    expect(r.ok).toBe(false);
    expect(newGameState("x/0").credits).toBe(STARTING_CREDITS);
  });

  it("buys only what the credits allow", () => {
    const r = refuel({ ...newGameState("x/0"), fuel: 0, credits: 7 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.units).toBe(Math.floor(7 / REFUEL_PRICE_PER_UNIT));
      expect(r.state.credits).toBeGreaterThanOrEqual(0);
    }
  });

  it("is not possible while flying", () => {
    const job = takeable();
    const r = acceptJob(stateFor(job), job, 0);
    if (!r.ok) throw new Error("accept failed");
    expect(refuel({ ...r.state, fuel: 1 }).ok).toBe(false);
  });
});

describe("clock and speed", () => {
  it("reads ?speed= from the address, default 1", () => {
    expect(parseSpeedParam("")).toBe(1);
    expect(parseSpeedParam("?speed=60")).toBe(60);
    expect(parseSpeedParam("?seed=5&speed=120")).toBe(120);
    expect(parseSpeedParam("?speed=abc")).toBe(1);
    expect(parseSpeedParam("?speed=0")).toBe(1);
    expect(parseSpeedParam("?speed=99999999999")).toBe(MAX_SPEED);
  });

  it("runs faster with a higher speed", () => {
    let real = 5000;
    const clock = createClock(60, () => real);
    const start = clock.now();
    real += 1000; // one real second
    expect(clock.now() - start).toBe(60_000); // counts as one minute
  });

  it("time slot is one whole hour", () => {
    expect(slotOf(0)).toBe(0);
    expect(slotOf(HOUR - 1)).toBe(0);
    expect(slotOf(HOUR)).toBe(1);
  });
});

describe("Game object", () => {
  const dock = (): string => {
    const system = listSystemsNear(SEED, ORIGIN, 10)[0];
    const planet = system ? getPlanetsOfSystem(SEED, system.id)[0] : undefined;
    if (!planet) throw new Error("no start dock");
    return planet.id;
  };
  const makeGame = (speed = 1): { game: Game; advance: (ms: number) => void } => {
    let real = 40 * HOUR;
    const game = new Game(SEED, dock(), createClock(speed, () => real));
    return { game, advance: (ms) => (real += ms) };
  };

  it("gives the same board for the same seed, dock and slot", () => {
    const a = makeGame().game.getBoard().map((e) => e.job);
    const b = makeGame().game.getBoard().map((e) => e.job);
    expect(a.length).toBeGreaterThan(0);
    expect(a).toEqual(b);
  });

  it("plays the whole loop: accept, wait, arrive, get paid, change system", () => {
    const { game, advance } = makeGame();
    const entry = game.getBoard().find((e) => !e.block);
    if (!entry) throw new Error("no takeable job on the start board");
    const credits = game.state.credits;
    const fuel = game.state.fuel;
    expect(game.accept(entry.job.id).ok).toBe(true);
    expect(game.state.fuel).toBe(fuel - entry.fuelNeeded);
    expect(game.getBoard()).toEqual([]); // no board while flying
    expect(game.accept(entry.job.id).ok).toBe(false);

    advance(entry.tripSeconds * 1000 - 1);
    expect(game.update()).toBeNull();
    advance(1);
    const arrival = game.update();
    expect(arrival?.reward).toBe(entry.job.reward);
    expect(game.state.credits).toBe(credits + entry.job.reward);
    expect(game.state.currentDockId).toBe(entry.job.destinationDockId);
    expect(game.currentSystemId()).toBe(entry.job.destinationDockId.split("/")[0]);
    expect(game.update()).toBeNull(); // not paid twice
    expect(game.state.credits).toBe(credits + entry.job.reward);
  });

  it("with speed 120 a 2 hour trip takes one real minute", () => {
    const { game, advance } = makeGame(120);
    const entry = game.getBoard().find((e) => !e.block);
    if (!entry) throw new Error("no takeable job");
    game.accept(entry.job.id);
    advance((entry.tripSeconds * 1000) / 120 + 1);
    expect(game.update()).not.toBeNull();
  });
});
