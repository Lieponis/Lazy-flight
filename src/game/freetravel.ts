// Free travel: fly to a dock or to a planet without a dock, with no job. You pay fuel only; there is no cargo, no pay and
// no job rank progress. The fuel formula and the trip time are the same as for a job of the same length.
// Strand protection: a trip is refused when, after it, you could not reach a dock with the fuel you would have left.
// Pure logic: the Game passes in the universe facts (distances, names).

import { DOCK_VISIT_LINES, SCENERY_LINES } from "./debriefs";
import { recordArrival, type Discovery } from "./explore";
import { isFlying, notDockedReason } from "./location";
import { tripFuelCost, tripSeconds } from "./rules";
import { EMERGENCY_REFUEL_AMOUNT } from "./settings";
import { shipStats } from "./upgrades";
import { EMERGENCY_LINES } from "./debriefs";
import { hashString } from "../universe";
import type { GameState } from "./state";

/** What the rules need to know about a free trip (the Game reads these from the universe). */
export interface TripFacts {
  /** The place you are at (a dock id or a scenery planet id). */
  fromId: string;
  /** The place you want to fly to. */
  toId: string;
  /** Light years between the two star systems (0 inside one system). */
  distanceLy: number;
  /** Light years from the target place to the nearest dock (0 when the target star system has a dock, which it always does). */
  nearestDockLy: number;
}

export interface FreeTravelBlock {
  /** Plain text for the player, with the fuel numbers. */
  text: string;
}

/** The fuel you must still have after a trip so you can reach a dock from where you land (at least 1 unit). */
export function strandReserve(state: GameState, nearestDockLy: number): number {
  return tripFuelCost(state, nearestDockLy);
}

/** Null if the trip can start now, otherwise the plain reason it cannot. */
export function checkFreeTravel(state: GameState, trip: TripFacts): FreeTravelBlock | null {
  if (isFlying(state)) {
    return { text: state.currentJob ? "You already have a job. Finish it first." : "You are already flying. Wait until you arrive." };
  }
  if (trip.toId === trip.fromId) return { text: "You are already there." };
  const tank = shipStats(state).fuelTankSize;
  const need = tripFuelCost(state, trip.distanceLy);
  if (need > tank) return { text: `Too far for this ship's tank: needs ${need} fuel, the tank holds ${tank}.` };
  if (need > state.fuel) return { text: `Not enough fuel: needs ${need}, you have ${state.fuel}.${state.spacePlanetId ? "" : " Refuel first."}` };
  const left = state.fuel - need;
  const reserve = strandReserve(state, trip.nearestDockLy);
  if (left < reserve) {
    return {
      text: `Not enough fuel to come back safely: after this trip you would have ${left} fuel and need ${reserve} to reach a dock.${
        state.spacePlanetId ? " Pick a closer place." : " Refuel first, or pick a closer place."
      }`,
    };
  }
  return null;
}

export type StartFreeTravelResult = { ok: true; state: GameState; fuelUsed: number; seconds: number } | { ok: false; reason: string };

/** Starts the trip: burns the fuel and sets the start and end times. */
export function startFreeTravel(state: GameState, trip: TripFacts, nowMs: number): StartFreeTravelResult {
  const block = checkFreeTravel(state, trip);
  if (block) return { ok: false, reason: block.text };
  const fuelUsed = tripFuelCost(state, trip.distanceLy);
  const seconds = tripSeconds(trip.distanceLy);
  return {
    ok: true,
    fuelUsed,
    seconds,
    state: {
      ...state,
      fuel: state.fuel - fuelUsed,
      freeTrip: { fromId: trip.fromId, toId: trip.toId, distanceLy: trip.distanceLy },
      travelStartMs: nowMs,
      travelEndMs: nowMs + seconds * 1000,
    },
  };
}

/** The result of arriving from a free trip. */
export interface FreeArrival {
  fromId: string;
  /** The dock or planet you arrived at. */
  toId: string;
  /** True when it has a dock (you are docked there), false for a planet without one (you float in space). */
  isDock: boolean;
  /** A funny line about the arrival. */
  line: string;
  /** Discovery credits paid (0 = none). */
  discovery: number;
  newSystem: boolean;
  newPlanet: boolean;
  explorerRankUp: Discovery["explorerRankUp"];
}

/**
 * If the end time has passed: moves you to the target (docked, or floating at a planet), pays discovery credits for a new
 * system, records the arrival for the Explorer rank, clears the trip. Otherwise nothing changes.
 * `isDock(id)` tells whether the target has a dock; `placeNameOf(id)` is its name; `discoveryBaseOf(systemId)` is what a system pays.
 */
export function settleFreeArrival(
  state: GameState,
  nowMs: number,
  isDock: (placeId: string) => boolean,
  placeNameOf: (placeId: string) => string,
  discoveryBaseOf: (systemId: string) => number,
): { state: GameState; arrival: FreeArrival | null } {
  const trip = state.freeTrip;
  if (!trip || state.travelEndMs === null || nowMs < state.travelEndMs) return { state, arrival: null };
  const docked = isDock(trip.toId);
  const found = recordArrival(state.explored, trip.toId, discoveryBaseOf);
  const lines = docked ? DOCK_VISIT_LINES : SCENERY_LINES;
  const line = (lines[hashString(`${trip.fromId}>${trip.toId}|free`) % lines.length] ?? "You arrived.")
    .split("{place}")
    .join(placeNameOf(trip.toId));
  const next: GameState = {
    ...state,
    credits: state.credits + found.discovery.credits,
    explored: found.explored,
    currentDockId: docked ? trip.toId : state.currentDockId,
    spacePlanetId: docked ? null : trip.toId,
    freeTrip: null,
    travelStartMs: null,
    travelEndMs: null,
  };
  return {
    state: next,
    arrival: {
      fromId: trip.fromId,
      toId: trip.toId,
      isDock: docked,
      line,
      discovery: found.discovery.credits,
      newSystem: found.discovery.newSystem,
      newPlanet: found.discovery.newPlanet,
      explorerRankUp: found.discovery.explorerRankUp,
    },
  };
}

// ------------------------------------------------------------ safety net while floating in space

/**
 * Floating at a planet without a dock you cannot buy fuel. You are "stuck" there when your fuel is less than the
 * hop to the nearest dock (so no trip is possible at all). This can happen after switching to a ship with an empty tank.
 */
export function isStuckInSpace(state: GameState, nearestDockLy: number): boolean {
  if (state.spacePlanetId === null || isFlying(state)) return false;
  return state.fuel < tripFuelCost(state, nearestDockLy);
}

export type SpaceEmergencyResult = { ok: true; state: GameState; units: number; line: string } | { ok: false; reason: string };

/** Free fuel from a planet without a dock, only while stuck there. Same amount and funny lines as the dock version. */
export function emergencyRefuelInSpace(state: GameState, nearestDockLy: number): SpaceEmergencyResult {
  if (!isStuckInSpace(state, nearestDockLy)) {
    return { ok: false, reason: notDockedReason(state) === null ? "You are not in space." : "You have enough fuel to reach a dock. Fly there." };
  }
  const tank = shipStats(state).fuelTankSize;
  const units = Math.min(EMERGENCY_REFUEL_AMOUNT, tank - state.fuel);
  if (units <= 0) return { ok: false, reason: "The tank is already full." };
  const pick = hashString(`${state.spacePlanetId}|${state.fuel}|space`) % EMERGENCY_LINES.length;
  const line = (EMERGENCY_LINES[pick] ?? "Free fuel.").split("{amount}").join(String(units));
  return { ok: true, units, line, state: { ...state, fuel: state.fuel + units } };
}
