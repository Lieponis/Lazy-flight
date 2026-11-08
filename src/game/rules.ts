// The game rules as plain functions. Each takes the state (and the time) and gives back a NEW state.
// No drawing, no clock, no browser in here, so everything is easy to test.

import { DEBRIEF_LINES, EMERGENCY_LINES, PASSENGER_DEBRIEF_LINES, TOUR_DEBRIEF_LINES } from "./debriefs";
import {
  EMERGENCY_REFUEL_AMOUNT,
  FUEL_PER_LY,
  MAX_TRIP_SECONDS,
  MIN_FUEL_PER_TRIP,
  REFUEL_PRICE_PER_UNIT,
  SAME_SYSTEM_TRIP_SECONDS,
  TRAVEL_SECONDS_PER_LY,
} from "./settings";
import { getShip } from "./ships";
import type { GameState } from "./state";
import { hashString, type Job } from "../universe";

// ------------------------------------------------------------ distance -> time and fuel

/** Seconds a trip of this many light years takes. Never more than MAX_TRIP_SECONDS (4 hours). */
export function tripSeconds(distanceLy: number): number {
  const d = Math.max(0, Number.isFinite(distanceLy) ? distanceLy : 0);
  const seconds = SAME_SYSTEM_TRIP_SECONDS + d * TRAVEL_SECONDS_PER_LY;
  return Math.min(Math.round(seconds), MAX_TRIP_SECONDS);
}

/** Whole units of fuel a trip of this many light years burns. Grows with distance. */
export function fuelCost(distanceLy: number): number {
  const d = Math.max(0, Number.isFinite(distanceLy) ? distanceLy : 0);
  return Math.max(MIN_FUEL_PER_TRIP, Math.ceil(d * FUEL_PER_LY));
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

export interface Block {
  code: BlockCode;
  /** Plain-language reason to show the player. */
  text: string;
}

/** Null if the player can take the job right now, otherwise the reason it is blocked. */
export function checkJob(state: GameState, job: Job): Block | null {
  const ship = getShip(state.shipId);
  if (state.currentJob) return { code: "busy", text: "You already have a job. Finish it first." };
  if (job.originDockId !== state.currentDockId) return { code: "wrong-dock", text: "This job is from another dock." };

  if (job.requiredHold === "PASSENGER_CABIN") {
    if (ship.cabinCapacity <= 0) return { code: "no-cabin", text: "Needs a passenger cabin (your ship has none)." };
    if (job.amount > ship.cabinCapacity) {
      return { code: "cabin-too-small", text: `Too many passengers: ${job.amount}, your cabin holds ${ship.cabinCapacity}.` };
    }
  } else if (job.amount > ship.cargoCapacity) {
    return { code: "cargo-too-large", text: `Cargo too large: ${job.amount} units, your bay holds ${ship.cargoCapacity}.` };
  }

  const need = fuelCost(job.totalDistance);
  if (need > ship.fuelTankSize) {
    return { code: "tank-too-small", text: `Too far for this ship's tank: needs ${need} fuel, the tank holds ${ship.fuelTankSize}.` };
  }
  if (need > state.fuel) {
    return { code: "not-enough-fuel", text: `Not enough fuel: needs ${need}, you have ${state.fuel}. Refuel first.` };
  }
  return null;
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
      fuel: state.fuel - fuelCost(job.totalDistance),
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
  if (!state.currentJob || state.travelStartMs === null || state.travelEndMs === null) return null;
  const totalMs = Math.max(1, state.travelEndMs - state.travelStartMs);
  const elapsed = Math.min(Math.max(nowMs - state.travelStartMs, 0), totalMs);
  return { fraction: elapsed / totalMs, remainingMs: totalMs - elapsed, totalMs };
}

export interface Arrival {
  job: Job;
  reward: number;
  dockId: string;
  debrief: string;
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
export function settleArrival(
  state: GameState,
  nowMs: number,
  placeNameOf: (dockId: string) => string,
): { state: GameState; arrival: Arrival | null } {
  const job = state.currentJob;
  if (!job || state.travelEndMs === null || nowMs < state.travelEndMs) return { state, arrival: null };
  const dockId = job.destinationDockId;
  // Tours fly straight to the last stop; the stops on the way are only flavor text for the debrief.
  const stopNames = job.stops.slice(0, -1).map(placeNameOf).join(" and ");
  return {
    state: {
      ...state,
      credits: state.credits + job.reward,
      currentDockId: dockId,
      currentJob: null,
      travelStartMs: null,
      travelEndMs: null,
    },
    arrival: { job, reward: job.reward, dockId, debrief: debriefFor(job, placeNameOf(dockId), stopNames) },
  };
}

// ------------------------------------------------------------ refuel

export type RefuelResult =
  | { ok: true; state: GameState; units: number; cost: number }
  | { ok: false; reason: string };

/** Buy fuel at the flat price until the tank is full or the credits run out. Only while docked. */
export function refuel(state: GameState): RefuelResult {
  if (state.currentJob) return { ok: false, reason: "You can only refuel while docked." };
  const tank = getShip(state.shipId).fuelTankSize;
  const missing = tank - state.fuel;
  if (missing <= 0) return { ok: false, reason: "The tank is already full." };
  const units = Math.min(missing, Math.floor(state.credits / REFUEL_PRICE_PER_UNIT));
  if (units <= 0) return { ok: false, reason: "Not enough credits for any fuel." };
  const cost = units * REFUEL_PRICE_PER_UNIT;
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
  const tank = getShip(state.shipId).fuelTankSize;
  const affordable = Math.floor(Math.max(0, state.credits) / REFUEL_PRICE_PER_UNIT);
  const bestFuel = Math.min(tank, state.fuel + affordable);
  let fuelBlocked = false;
  for (const job of jobs) {
    const block = checkJob(state, job);
    if (!block) return false; // you can take a job right now
    if (block.code === "not-enough-fuel") {
      fuelBlocked = true;
      if (fuelCost(job.totalDistance) <= bestFuel) return false; // refuelling would fix it
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
  const tank = getShip(state.shipId).fuelTankSize;
  const units = Math.min(EMERGENCY_REFUEL_AMOUNT, tank - state.fuel);
  if (units <= 0) return { ok: false, reason: "The tank is already full." };
  const pick = hashString(`${state.currentDockId}|${state.fuel}|${state.credits}`) % EMERGENCY_LINES.length;
  const line = (EMERGENCY_LINES[pick] ?? "Free fuel.").split("{amount}").join(String(units));
  return { ok: true, units, line, state: { ...state, fuel: state.fuel + units } };
}
