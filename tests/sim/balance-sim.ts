// BALANCE SIMULATOR (test-only, never shipped in the game).
// Plays automatic games with the REAL rules in src/game (the Game class, its board, refuel, ships, outposts,
// ranks and emergency fuel) on a fake clock at speed 1, and counts what happens.
//
// Run the full report:   npm run balance
// A small version runs in tests/balance-sim.test.ts as part of npm run check.

import { Game, createClock, fuelCost, getShip, type BoardEntry } from "../../src/game";
import { findStartSystem } from "../../src/render/start";
import { getPlanetsOfSystem, type Job } from "../../src/universe";
import { JOB_BOARD_REFRESH_SLOTS } from "../../src/universe/settings";

const HOUR = 3_600_000;
const MIN = 60_000;

export interface Strategy {
  name: string;
  /** Short plain-language description for the report. */
  about: string;
  /** Ms between arriving and coming back to the game (0 = at once). `n` = how many arrivals so far. */
  returnDelayMs(n: number): number;
  /** Ships the player is willing to fly (switching is free). */
  usesAllShips: boolean;
  /** Buy ships when affordable (in this order), keeping this reserve. Empty = never buys. */
  shipsToBuy: string[];
  /** Buy the first outpost seen when credits >= price + reserve. Null = never. */
  outpostReserve: number | null;
  /** Score of a job; the best one is taken. */
  score(entry: BoardEntry): number;
  /** Fill the tank before every job (lazy) or only when needed. */
  alwaysFillTank: boolean;
}

/** Thinking time per docked decision (open Jobs, read, tap Accept). */
const THINK_MS = 30_000;

export const STRATEGIES: Strategy[] = [
  {
    name: "sensible",
    about: "comes back when the ship lands; best pay per minute; buys Liner then Scout; buys the first outpost it can afford (keeps 500 cr)",
    returnDelayMs: () => 0,
    usesAllShips: true,
    shipsToBuy: ["passenger-liner", "scout"],
    outpostReserve: 500,
    score: (e) => (e.job.reward - e.fuelNeeded * 2) / (e.tripSeconds + 60),
    alwaysFillTank: false,
  },
  {
    name: "casual",
    about: "same choices as sensible, but comes back 0 to 3 hours after each landing (idle play)",
    returnDelayMs: (n) => ((n * 7919) % 181) * MIN,
    usesAllShips: true,
    shipsToBuy: ["passenger-liner", "scout"],
    outpostReserve: 500,
    score: (e) => (e.job.reward - e.fuelNeeded * 2) / (e.tripSeconds + 60),
    alwaysFillTank: false,
  },
  {
    name: "spender",
    about: "comes back when the ship lands; biggest reward; buys ships and outposts the moment it can (no reserve); refuels only when needed",
    returnDelayMs: () => 0,
    usesAllShips: true,
    shipsToBuy: ["scout", "passenger-liner"],
    outpostReserve: 0,
    score: (e) => e.job.reward,
    alwaysFillTank: false,
  },
  {
    name: "lazy",
    about: "comes back when the ship lands; always takes the biggest reward it can; fills the tank every time; never buys anything",
    returnDelayMs: () => 0,
    usesAllShips: false,
    shipsToBuy: [],
    outpostReserve: null,
    score: (e) => e.job.reward,
    alwaysFillTank: true,
  },
];

export interface RunResult {
  seed: number;
  strategy: string;
  hours: number;
  jobsDone: number;
  earned: number;
  creditsEnd: number;
  creditsPerHour: number;
  avgTripMin: number;
  avgReward: number;
  /** Hours until credits first reached 1200 / 1500. Null = never. */
  hoursTo1200: number | null;
  hoursTo1500: number | null;
  hoursToFirstShip: number | null;
  firstShip: string | null;
  hoursToOutpost: number | null;
  outpostPrice: number | null;
  /** Hours until rank 2 / rank 3 in each kind. */
  rankHours: Record<string, [number | null, number | null]>;
  /** Board entries seen at decision points (active ship), by block code ("ok" = takeable). */
  blocks: Record<string, number>;
  boardsSeen: number;
  /** Decision points where nothing at all could be taken (had to wait for a new board). */
  waits: number;
  waitHours: number;
  stuck: number;
  emergencyRefuels: number;
  /** A job already delivered showed up again and was taken (known issue). */
  repeatJobs: number;
  /** All TOUR jobs seen and how many need more fuel than the Liner tank. */
  toursSeen: number;
  toursTooFarForLiner: number;
  /** Board said "takeable" but Accept refused it (bug: bonus pay counted for the rank check). */
  acceptRefused: number;
  /** Docked decisions made at a surface outpost (only those can be bought), and their prices. */
  outpostVisits: number;
  outpostPricesSeen: number[];
  jobsToOutpost: number | null;
  /** Jobs delivered when credits first reached 1500. */
  jobsTo1500: number | null;
  /** Jobs taken by kind. */
  kinds: Record<string, number>;
}

function startDockOf(seed: number): string {
  const system = findStartSystem(seed);
  const dock = system ? getPlanetsOfSystem(seed, system.id)[0] : undefined;
  if (!dock) throw new Error(`No start dock for seed ${seed}`);
  return dock.id;
}

/** Can this entry be taken, possibly after buying fuel? */
function takeable(game: Game, entry: BoardEntry): boolean {
  if (!entry.block) return true;
  if (entry.block.code !== "not-enough-fuel") return false;
  const tank = getShip(game.state.shipId).fuelTankSize;
  const units = Math.floor(game.state.credits / 2); // close enough: discounts only make fuel cheaper
  return entry.fuelNeeded <= Math.min(tank, game.state.fuel + units);
}

/**
 * tripScale: WHAT-IF only. 1 = the real rules. 0.25 = every trip takes a quarter of the time
 * (as if TRAVEL_SECONDS_PER_LY were 4x smaller). Money per job does not change.
 */
export function simulate(seed: number, strategy: Strategy, hours: number, tripScale = 1): RunResult {
  let t = 1_000 * HOUR; // any start time; slots and boards follow from it
  const t0 = t;
  const end = t0 + hours * HOUR;
  const game = new Game(seed, startDockOf(seed), createClock(1, () => t));
  const hoursNow = (): number => (t - t0) / HOUR;

  const r: RunResult = {
    seed,
    strategy: strategy.name,
    hours,
    jobsDone: 0,
    earned: 0,
    creditsEnd: 0,
    creditsPerHour: 0,
    avgTripMin: 0,
    avgReward: 0,
    hoursTo1200: null,
    hoursTo1500: null,
    hoursToFirstShip: null,
    firstShip: null,
    hoursToOutpost: null,
    outpostPrice: null,
    rankHours: { TRADE: [null, null], PASSENGER: [null, null], TOUR: [null, null] },
    blocks: {},
    boardsSeen: 0,
    waits: 0,
    waitHours: 0,
    stuck: 0,
    emergencyRefuels: 0,
    repeatJobs: 0,
    toursSeen: 0,
    toursTooFarForLiner: 0,
    acceptRefused: 0,
    outpostVisits: 0,
    outpostPricesSeen: [],
    jobsToOutpost: null,
    jobsTo1500: null,
    kinds: { TRADE: 0, PASSENGER: 0, TOUR: 0 },
  };
  const refused = new Set<string>();
  const delivered = new Set<string>();
  const toursCounted = new Set<string>();
  let tripMinTotal = 0;
  let arrivals = 0;
  const linerTank = getShip("passenger-liner").fuelTankSize;

  const noteCredits = (): void => {
    const c = game.state.credits;
    if (r.hoursTo1200 === null && c >= 1200) r.hoursTo1200 = hoursNow();
    if (r.hoursTo1500 === null && c >= 1500) {
      r.hoursTo1500 = hoursNow();
      r.jobsTo1500 = r.jobsDone;
    }
  };

  while (t < end) {
    if (game.state.currentJob) {
      t = Math.max(t, game.state.travelEndMs ?? t);
      const arrival = game.update();
      if (arrival) {
        const job = arrival.job;
        r.jobsDone++;
        r.earned += job.reward;
        r.kinds[job.kind] = (r.kinds[job.kind] ?? 0) + 1;
        delivered.add(job.id);
        for (const kind of ["TRADE", "PASSENGER", "TOUR"] as const) {
          const rows = game.getRanks().find((x) => x.kind === kind);
          const pair = r.rankHours[kind]!;
          if (rows && rows.rankNumber >= 2 && pair[0] === null) pair[0] = hoursNow();
          if (rows && rows.rankNumber >= 3 && pair[1] === null) pair[1] = hoursNow();
        }
        noteCredits();
        arrivals++;
        t += strategy.returnDelayMs(arrivals);
      }
      continue;
    }

    t += THINK_MS;

    // Shopping: ships, then the first outpost.
    for (const id of strategy.shipsToBuy) {
      const entry = game.getShipCatalog().find((s) => s.ship.id === id);
      if (entry && !entry.owned && game.state.credits >= getShip(id).price + 300) {
        if (game.buyShip(id).ok && r.firstShip === null) {
          r.firstShip = id;
          r.hoursToFirstShip = hoursNow();
        }
      }
    }
    const here = game.getOutpostOffer(game.state.currentDockId);
    if (here.isOutpost && here.price !== null) {
      r.outpostVisits++;
      r.outpostPricesSeen.push(here.price);
    }
    if (strategy.outpostReserve !== null && (r.hoursToOutpost === null || strategy.outpostReserve === 0)) {
      const offer = here;
      if (offer.isOutpost && !offer.owned && offer.price !== null && game.state.credits >= offer.price + strategy.outpostReserve) {
        const bought = game.buyOutpost(game.state.currentDockId);
        if (bought.ok && r.hoursToOutpost === null) {
          r.hoursToOutpost = hoursNow();
          r.outpostPrice = bought.price;
          r.jobsToOutpost = r.jobsDone;
        }
      }
    }

    // Count what the board looks like with the active ship.
    const board = game.getBoard();
    r.boardsSeen++;
    for (const e of board) {
      const code = e.block ? e.block.code : "ok";
      r.blocks[code] = (r.blocks[code] ?? 0) + 1;
      if (e.job.kind === "TOUR" && !toursCounted.has(e.job.id)) {
        toursCounted.add(e.job.id);
        r.toursSeen++;
        if (fuelCost(e.job.totalDistance) > linerTank) r.toursTooFarForLiner++;
      }
    }

    // Pick the best (ship, job).
    const ships = strategy.usesAllShips ? Object.keys(game.state.ownedShips).concat(game.state.shipId) : [game.state.shipId];
    let best: { ship: string; job: Job; score: number; fuel: number } | null = null;
    const startShip = game.state.shipId;
    for (const ship of [...new Set(ships)]) {
      if (ship !== game.state.shipId && !game.switchShip(ship).ok) continue;
      for (const e of game.getBoard()) {
        if (!takeable(game, e) || refused.has(e.job.id)) continue;
        const s = strategy.score(e);
        if (!best || s > best.score) best = { ship, job: e.job, score: s, fuel: e.fuelNeeded };
      }
    }
    if (game.state.shipId !== startShip) game.switchShip(startShip);

    if (best) {
      if (game.state.shipId !== best.ship) game.switchShip(best.ship);
      if (strategy.alwaysFillTank || game.state.fuel < best.fuel) game.refuel();
      if (delivered.has(best.job.id)) r.repeatJobs++;
      const res = game.accept(best.job.id);
      if (!res.ok) {
        r.acceptRefused++;
        refused.add(best.job.id);
        t -= THINK_MS; // try the next best at once
        continue;
      }
      if (tripScale !== 1 && game.state.travelEndMs !== null && game.state.travelStartMs !== null) {
        const start = game.state.travelStartMs;
        game.state.travelEndMs = start + Math.max(20_000, (game.state.travelEndMs - start) * tripScale);
      }
      tripMinTotal += ((game.state.travelEndMs ?? t) - t) / MIN;
      continue;
    }

    if (game.isStuck()) {
      r.stuck++;
      if (game.emergencyRefuel().ok) {
        r.emergencyRefuels++;
        continue;
      }
    }

    // Nothing to take: wait for the next board (it changes every JOB_BOARD_REFRESH_SLOTS game hours).
    r.waits++;
    const period = JOB_BOARD_REFRESH_SLOTS * HOUR;
    const next = (Math.floor(t / period) + 1) * period;
    r.waitHours += (next - t) / HOUR;
    t = next;
  }

  r.creditsEnd = game.state.credits;
  r.creditsPerHour = r.earned / hours;
  r.avgTripMin = r.jobsDone ? tripMinTotal / r.jobsDone : 0;
  r.avgReward = r.jobsDone ? r.earned / r.jobsDone : 0;
  return r;
}
