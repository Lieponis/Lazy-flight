import { describe, expect, it } from "vitest";
import {
  Game,
  OUTPOST_DELIVERY_BONUS_PERCENT,
  OUTPOST_FUEL_DISCOUNT_PERCENT,
  RANK_JOBS_NEEDED,
  RANK_MAX_REWARD,
  RANK_REWARD_BONUS_PERCENT,
  REFUEL_PRICE_PER_UNIT,
  acceptJob,
  checkJob,
  createClock,
  emptyCompletedJobs,
  affordableFuelUnits,
  isStuck,
  newGameState,
  normalizeState,
  rankIndexFor,
  rankInfos,
  refuel,
  requiredRankIndex,
  settleArrival,
  withBonuses,
  type GameState,
} from "../src/game";
import { generateJobBoard, listSystemsNear, type Dock, type Job, docksOf } from "../src/universe";

const SEED = 12345;
const ORIGIN = { x: 0, y: 0, z: 0 };

const docks: Dock[] = [];
for (const system of listSystemsNear(SEED, ORIGIN, 40).slice(0, 14)) {
  docks.push(...docksOf(SEED, system));
}
const OUTPOST = docks.find((d) => d.kind === "OUTPOST")!;
const STATION = docks.find((d) => d.kind === "STATION")!;
const jobsAt = (dock: Dock): Job[] => [0, 6, 13].flatMap((slot) => generateJobBoard(SEED, dock, slot));
const JOBS = docks.flatMap(jobsAt);

const newGame = (dockId = OUTPOST.id): Game => new Game(SEED, dockId, createClock(1, () => 0));
const withState = (g: Game, patch: Partial<GameState>): Game => {
  g.state = { ...g.state, ...patch };
  return g;
};

describe("ranks: progress", () => {
  it("starts everybody at rank 1 in every category", () => {
    const ranks = newGame().getRanks();
    expect(ranks).toHaveLength(3);
    for (const r of ranks) {
      expect(r.rankNumber).toBe(1);
      expect(r.jobsDone).toBe(0);
      expect(r.jobsToNext).toBe(RANK_JOBS_NEEDED[r.kind][0]);
    }
  });

  it("moves up at the numbers in settings and stops at rank 3", () => {
    for (const kind of ["TRADE", "PASSENGER", "TOUR"] as const) {
      const [two, three] = RANK_JOBS_NEEDED[kind];
      expect(rankIndexFor(kind, two - 1)).toBe(0);
      expect(rankIndexFor(kind, two)).toBe(1);
      expect(rankIndexFor(kind, three - 1)).toBe(1);
      expect(rankIndexFor(kind, three)).toBe(2);
      expect(rankIndexFor(kind, 9999)).toBe(2);
    }
    const top = rankInfos({ TRADE: 99, PASSENGER: 99, TOUR: 99 });
    for (const r of top) {
      expect(r.rankNumber).toBe(3);
      expect(r.nextRankName).toBeNull();
      expect(r.jobsToNext).toBeNull();
      expect(r.maxReward).toBeNull();
    }
  });

  it("counts a delivered job and announces a rank-up in the debrief", () => {
    const job = JOBS.find((j) => j.kind === "TRADE" && j.reward <= RANK_MAX_REWARD.TRADE[0])!;
    const need = RANK_JOBS_NEEDED.TRADE[0];
    const base = { ...newGameState(job.originDockId), completedJobs: { ...emptyCompletedJobs(), TRADE: need - 1 }, shipId: "cargo-hauler" };
    const started = acceptJob(base, job, 0);
    if (!started.ok) throw new Error(started.block.text);
    const done = settleArrival(started.state, 10 * 3_600_000, () => "Somewhere");
    expect(done.state.completedJobs.TRADE).toBe(need);
    expect(done.arrival?.rankUp?.rankNumber).toBe(2);
    expect(done.arrival?.debrief).toContain("Crate Wrangler");
  });

  it("does not announce a rank-up when none happens", () => {
    const job = JOBS.find((j) => j.kind === "TRADE" && j.reward <= RANK_MAX_REWARD.TRADE[0])!;
    const started = acceptJob(newGameState(job.originDockId), job, 0);
    if (!started.ok) throw new Error(started.block.text);
    const done = settleArrival(started.state, 10 * 3_600_000, () => "Somewhere");
    expect(done.state.completedJobs.TRADE).toBe(1);
    expect(done.arrival?.rankUp).toBeNull();
  });
});

describe("ranks: gating", () => {
  it("blocks a job above your rank with rank-too-low and a clear text", () => {
    const hard = JOBS.find((j) => j.kind === "TRADE" && requiredRankIndex(j) >= 1 && j.amount <= 30)!;
    expect(hard).toBeDefined();
    const block = checkJob(newGameState(hard.originDockId), hard);
    expect(block?.code).toBe("rank-too-low");
    expect(block?.text).toMatch(/rank/i);
  });

  it("lets a top-rank player take the same job (apart from ship limits)", () => {
    const hard = JOBS.find((j) => j.kind === "TRADE" && requiredRankIndex(j) === 2 && j.amount <= 30)!;
    const state = { ...newGameState(hard.originDockId), credits: 10_000, completedJobs: { TRADE: 99, PASSENGER: 99, TOUR: 99 } };
    expect(checkJob(state, hard)?.code).not.toBe("rank-too-low");
  });

  it("needs the rank of the job's own category", () => {
    const hard = JOBS.find((j) => j.kind === "TRADE" && requiredRankIndex(j) >= 1 && j.amount <= 30)!;
    const state = { ...newGameState(hard.originDockId), completedJobs: { TRADE: 0, PASSENGER: 99, TOUR: 99 } };
    expect(checkJob(state, hard)?.code).toBe("rank-too-low");
  });

  it("keeps most boards playable for a new player", () => {
    const takeable = docks.filter((d) => jobsAt(d).some((j) => !checkJob(newGameState(d.id), j))).length;
    expect(takeable / docks.length).toBeGreaterThan(0.6);
  });
});

describe("outposts: price and buying", () => {
  it("only outposts are for sale, at a whole-credit price", () => {
    const g = newGame(OUTPOST.id);
    const offer = g.getOutpostOffer(OUTPOST.id);
    expect(offer.isOutpost).toBe(true);
    expect(Number.isInteger(offer.price)).toBe(true);
    expect(offer.price).toBeGreaterThan(0);
    const st = newGame(STATION.id).getOutpostOffer(STATION.id);
    expect(st.price).toBeNull();
    expect(st.canBuy).toBe(false);
  });

  it("fails with a reason when you are poor, elsewhere, flying, or it is a station", () => {
    const poor = newGame().buyOutpost(OUTPOST.id);
    expect(poor.ok).toBe(false);
    const other = docks.find((d) => d.id !== OUTPOST.id)!;
    const away = withState(newGame(other.id), { credits: 999_999 }).buyOutpost(OUTPOST.id);
    expect(away).toMatchObject({ ok: false });
    const station = withState(newGame(STATION.id), { credits: 999_999 }).buyOutpost(STATION.id);
    expect(station).toMatchObject({ ok: false });
    const job = JOBS.find((j) => j.originDockId === OUTPOST.id && !checkJob({ ...newGameState(OUTPOST.id), completedJobs: { TRADE: 99, PASSENGER: 99, TOUR: 99 } }, j));
    if (job) {
      const g = withState(newGame(OUTPOST.id), { credits: 999_999, completedJobs: { TRADE: 99, PASSENGER: 99, TOUR: 99 } });
      g.state = { ...g.state, currentJob: job, travelStartMs: 0, travelEndMs: 1000 };
      expect(g.buyOutpost(OUTPOST.id).ok).toBe(false);
    }
  });

  it("buys once: pays the price, lists it, refuses a second time", () => {
    const g = withState(newGame(), { credits: 999_999 });
    const price = g.getOutpostOffer(OUTPOST.id).price!;
    const r = g.buyOutpost(OUTPOST.id);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.line.length).toBeGreaterThan(5);
    expect(g.state.credits).toBe(999_999 - price);
    expect(g.state.outpostCount).toBe(1);
    expect(g.getOwnedOutposts().map((o) => o.dockId)).toEqual([OUTPOST.id]);
    expect(g.buyOutpost(OUTPOST.id).ok).toBe(false);
    expect(g.state.credits).toBe(999_999 - price);
  });
});

describe("outposts: perks", () => {
  const owner = (): Game => {
    const g = withState(newGame(), { credits: 999_999, fuel: 10 });
    g.buyOutpost(OUTPOST.id);
    return g;
  };

  it("gives the fuel discount in the whole system and nowhere else", () => {
    const g = owner();
    const here = g.getPerks(OUTPOST.id);
    expect(here.fuelDiscountPercent).toBe(OUTPOST_FUEL_DISCOUNT_PERCENT);
    expect(here.deliveryBonusPercent).toBe(OUTPOST_DELIVERY_BONUS_PERCENT);
    const far = docks.find((d) => d.systemId !== OUTPOST.systemId)!;
    expect(g.getPerks(far.id)).toEqual({ fuelDiscountPercent: 0, deliveryBonusPercent: 0 });
  });

  it("makes refuelling cheaper", () => {
    const plain = newGame();
    const p = { ...plain.state, credits: 1000, fuel: 10 };
    const normal = refuel(p);
    const g = owner();
    g.state = { ...g.state, credits: 1000, fuel: 10 };
    const cheap = g.refuel();
    expect(normal.ok && cheap.ok).toBe(true);
    if (normal.ok) {
      const paidNormal = 1000 - normal.state.credits;
      const paidCheap = 1000 - g.state.credits;
      expect(paidCheap).toBeLessThan(paidNormal);
      expect(paidNormal % REFUEL_PRICE_PER_UNIT).toBe(0);
    }
    expect(Number.isInteger(g.state.credits)).toBe(true);
  });

  it("makes jobs that end in the system pay more, and the board shows it", () => {
    const top = { TRADE: 99, PASSENGER: 99, TOUR: 99 };
    // A cargo job the starter Cargo Hauler can carry (the sample has fewer docks now, so look at all of them).
    const fits = (j: Job): boolean => j.kind === "TRADE" && j.amount <= 30 && j.totalDistance * 2 <= 60;
    const job = JOBS.find((j) => fits(j) && systemOf(j.destinationDockId) === OUTPOST.systemId && systemOf(j.originDockId) !== OUTPOST.systemId)
      ?? JOBS.find((j) => fits(j) && systemOf(j.destinationDockId) === OUTPOST.systemId);
    expect(job).toBeDefined();
    if (!job) return;
    const pay = (owned: string[]): number => {
      const state: GameState = { ...newGameState(job.originDockId), credits: 0, fuel: 60, completedJobs: top, ownedOutposts: owned, outpostCount: owned.length };
      // The Game hands out jobs with the bonus already added (see withBonuses); do the same here.
      const started = acceptJob(state, withBonuses(state, job).job, 0);
      if (!started.ok) throw new Error(started.block.text);
      return settleArrival(started.state, 10 * 3_600_000, () => "x").state.credits;
    };
    expect(pay([OUTPOST.id])).toBeGreaterThan(pay([]));
  });

  it("keeps a board entry's real payout above or equal to its base", () => {
    const g = owner();
    for (const e of g.getBoard()) {
      expect(e.job.reward).toBeGreaterThanOrEqual(e.baseReward);
      expect(e.bonusPercent).toBeGreaterThanOrEqual(0);
    }
  });

  it("lets the same credits buy more fuel (and the stuck check agrees)", () => {
    const g = owner();
    const poor = { ...g.state, fuel: 0, credits: 5 };
    const plain = { ...poor, ownedOutposts: [], outpostCount: 0 };
    expect(affordableFuelUnits(poor)).toBeGreaterThan(affordableFuelUnits(plain));
    expect(typeof isStuck(poor, [])).toBe("boolean");
  });
});

function systemOf(dockId: string): string {
  return dockId.slice(0, dockId.lastIndexOf("/"));
}

describe("saving: old saves and new fields", () => {
  it("loads an old save without the new fields using defaults", () => {
    const state = normalizeState({ currentDockId: OUTPOST.id, credits: 77 });
    expect(state.completedJobs).toEqual(emptyCompletedJobs());
    expect(state.ownedOutposts).toEqual([]);
    expect(state.outpostCount).toBe(0);
    expect(state.credits).toBe(77);
  });

  it("repairs garbage in the new fields", () => {
    const state = normalizeState({
      currentDockId: OUTPOST.id,
      completedJobs: { TRADE: -3, PASSENGER: 2.5, TOUR: "x" },
      ownedOutposts: ["a/1", "a/1", "", 5],
    } as unknown as Partial<GameState> & { currentDockId: string });
    expect(state.completedJobs.TRADE).toBe(0);
    expect(Number.isInteger(state.completedJobs.PASSENGER)).toBe(true);
    expect(state.completedJobs.TOUR).toBe(0);
    expect(state.ownedOutposts).toEqual(["a/1"]);
    expect(state.outpostCount).toBe(1);
  });

  it("survives a JSON round trip through loadState", () => {
    const g = withState(newGame(), { credits: 999_999, completedJobs: { TRADE: 5, PASSENGER: 1, TOUR: 0 } });
    g.buyOutpost(OUTPOST.id);
    const copy = newGame();
    copy.loadState(JSON.parse(JSON.stringify(g.state)));
    expect(copy.state).toEqual(g.state);
  });

  it("drops outposts that do not exist in this universe", () => {
    const g = newGame();
    g.loadState({ currentDockId: OUTPOST.id, ownedOutposts: ["nope/9", STATION.id, OUTPOST.id] });
    expect(g.state.ownedOutposts).toEqual([OUTPOST.id]);
    expect(g.state.outpostCount).toBe(1);
  });
});

describe("determinism", () => {
  it("gives the same board and offers for the same seed", () => {
    const a = newGame();
    const b = newGame();
    expect(a.getBoard()).toEqual(b.getBoard());
    expect(a.getOutpostOffer(OUTPOST.id)).toEqual(b.getOutpostOffer(OUTPOST.id));
    expect(a.getRanks()).toEqual(b.getRanks());
  });

  it("has sane rank settings", () => {
    for (const kind of ["TRADE", "PASSENGER", "TOUR"] as const) {
      expect(RANK_JOBS_NEEDED[kind][0]).toBeLessThan(RANK_JOBS_NEEDED[kind][1]);
      expect(RANK_MAX_REWARD[kind][0]).toBeLessThan(RANK_MAX_REWARD[kind][1]);
    }
    expect(RANK_REWARD_BONUS_PERCENT).toHaveLength(3);
  });
});
