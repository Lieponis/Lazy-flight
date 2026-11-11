// The game rules as plain functions. Each takes the state (and the time) and gives back a NEW state.
// No drawing, no clock, no browser in here, so everything is easy to test.

import {
  DEBRIEF_LINES,
  EMERGENCY_LINES,
  PASSENGER_DEBRIEF_LINES,
  RANK_UP_LINES,
  TOUR_DEBRIEF_LINES,
} from "./debriefs";
import { NO_DISCOVERY, recordArrival, type Discovery, type ExplorerRankUp } from "./explore";
import { notDockedReason } from "./location";
import { deliveryBonusPercentAt, fuelDiscountPercentAt } from "./outposts";
import { RANK_KIND_LABELS, RANK_NAMES, isRankKind, rankBonusPercent, rankIndexFor, requiredRankIndex, type RankKind } from "./ranks";
import {
  EMERGENCY_REFUEL_AMOUNT,
  FUEL_PER_LY,
  MAX_TRIP_SECONDS,
  MIN_FUEL_PER_TRIP,
  REFUEL_PRICE_PER_UNIT,
  SAME_SYSTEM_TRIP_SECONDS,
  TRAVEL_SECONDS_PER_LY,
} from "./settings";
import { shipStats } from "./upgrades";
import type { GameState } from "./state";
import { boardPeriodOf, hashString, type Job } from "../universe";
import { slotOf } from "./clock";
import { MAX_DELIVERED_IDS } from "./state";

// ------------------------------------------------------------ distance -> time and fuel

/** Seconds a trip of this many light years takes. Never more than MAX_TRIP_SECONDS (4 hours). */
export function tripSeconds(distanceLy: number): number {
  const d = Math.max(0, Number.isFinite(distanceLy) ? distanceLy : 0);
  const seconds = SAME_SYSTEM_TRIP_SECONDS + d * TRAVEL_SECONDS_PER_LY;
  return Math.min(Math.round(seconds), MAX_TRIP_SECONDS);
}

/**
 * Whole units of fuel a trip of this many light years burns. Grows with distance.
 * `burnPercent` is 100 for a ship without engine upgrades (see tripFuelCost for the real ship).
 */
export function fuelCost(distanceLy: number, burnPercent = 100): number {
  const d = Math.max(0, Number.isFinite(distanceLy) ? distanceLy : 0);
  const exact = burnPercent === 100 ? d * FUEL_PER_LY : (d * FUEL_PER_LY * burnPercent) / 100;
  // The tiny subtraction stops a number like 12.000000000000002 from rounding up to 13.
  return Math.max(MIN_FUEL_PER_TRIP, Math.ceil(burnPercent === 100 ? exact : exact - 1e-9));
}

/** The fuel this trip burns for the ACTIVE ship (efficient engines burn less). */
export function tripFuelCost(state: GameState, distanceLy: number): number {
  return fuelCost(distanceLy, shipStats(state).fuelBurnPercent);
}

// ------------------------------------------------------------ can the player take a job?

export type BlockCode =
  | "busy"
  | "wrong-dock"
  | "no-cabin"
  | "cabin-too-small"
  | "cargo-too-large"
  | "tank-too-small"
  | "not-enough-fuel";

/**
 * Block codes added after 4b. Kept apart from BlockCode so the menus (which list every BlockCode) keep compiling;
 * unknown codes show as "Not available" plus the game's own text until Agent 5 adds a short wording.
 */
export type ExtraBlockCode = "rank-too-low";

export interface Block {
  code: BlockCode | ExtraBlockCode;
  /** Plain-language reason to show the player. */
  text: string;
}

/** Null if the player can take the job right now, otherwise the reason it is blocked. */
export function checkJob(state: GameState, job: Job): Block | null {
  const ship = shipStats(state); // the real numbers: shipyard values plus upgrades
  if (state.currentJob) return { code: "busy", text: "You already have a job. Finish it first." };
  const away = notDockedReason(state);
  if (away !== null) return { code: state.freeTrip ? "busy" : "wrong-dock", text: away };
  if (job.originDockId !== state.currentDockId) return { code: "wrong-dock", text: "This job is from another dock." };

  if (job.requiredHold === "PASSENGER_CABIN") {
    if (ship.cabinCapacity <= 0) return { code: "no-cabin", text: "Needs a passenger cabin (your ship has none)." };
    if (job.amount > ship.cabinCapacity) {
      return { code: "cabin-too-small", text: `Too many passengers: ${job.amount}, your cabin holds ${ship.cabinCapacity}.` };
    }
  } else if (job.amount > ship.cargoCapacity) {
    return { code: "cargo-too-large", text: `Cargo too large: ${job.amount} units, your bay holds ${ship.cargoCapacity}.` };
  }

  // Better-paying jobs need a higher rank in that kind of job.
  if (isRankKind(job.kind)) {
    const needed = requiredRankIndex(job);
    const have = rankIndexFor(job.kind, state.completedJobs[job.kind]);
    if (have < needed) {
      const names = RANK_NAMES[job.kind];
      return {
        code: "rank-too-low",
        text: `Needs rank ${names[needed]} in ${RANK_KIND_LABELS[job.kind]} (you are ${names[have]}).`,
      };
    }
  }

  const need = tripFuelCost(state, job.totalDistance);
  if (need > ship.fuelTankSize) {
    return { code: "tank-too-small", text: `Too far for this ship's tank: needs ${need} fuel, the tank holds ${ship.fuelTankSize}.` };
  }
  if (need > state.fuel) {
    return { code: "not-enough-fuel", text: `Not enough fuel: needs ${need}, you have ${state.fuel}. Refuel first.` };
  }
  return null;
}

// ------------------------------------------------------------ pay bonuses (rank and outpost)

export interface PayInfo {
  /** The job with its reward already including the bonuses (this is what you will be paid). */
  job: Job;
  /** The reward before any bonus. */
  baseReward: number;
  /** Total bonus in percent (rank + outpost + passenger comfort), all added up and counted on the plain reward. */
  bonusPercent: number;
}

/**
 * What the player really gets paid for a job: the plain reward plus the rank bonus of that job kind,
 * plus the outpost bonus if the job ends in a system where the player owns an outpost,
 * plus the passenger-comfort bonus of the active ship (passenger and tour jobs only).
 * The three percents are ADDED, and the sum is taken of the plain reward (they never multiply each other).
 */
export function withBonuses(state: GameState, job: Job): PayInfo {
  const comfort = job.kind === "PASSENGER" || job.kind === "TOUR" ? shipStats(state).comfortBonusPercent : 0;
  const bonusPercent =
    rankBonusPercent(job.kind, state.completedJobs) + deliveryBonusPercentAt(state, job.destinationDockId) + comfort;
  if (bonusPercent <= 0) return { job, baseReward: job.reward, bonusPercent: 0 };
  return { job: { ...job, reward: Math.round(job.reward * (1 + bonusPercent / 100)) }, baseReward: job.reward, bonusPercent };
}

export type AcceptResult = { ok: true; state: GameState } | { ok: false; block: Block };

/** Accept a job: burns the fuel and sets the saved start and end times. Only one job at a time. */
export function acceptJob(state: GameState, job: Job, nowMs: number): AcceptResult {
  const block = checkJob(state, job);
  if (block) return { ok: false, block };
  return {
    ok: true,
    state: {
      ...state,
      fuel: state.fuel - tripFuelCost(state, job.totalDistance),
      currentJob: job,
      travelStartMs: nowMs,
      travelEndMs: nowMs + tripSeconds(job.totalDistance) * 1000,
    },
  };
}

// ------------------------------------------------------------ travelling and arriving

export interface TravelProgress {
  /** 0 at departure, 1 at arrival. */
  fraction: number;
  /** Game milliseconds left (never negative, never more than the whole trip). */
  remainingMs: number;
  totalMs: number;
}

/** Where the trip stands. Uses only the saved start and end, so a clock jump or pause is harmless. */
export function travelProgress(state: GameState, nowMs: number): TravelProgress | null {
  if ((!state.currentJob && !state.freeTrip) || state.travelStartMs === null || state.travelEndMs === null) return null;
  const totalMs = Math.max(1, state.travelEndMs - state.travelStartMs);
  const elapsed = Math.min(Math.max(nowMs - state.travelStartMs, 0), totalMs);
  return { fraction: elapsed / totalMs, remainingMs: totalMs - elapsed, totalMs };
}

export interface RankUp {
  kind: RankKind;
  /** The new rank, 2 or 3. */
  rankNumber: number;
  rankName: string;
}

export interface Arrival {
  job: Job;
  /** The job's pay. Discovery credits (if any) are paid on top and are NOT included here. */
  reward: number;
  /** Discovery credits paid for exploring a new star system with this arrival (0 = none). */
  discovery: number;
  /** True when this arrival explored a star system for the first time. */
  newSystem: boolean;
  /** True when this arrival reached a planet for the first time. */
  newPlanet: boolean;
  /** Set when this arrival raised the Explorer rank, otherwise null. */
  explorerRankUp: ExplorerRankUp | null;
  dockId: string;
  /** The funny line. When you ranked up with this delivery, the rank-up line is added at the end. */
  debrief: string;
  /** Set when this delivery raised a rank, otherwise null. */
  rankUp: RankUp | null;
}

/**
 * Picks the debrief line for a job (the same job always gets the same line). Goods, passenger and tour jobs
 * each have their own lines. `stopNames` = the stops before the last one (tours), as text.
 */
export function debriefFor(job: Job, placeName: string, stopNames = ""): string {
  const lines = job.kind === "TOUR" ? TOUR_DEBRIEF_LINES : job.kind === "PASSENGER" ? PASSENGER_DEBRIEF_LINES : DEBRIEF_LINES;
  const line = lines[hashString(job.id) % lines.length] ?? "Delivery complete.";
  return line
    .split("{item}").join(job.itemName)
    .split("{amount}").join(String(job.amount))
    .split("{place}").join(placeName)
    .split("{stops}").join(stopNames);
}

/**
 * If the end time has passed: pay the reward ONCE, move to the destination dock, clear the job.
 * Otherwise returns the same state and arrival = null.
 */
/** Job ids look like "<dock>#<board period>#<n>". The period, or -1 if the id has another shape. */
export function periodOfJobId(id: string): number {
  const part = id.split("#")[1];
  const n = part === undefined ? Number.NaN : Number(part);
  return Number.isInteger(n) ? n : -1;
}

/** The board's jobs without the ones you already delivered this board period. */
export function withoutDelivered(state: GameState, jobs: Job[]): Job[] {
  if (state.deliveredJobIds.length === 0) return jobs;
  const done = new Set(state.deliveredJobIds);
  return jobs.filter((j) => !done.has(j.id));
}

export function settleArrival(
  state: GameState,
  nowMs: number,
  placeNameOf: (dockId: string) => string,
  /** What a star system pays for being explored (before the rank bonus). Without it, jobs explore for nothing. */
  discoveryBaseOf?: (systemId: string) => number,
): { state: GameState; arrival: Arrival | null } {
  const job = state.currentJob;
  if (!job || state.travelEndMs === null || nowMs < state.travelEndMs) return { state, arrival: null };
  const dockId = job.destinationDockId;
  // Tours fly straight to the last stop; the stops on the way are only flavor text for the debrief.
  const stopNames = job.stops.slice(0, -1).map(placeNameOf).join(" and ");
  // Count the delivery for the rank of this kind of job, and notice a rank-up.
  let completedJobs = state.completedJobs;
  let rankUp: RankUp | null = null;
  let debrief = debriefFor(job, placeNameOf(dockId), stopNames);
  if (isRankKind(job.kind)) {
    const before = rankIndexFor(job.kind, completedJobs[job.kind]);
    completedJobs = { ...completedJobs, [job.kind]: completedJobs[job.kind] + 1 };
    const after = rankIndexFor(job.kind, completedJobs[job.kind]);
    if (after > before) {
      const rankName = RANK_NAMES[job.kind][after];
      rankUp = { kind: job.kind, rankNumber: after + 1, rankName };
      const line = RANK_UP_LINES[hashString(`${job.id}|rank`) % RANK_UP_LINES.length] ?? "Rank up!";
      debrief += ` ${line.split("{rank}").join(rankName).split("{kind}").join(RANK_KIND_LABELS[job.kind])}`;
    }
  }
  // Remember this job for the current board period (so it is not offered again), and forget older periods.
  // Arriving explores: the first arrival in a system pays discovery credits, and everything counts for the Explorer rank.
  let found: Discovery = NO_DISCOVERY;
  let explored = state.explored;
  if (discoveryBaseOf) {
    const result = recordArrival(state.explored, dockId, discoveryBaseOf);
    explored = result.explored;
    found = result.discovery;
  }
  const period = boardPeriodOf(slotOf(nowMs));
  const deliveredJobIds = [...state.deliveredJobIds, job.id]
    .filter((id) => periodOfJobId(id) >= period || id === job.id)
    .slice(-MAX_DELIVERED_IDS);
  return {
    state: {
      ...state,
      credits: state.credits + job.reward + found.credits,
      completedJobs,
      deliveredJobIds,
      explored,
      currentDockId: dockId,
      spacePlanetId: null,
      currentJob: null,
      travelStartMs: null,
      travelEndMs: null,
    },
    arrival: {
      job,
      reward: job.reward,
      discovery: found.credits,
      newSystem: found.newSystem,
      newPlanet: found.newPlanet,
      explorerRankUp: found.explorerRankUp,
      dockId,
      debrief,
      rankUp,
    },
  };
}

// ------------------------------------------------------------ refuel

export type RefuelResult =
  | { ok: true; state: GameState; units: number; cost: number }
  | { ok: false; reason: string };

/**
 * What one unit of fuel costs here, in hundredths of a credit (so a discount never needs decimals):
 * 200 = 2 credits. An outpost in this star system makes it cheaper.
 */
export function fuelUnitCents(state: GameState): number {
  return REFUEL_PRICE_PER_UNIT * (100 - fuelDiscountPercentAt(state, state.currentDockId));
}

/** Units of fuel the player's credits can buy here. */
export function affordableFuelUnits(state: GameState): number {
  const cents = fuelUnitCents(state);
  return cents > 0 ? Math.floor((Math.max(0, state.credits) * 100) / cents) : 0;
}

/** Buy fuel at the dock's price until the tank is full or the credits run out. Only while docked. */
export function refuel(state: GameState): RefuelResult {
  if (state.currentJob || state.freeTrip) return { ok: false, reason: "You can only refuel while docked." };
  const away = notDockedReason(state);
  if (away !== null) return { ok: false, reason: away };
  const tank = shipStats(state).fuelTankSize;
  const missing = tank - state.fuel;
  if (missing <= 0) return { ok: false, reason: "The tank is already full." };
  const units = Math.min(missing, affordableFuelUnits(state));
  if (units <= 0) return { ok: false, reason: "Not enough credits for any fuel." };
  const cost = Math.ceil((units * fuelUnitCents(state)) / 100); // whole credits, rounded up
  return { ok: true, units, cost, state: { ...state, fuel: state.fuel + units, credits: state.credits - cost } };
}

// ------------------------------------------------------------ safety net: stuck and emergency refuel

/**
 * "Stuck" = you are docked, no job on this board can be taken now, and not even spending ALL your credits
 * on fuel would help, although at least one job fits your ship (cargo or cabin) and its tank. So it is
 * only ever about fuel. Jobs blocked by cargo, cabin or tank size never make you "stuck".
 */
export function isStuck(state: GameState, jobs: readonly Job[]): boolean {
  if (state.currentJob) return false;
  const tank = shipStats(state).fuelTankSize;
  const bestFuel = Math.min(tank, state.fuel + affordableFuelUnits(state));
  let fuelBlocked = false;
  for (const job of jobs) {
    const block = checkJob(state, job);
    if (!block) return false; // you can take a job right now
    if (block.code === "not-enough-fuel") {
      fuelBlocked = true;
      if (tripFuelCost(state, job.totalDistance) <= bestFuel) return false; // refuelling would fix it
    }
  }
  return fuelBlocked;
}

export type EmergencyResult =
  | { ok: true; state: GameState; units: number; line: string }
  | { ok: false; reason: string };

/** Free fuel, but ONLY while stuck. Gives EMERGENCY_REFUEL_AMOUNT (never above the tank). Credits never change. */
export function emergencyRefuel(state: GameState, jobs: readonly Job[]): EmergencyResult {
  if (!isStuck(state, jobs)) {
    return { ok: false, reason: "You are not stuck. Take a job, or buy fuel with your credits." };
  }
  const tank = shipStats(state).fuelTankSize;
  const units = Math.min(EMERGENCY_REFUEL_AMOUNT, tank - state.fuel);
  if (units <= 0) return { ok: false, reason: "The tank is already full." };
  const pick = hashString(`${state.currentDockId}|${state.fuel}|${state.credits}`) % EMERGENCY_LINES.length;
  const line = (EMERGENCY_LINES[pick] ?? "Free fuel.").split("{amount}").join(String(units));
  return { ok: true, units, line, state: { ...state, fuel: state.fuel + units } };
}
