// Agent 6b: balance simulator smoke test + regression tests for problems found in the QA pass.
import { describe, expect, it } from "vitest";
import { Game, createClock, newGameState, type GameState } from "../src/game";
import { RANK_MAX_REWARD } from "../src/game/settings";
import { getJobBoard, getPlanetsOfSystem, listSystemsNear, startDockOf, type Job } from "../src/universe";
import { STRATEGIES, simulate } from "./sim/balance-sim";

const SEED = 12345;
const startDock = (): string => startDockOf(SEED).id;

describe("balance simulator (smoke test; full report: npm run balance)", () => {
  it("every strategy plays 30 game hours without errors and earns money", () => {
    for (const s of STRATEGIES) {
      const r = simulate(SEED, s, 30);
      expect(r.jobsDone).toBeGreaterThan(3);
      expect(r.earned).toBeGreaterThan(1000);
      expect(r.creditsEnd).toBeGreaterThanOrEqual(0);
    }
  });

  it("players who keep a small reserve never get stuck; when the no-reserve spender does, emergency fuel always rescues it", () => {
    // Since upgrades (6c), the spender can spend down to nothing and get stuck now and then. That is what
    // emergency fuel is for: every stuck moment must end with a free refuel, never a dead end.
    for (const s of STRATEGIES)
      for (const seed of [SEED, 777, 999]) {
        const r = simulate(seed, s, 40);
        if (s.name !== "spender") expect(r.stuck).toBe(0);
        expect(r.emergencyRefuels).toBe(r.stuck);
      }
  });
});

describe("emergency fuel through normal rules", () => {
  // Finding 6b: in normal play you cannot get stuck. Tried here: every takeable first job, then spending
  // credits the normal ways (buy Scout, buy Liner, buy the outpost there). Never stuck: emergency fuel stays a
  // pure safety net (it is tested with forced states in tests/game4b.test.ts).
  it("one job and then spending your credits never leaves you stuck", () => {
    let tries = 0;
    for (const seed of [SEED, 777]) {
      const start = startDockOf(seed).id;
      for (let h = 0; h < 120; h += 6) {
        const t = { n: h * 3_600_000 };
        const game = new Game(seed, start, createClock(1, () => t.n));
        for (const e of game.getBoard().filter((x) => !x.block)) {
          game.loadState(newGameState(start));
          t.n = h * 3_600_000;
          if (!game.accept(e.job.id).ok) continue;
          t.n = game.state.travelEndMs!;
          game.update();
          const after: GameState = JSON.parse(JSON.stringify(game.state));
          for (const spend of [() => {}, () => game.buyShip("scout"), () => game.buyShip("passenger-liner"), () => game.buyOutpost(game.state.currentDockId)]) {
            game.loadState(after);
            spend();
            tries++;
            expect(game.isStuck()).toBe(false);
          }
        }
      }
    }
    expect(tries).toBeGreaterThan(200);
  });
});

// ------------------------------------------------------------ BUG 6b-1 (src/game, fixed with the Lead's OK)
// The board says a job can be taken, but ACCEPT refuses it with "Needs rank ...".
// Cause: Game.accept() checks the job WITH the rank/outpost pay bonus added, and the rank limit is then
// compared with the bigger reward. A job just under a rank limit is pushed over it by your own bonus.
function jobJustUnderLimit(): Job | null {
  const limit = RANK_MAX_REWARD.TRADE[1]; // rank 2 may take cargo jobs up to this reward
  for (const system of listSystemsNear(SEED, { x: 0, y: 0, z: 0 }, 35)) {
    for (const planet of getPlanetsOfSystem(SEED, system.id)) {
      for (let slot = 0; slot < 60; slot += 6) {
        for (const job of getJobBoard(SEED, planet.id, slot) ?? []) {
          if (job.kind === "TRADE" && job.amount <= 30 && job.reward <= limit && job.reward * 1.05 > limit && job.totalDistance <= 25) {
            return job;
          }
        }
      }
    }
  }
  return null;
}

describe("BUG 6b-1: rank bonus pushes a job over the rank limit at Accept", () => {
  const job = jobJustUnderLimit();
  const setup = (): Game => {
    const game = new Game(SEED, job!.originDockId, createClock(1, () => 0));
    const state: GameState = { ...newGameState(job!.originDockId), fuel: 60, credits: 500 };
    state.completedJobs = { TRADE: 4, PASSENGER: 0, TOUR: 0 }; // cargo rank 2: +5% pay
    game.loadState(state);
    return game;
  };

  it("such a job exists in seed 12345 (so players can meet it)", () => {
    expect(job).not.toBeNull();
  });

  it("the board shows it as takeable", () => {
    // Boards depend on the slot; the clock above is at 0, so look the job up by id via the same slot.
    const game = setup();
    const slot = Number(job!.id.split("#")[1]) * 6;
    game.clock.now = () => slot * 3_600_000;
    const entry = game.getBoard().find((e) => e.job.id === job!.id);
    expect(entry?.block).toBeNull();
  });

  // Fixed in Game.accept (Lead approved): the job is checked without bonuses; the bonus is still paid on arrival.
  it("ACCEPT takes it, and the arrival still pays the bonus", () => {
    const game = setup();
    const slot = Number(job!.id.split("#")[1]) * 6;
    game.clock.now = () => slot * 3_600_000;
    expect(game.accept(job!.id).ok).toBe(true);
    const credits = game.state.credits;
    game.clock.now = () => game.state.travelEndMs!;
    const arrival = game.update();
    expect(arrival?.reward).toBe(Math.round(job!.reward * 1.05)); // +5% at cargo rank 2
    expect(game.state.credits).toBe(credits + Math.round(job!.reward * 1.05));
  });
});

// ------------------------------------------------------------ BUG 6b-2 (src/game, fixed with the Lead's OK)
// With short trips, a delivered job came back on the board (and paid again) when you returned to the same dock
// within the same board period. Now delivered jobs are hidden for the rest of that period.
describe("BUG 6b-2: a delivered job does not come back in the same board period", () => {
  const HOUR = 3_600_000;
  const play = () => {
    const t = { now: 100 * HOUR }; // start of a board period (periods are 6 game hours)
    const game = new Game(SEED, startDock(), createClock(1, () => t.now));
    const entry = game.getBoard().find((e) => !e.block)!;
    game.accept(entry.job.id);
    t.now = game.state.travelEndMs!;
    game.update();
    return { t, game, job: entry.job };
  };

  it("back at the same dock in the same period: the job is gone from the board and cannot be accepted", () => {
    const { game, job } = play();
    expect(game.state.deliveredJobIds).toContain(job.id);
    game.loadState({ ...game.state, currentDockId: job.originDockId }); // back at the start (same period)
    expect(game.getBoard().map((e) => e.job.id)).not.toContain(job.id);
    expect(game.accept(job.id).ok).toBe(false);
  });

  it("the other jobs of that board are still there", () => {
    const { game, job } = play();
    game.loadState({ ...game.state, currentDockId: job.originDockId });
    const all = getJobBoard(SEED, job.originDockId, game.currentSlot())!;
    expect(game.getBoard().length).toBe(all.length - 1);
  });

  it("ids from older periods are forgotten on the next arrival (the list stays short)", () => {
    const { t, game, job } = play();
    t.now += 24 * HOUR; // a few periods later
    game.loadState({ ...game.state, currentDockId: job.destinationDockId });
    const next = game.getBoard().find((e) => !e.block);
    if (!next) return;
    game.refuel();
    game.accept(next.job.id);
    t.now = game.state.travelEndMs!;
    game.update();
    expect(game.state.deliveredJobIds).toEqual([next.job.id]);
  });

  it("old saves without the list load fine", () => {
    const old = newGameState(startDock()) as Partial<GameState>;
    delete old.deliveredJobIds;
    const game = new Game(SEED, startDock(), createClock(1, () => 0));
    game.loadState(old as GameState);
    expect(game.state.deliveredJobIds).toEqual([]);
  });

  it("the simulator never sees a repeat job any more", () => {
    for (const s of STRATEGIES) expect(simulate(SEED, s, 30).repeatJobs).toBe(0);
  });
});
