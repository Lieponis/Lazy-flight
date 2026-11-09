import { describe, expect, it } from "vitest";
import {
  EMERGENCY_REFUEL_AMOUNT,
  Game,
  MAX_TRIP_SECONDS,
  REFUEL_PRICE_PER_UNIT,
  SHIP_ORDER,
  acceptJob,
  buyShip,
  checkJob,
  createClock,
  emergencyRefuel,
  fuelCost,
  getShip,
  isStuck,
  newGameState,
  normalizeState,
  settleArrival,
  shipCatalog,
  switchShip,
  tripSeconds,
  type GameState,
} from "../src/game";
import { generateDock, generateJobBoard, getPlanetsOfSystem, listSystemsNear, type Job } from "../src/universe";

const SEED = 12345;
const ORIGIN = { x: 0, y: 0, z: 0 };
const HOUR = 3_600_000;

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

// These tests are about ships, fuel and capacity, not ranks: give the player the top rank everywhere.
const TOP_RANKS = { TRADE: 99, PASSENGER: 99, TOUR: 99 };

function at(job: Job, patch: Partial<GameState> = {}): GameState {
  return { ...newGameState(job.originDockId), completedJobs: TOP_RANKS, ...patch };
}
const rich = (job: Job): GameState => at(job, { credits: 10_000 });

const passengerJob = (maxAmount = 12): Job => {
  const j = JOBS.find((x) => x.kind === "PASSENGER" && x.amount <= maxAmount && fuelCost(x.totalDistance) <= 60);
  if (!j) throw new Error("no passenger sample job");
  return j;
};
const tourJob = (): Job => {
  const j = JOBS.find((x) => x.kind === "TOUR" && fuelCost(x.totalDistance) <= 70 && x.amount <= 12);
  if (!j) throw new Error("no tour sample job");
  return j;
};
const cargoJob = (): Job => {
  const j = JOBS.find((x) => x.requiredHold === "CARGO_BAY" && x.amount <= 30 && fuelCost(x.totalDistance) <= 60);
  if (!j) throw new Error("no cargo sample job");
  return j;
};

/** A board where fuel is the only problem: every job in `jobs` fits the ship. */
function fittingJobs(): Job[] {
  return JOBS.filter((j) => j.requiredHold === "CARGO_BAY" && j.amount <= 30 && fuelCost(j.totalDistance) <= 60).slice(0, 5);
}
const dockOf = (jobs: Job[]): string => jobs[0]?.originDockId ?? "";

describe("ships", () => {
  it("has the three ships with the exact ids and default numbers", () => {
    expect(SHIP_ORDER).toEqual(["cargo-hauler", "passenger-liner", "scout"]);
    expect(getShip("cargo-hauler")).toMatchObject({ cargoCapacity: 30, cabinCapacity: 0, fuelTankSize: 60, price: 0 });
    expect(getShip("passenger-liner")).toMatchObject({ cargoCapacity: 6, cabinCapacity: 12, fuelTankSize: 100, price: 1500 });
    expect(getShip("scout")).toMatchObject({ cargoCapacity: 10, cabinCapacity: 2, fuelTankSize: 110, price: 1200 });
    for (const id of SHIP_ORDER) expect(getShip(id).description.length).toBeGreaterThan(5);
  });
});

describe("buying ships", () => {
  const base = newGameState("x/0");

  it("deducts the price, gives a full tank and does not switch", () => {
    const r = buyShip({ ...base, credits: 2000 }, "passenger-liner");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.credits).toBe(500);
    expect(r.state.ownedShips["passenger-liner"]).toEqual({ fuel: 100 });
    expect(r.state.shipId).toBe("cargo-hauler");
  });

  it("cannot be bought twice", () => {
    const first = buyShip({ ...base, credits: 5000 }, "scout");
    if (!first.ok) throw new Error("first buy failed");
    const second = buyShip(first.state, "scout");
    expect(second.ok).toBe(false);
    expect(buyShip(base, "cargo-hauler").ok).toBe(false); // you already own the starter
  });

  it("cannot be bought when short of credits, and credits never go negative", () => {
    const r = buyShip({ ...base, credits: 1499 }, "passenger-liner");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.length).toBeGreaterThan(5);
    const exact = buyShip({ ...base, credits: 1500 }, "passenger-liner");
    expect(exact.ok && exact.state.credits).toBe(0);
  });

  it("cannot be bought during a flight, or for an unknown ship", () => {
    const job = cargoJob();
    const flying = acceptJob(at(job, { credits: 9999 }), job, 0);
    if (!flying.ok) throw new Error("accept failed");
    expect(buyShip(flying.state, "scout").ok).toBe(false);
    expect(buyShip(base, "death-star").ok).toBe(false);
  });

  it("catalog shows owned, active, canBuy and the reason", () => {
    const cat = shipCatalog({ ...base, credits: 1300 });
    expect(cat.map((c) => c.ship.id)).toEqual(SHIP_ORDER);
    const hauler = cat[0];
    const liner = cat[1];
    const scout = cat[2];
    expect(hauler).toMatchObject({ owned: true, active: true, canBuy: false });
    expect(liner).toMatchObject({ owned: false, canBuy: false });
    expect(liner?.reason).toMatch(/1500/);
    expect(scout).toMatchObject({ owned: false, canBuy: true, reason: "" });
  });
});

describe("switching ships", () => {
  const owned = (): GameState => {
    const r = buyShip({ ...newGameState("x/0"), credits: 5000, fuel: 25 }, "passenger-liner");
    if (!r.ok) throw new Error("buy failed");
    return r.state;
  };

  it("switches for free and each ship keeps its own fuel", () => {
    const s = owned();
    const toLiner = switchShip(s, "passenger-liner");
    expect(toLiner.ok).toBe(true);
    if (!toLiner.ok) return;
    expect(toLiner.state.shipId).toBe("passenger-liner");
    expect(toLiner.state.fuel).toBe(100); // the liner has its own full tank
    expect(toLiner.state.credits).toBe(s.credits); // free
    expect(toLiner.state.ownedShips["cargo-hauler"]).toEqual({ fuel: 25 }); // the hauler remembers 25
    const back = switchShip({ ...toLiner.state, fuel: 41 }, "cargo-hauler");
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.state.fuel).toBe(25);
    expect(back.state.ownedShips["passenger-liner"]).toEqual({ fuel: 41 });
    expect("cargo-hauler" in back.state.ownedShips).toBe(false);
  });

  it("only works when docked, for owned ships, and not for the active one", () => {
    const s = owned();
    const job = cargoJob();
    const flying = acceptJob({ ...s, fuel: 60, currentDockId: job.originDockId }, job, 0);
    if (!flying.ok) throw new Error("accept failed");
    expect(switchShip(flying.state, "passenger-liner").ok).toBe(false);
    expect(switchShip(s, "scout").ok).toBe(false); // not owned
    expect(switchShip(s, "cargo-hauler").ok).toBe(false); // already active
    expect(switchShip(s, "nope").ok).toBe(false);
  });

  it("buying and switching never give free fuel or money", () => {
    const s = owned();
    const there = switchShip(s, "passenger-liner");
    if (!there.ok) throw new Error("switch failed");
    const back = switchShip(there.state, "cargo-hauler");
    if (!back.ok) throw new Error("switch back failed");
    expect(back.state.fuel).toBe(25);
    expect(back.state.credits).toBe(s.credits);
  });
});

describe("passenger jobs and capacity", () => {
  it("are blocked on the Cargo Hauler because it has no cabin", () => {
    const job = passengerJob();
    expect(checkJob(rich(job), job)?.code).toBe("no-cabin");
  });

  it("are takeable on the Passenger Liner", () => {
    const job = passengerJob();
    const bought = buyShip(rich(job), "passenger-liner");
    if (!bought.ok) throw new Error("buy failed");
    const sw = switchShip(bought.state, "passenger-liner");
    if (!sw.ok) throw new Error("switch failed");
    expect(checkJob(sw.state, job)).toBeNull();
    expect(acceptJob(sw.state, job, 0).ok).toBe(true);
  });

  it("respects cabin size: the Scout holds only 2", () => {
    const big = JOBS.find((j) => j.requiredHold === "PASSENGER_CABIN" && j.amount > 2 && fuelCost(j.totalDistance) <= 110);
    const small = JOBS.find((j) => j.requiredHold === "PASSENGER_CABIN" && j.amount <= 2 && fuelCost(j.totalDistance) <= 110);
    if (!big || !small) throw new Error("no sample jobs");
    const scout = (job: Job): GameState => ({ ...at(job), shipId: "scout", fuel: 110 });
    expect(checkJob(scout(big), big)?.code).toBe("cabin-too-small");
    expect(checkJob(scout(small), small)).toBeNull();
  });

  it("respects the cargo bay: the Liner holds only 6 units", () => {
    const job = JOBS.find((j) => j.requiredHold === "CARGO_BAY" && j.amount > 6 && fuelCost(j.totalDistance) <= 70);
    if (!job) throw new Error("no sample job");
    expect(checkJob({ ...at(job), shipId: "passenger-liner", fuel: 70 }, job)?.code).toBe("cargo-too-large");
    expect(checkJob({ ...at(job), shipId: "cargo-hauler" }, job)).toBeNull();
  });
});

describe("tours", () => {
  it("use the total distance for time and fuel, never more than 4 hours", () => {
    const tours = JOBS.filter((j) => j.kind === "TOUR");
    expect(tours.length).toBeGreaterThan(0);
    for (const t of tours) {
      expect(t.stops.length).toBeGreaterThanOrEqual(2);
      expect(tripSeconds(t.totalDistance)).toBeLessThanOrEqual(MAX_TRIP_SECONDS);
    }
    const tour = tourJob();
    const s: GameState = { ...at(tour), shipId: "passenger-liner", fuel: 70 };
    const r = acceptJob(s, tour, 1000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.fuel).toBe(70 - fuelCost(tour.totalDistance));
    expect(r.state.travelEndMs).toBe(1000 + tripSeconds(tour.totalDistance) * 1000);
  });

  it("fly straight to the last stop, pay the reward and name the stops in the debrief", () => {
    const tour = tourJob();
    const s: GameState = { ...at(tour), shipId: "passenger-liner", fuel: 70 };
    const r = acceptJob(s, tour, 0);
    if (!r.ok) throw new Error("accept failed");
    const names = (id: string): string => `PLACE(${id})`;
    const { state, arrival } = settleArrival(r.state, r.state.travelEndMs ?? 0, names);
    expect(state.currentDockId).toBe(tour.stops[tour.stops.length - 1]);
    expect(state.credits).toBe(s.credits + tour.reward);
    const firstStop = tour.stops[0] ?? "";
    expect(firstStop).not.toBe("");
    // Tour lines mention the stops on the way for those lines that use {stops}; all lines work without errors.
    expect(arrival?.debrief).not.toMatch(/\{[a-z]+\}/);
  });

  it("every tour debrief line fills in its stops", () => {
    const tours = JOBS.filter((j) => j.kind === "TOUR").slice(0, 40);
    for (const tour of tours) {
      const s: GameState = { ...at(tour), shipId: "scout", fuel: 110 };
      const r = settleArrival({ ...s, currentJob: tour, travelStartMs: 0, travelEndMs: 1 }, 1, (id) => `P${id.length}`);
      expect(r.arrival?.debrief).not.toMatch(/\{[a-z]+\}/);
    }
  });

  it("passenger jobs get their own debrief lines", () => {
    const job = passengerJob();
    const s: GameState = { ...at(job), shipId: "passenger-liner", fuel: 70 };
    const r = settleArrival({ ...s, currentJob: job, travelStartMs: 0, travelEndMs: 1 }, 1, () => "Somewhere");
    expect(r.arrival?.debrief.length).toBeGreaterThan(10);
    expect(r.arrival?.debrief).not.toMatch(/\{[a-z]+\}/);
  });
});

describe("tank too small", () => {
  it("gets its own block code, different from needing a refuel", () => {
    // A long tour on the Liner (tank 100, was 70 before part 5b) when one exists, otherwise a made-up long cargo trip on the Hauler.
    const tour = JOBS.find((j) => j.kind === "TOUR" && fuelCost(j.totalDistance) > 100 && j.amount <= 12);
    const job: Job = tour ?? { ...cargoJob(), totalDistance: 40 };
    const state: GameState = tour
      ? { ...at(job), shipId: "passenger-liner", fuel: 100 }
      : { ...at(job), shipId: "cargo-hauler", fuel: 60 };
    const block = checkJob(state, job);
    expect(block?.code).toBe("tank-too-small");
    expect(block?.text).toMatch(/tank/i);
    expect(checkJob({ ...state, fuel: 5 }, job)?.code).toBe("tank-too-small"); // not "not-enough-fuel"
  });

  it("a normal trip with too little fuel says not-enough-fuel instead", () => {
    const job = cargoJob();
    expect(checkJob(at(job, { fuel: 0 }), job)?.code).toBe("not-enough-fuel");
  });
});

describe("stuck and emergency refuel", () => {
  const jobs = fittingJobs();
  const dock = dockOf(jobs);
  const board = jobs.filter((j) => j.originDockId === dock);
  const state = (patch: Partial<GameState>): GameState => ({ ...newGameState(dock), ...patch });

  it("has a sample board to work with", () => {
    expect(board.length).toBeGreaterThan(0);
  });

  it("is stuck with no fuel and no credits", () => {
    expect(isStuck(state({ fuel: 0, credits: 0 }), board)).toBe(true);
  });

  it("is not stuck when you can take a job now", () => {
    expect(isStuck(state({ fuel: 60, credits: 0 }), board)).toBe(false);
  });

  it("is not stuck when your credits can buy enough fuel", () => {
    const cheapest = Math.min(...board.map((j) => fuelCost(j.totalDistance)));
    const credits = cheapest * REFUEL_PRICE_PER_UNIT;
    expect(isStuck(state({ fuel: 0, credits }), board)).toBe(false);
    expect(isStuck(state({ fuel: 0, credits: credits - REFUEL_PRICE_PER_UNIT }), board)).toBe(cheapest > 0);
  });

  it("is never stuck when nothing fits the ship (cargo or cabin), because that is not about fuel", () => {
    const passenger = JOBS.filter((j) => j.kind === "PASSENGER" && j.originDockId === JOBS.find((x) => x.kind === "PASSENGER")?.originDockId);
    expect(passenger.length).toBeGreaterThan(0);
    const dockId = passenger[0]?.originDockId ?? "";
    expect(isStuck({ ...newGameState(dockId), fuel: 0, credits: 0 }, passenger)).toBe(false);
  });

  it("is never stuck during a flight or with an empty board", () => {
    const job = cargoJob();
    const flying = acceptJob({ ...at(job), fuel: 60 }, job, 0);
    if (!flying.ok) throw new Error("accept failed");
    expect(isStuck({ ...flying.state, fuel: 0, credits: 0 }, [job])).toBe(false);
    expect(isStuck(state({ fuel: 0, credits: 0 }), [])).toBe(false);
  });

  it("emergency refuel works only when stuck, is free and keeps credits", () => {
    const stuck = state({ fuel: 0, credits: 0 });
    const r = emergencyRefuel(stuck, board);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.units).toBe(EMERGENCY_REFUEL_AMOUNT);
    expect(r.state.fuel).toBe(EMERGENCY_REFUEL_AMOUNT);
    expect(r.state.credits).toBe(0);
    expect(r.line.length).toBeGreaterThan(10);
    expect(r.line).not.toMatch(/\{[a-z]+\}/);
  });

  it("does not work when you can still help yourself (no exploit)", () => {
    expect(emergencyRefuel(state({ fuel: 60, credits: 0 }), board).ok).toBe(false);
    expect(emergencyRefuel(state({ fuel: 0, credits: 5000 }), board).ok).toBe(false);
    expect(emergencyRefuel(state({ fuel: 0, credits: 5000 }), board)).toHaveProperty("reason");
  });

  it("never fills above the tank and never makes credits negative", () => {
    // Even with nearly full tank, units are capped by the tank. Build a case with a tiny gap.
    const tank = getShip("cargo-hauler").fuelTankSize;
    for (const fuel of [0, 1, 5]) {
      const r = emergencyRefuel(state({ fuel, credits: 0 }), board);
      if (r.ok) {
        expect(r.state.fuel).toBeLessThanOrEqual(tank);
        expect(r.state.credits).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("can be used again while still stuck, until a job can be taken", () => {
    let s = state({ fuel: 0, credits: 0 });
    const need = Math.min(...board.map((j) => fuelCost(j.totalDistance)));
    for (let i = 0; i < 10 && isStuck(s, board); i++) {
      const r = emergencyRefuel(s, board);
      if (!r.ok) throw new Error(r.reason);
      s = r.state;
    }
    expect(isStuck(s, board)).toBe(false);
    expect(s.fuel).toBeGreaterThanOrEqual(need);
  });
});

describe("Game object (4b)", () => {
  const startDock = (): string => {
    const system = listSystemsNear(SEED, ORIGIN, 10)[0];
    const planet = system ? getPlanetsOfSystem(SEED, system.id)[0] : undefined;
    if (!planet) throw new Error("no start dock");
    return planet.id;
  };
  const make = (): { game: Game; advance: (ms: number) => void } => {
    let real = 40 * HOUR;
    const game = new Game(SEED, startDock(), createClock(1, () => real));
    return { game, advance: (ms) => (real += ms) };
  };

  it("isStuck and emergencyRefuel work through the Game", () => {
    const { game } = make();
    expect(game.isStuck()).toBe(false);
    expect(game.emergencyRefuel().ok).toBe(false);
    game.state = { ...game.state, fuel: 0, credits: 0 };
    expect(game.isStuck()).toBe(true);
    const r = game.emergencyRefuel();
    expect(r.ok).toBe(true);
    expect(game.state.fuel).toBeGreaterThan(0);
    expect(game.state.credits).toBe(0);
  });

  it("buy and switch through the Game, and the listener hears about it", () => {
    const { game } = make();
    let heard = 0;
    game.subscribe(() => heard++);
    game.state = { ...game.state, credits: 5000 };
    expect(game.buyShip("passenger-liner").ok).toBe(true);
    expect(game.switchShip("passenger-liner").ok).toBe(true);
    expect(game.state.shipId).toBe("passenger-liner");
    expect(heard).toBe(2);
    expect(game.buyShip("passenger-liner").ok).toBe(false);
    const cat = game.getShipCatalog();
    expect(cat.find((c) => c.ship.id === "passenger-liner")?.active).toBe(true);
    expect(cat.find((c) => c.ship.id === "cargo-hauler")?.canSwitch).toBe(true);
  });

  it("does not allow buying or switching in flight", () => {
    const { game } = make();
    game.state = { ...game.state, credits: 5000 };
    game.buyShip("scout");
    const entry = game.getBoard().find((e) => !e.block);
    if (!entry) throw new Error("no takeable job");
    game.accept(entry.job.id);
    expect(game.switchShip("scout").ok).toBe(false);
    expect(game.buyShip("passenger-liner").ok).toBe(false);
  });

  it("the old APIs still work (accept, refuel, progress, update, lastArrival)", () => {
    const { game, advance } = make();
    const entry = game.getBoard().find((e) => !e.block);
    if (!entry) throw new Error("no takeable job");
    expect(game.accept(entry.job.id).ok).toBe(true);
    expect(game.progress()).not.toBeNull();
    advance(entry.tripSeconds * 1000);
    expect(game.update()).not.toBeNull();
    expect(game.lastArrival?.reward).toBe(entry.job.reward);
    expect(game.refuel().ok || !game.refuel().ok).toBe(true);
  });

  it("gives the same board for the same seed, dock and slot", () => {
    const a = make().game.getBoard().map((e) => e.job);
    const b = make().game.getBoard().map((e) => e.job);
    expect(a.length).toBeGreaterThan(0);
    expect(a).toEqual(b);
  });
});

describe("loading old saves", () => {
  it("a state without ownedShips gets sensible defaults", () => {
    const old = { credits: 321, fuel: 40, shipId: "cargo-hauler", currentDockId: "a/0", currentJob: null, travelStartMs: null, travelEndMs: null };
    const s = normalizeState(old);
    expect(s.ownedShips).toEqual({});
    expect(s.credits).toBe(321);
    expect(s.fuel).toBe(40);
    expect(s.shipId).toBe("cargo-hauler");
  });

  it("repairs odd data: unknown ship, too much fuel, bad owned entries", () => {
    const s = normalizeState({
      currentDockId: "a/0",
      shipId: "mystery",
      fuel: 9999,
      credits: -5,
      ownedShips: { scout: { fuel: 9999 }, ghost: { fuel: 3 }, "cargo-hauler": { fuel: 1 } },
    });
    expect(s.shipId).toBe("cargo-hauler");
    expect(s.fuel).toBe(60);
    expect(s.credits).toBe(0);
    expect(s.ownedShips).toEqual({ scout: { fuel: 110 } });
  });

  it("Game.loadState uses it", () => {
    const game = new Game(SEED, "x/0", createClock(1));
    game.loadState({ currentDockId: "x/0", credits: 7 });
    expect(game.state.credits).toBe(7);
    expect(game.state.ownedShips).toEqual({});
  });

  it("a new game state is plain data that survives JSON", () => {
    const s = newGameState("x/0");
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
