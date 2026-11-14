// Moving an old save to the current universe ("move + refund", plan: docs/plan-fewer-docks.md).
// When the universe is rebuilt (UNIVERSE_VERSION goes up), old dock ids can mean something else or nothing,
// so the progress that does not depend on places is kept and everything place-bound is reset:
//   KEPT     credits, ranks, ships, ship upgrades, fuel (sound settings live under another key)
//   MOVED    the ship is placed at the start dock of the new universe, like a new game
//   CANCELLED a job in flight: the cargo goes back and the fuel it burned is given back (no penalty)
//   REFUNDED each owned outpost: the price paid if the save stored it, otherwise OUTPOST_REFUND_ESTIMATE
//   CLEARED  the list of delivered jobs, the explored list (old ids mean other places now), a float in space or a free trip
// The same move is used when a save belongs to ANOTHER SEED than the shared world (stage N2, plan docs/plan-unique-names-world-seed.md):
// every player lives in the one world universe, so a save made on seed 777 (a test link, "New random universe") is carried over.
// Pure logic: the storage is not touched here.

import { OUTPOST_REFUND_ESTIMATE, normalizeState, shipStats, tripFuelCost, type GameState } from "../game";
import { UNIVERSE_VERSION, startDockOf } from "../universe";
import type { SaveData } from "./save";

/** What the player is told, once, after a move. */
export const MESSAGE_REBUILT = "The universe was rebuilt. Your credits and ships came with you.";

/** The universe version a save was made in (a save without the number is version 1). */
export function universeVersionOf(save: SaveData): number {
  return save.universeVersion ?? 1;
}

export interface Migration {
  data: SaveData;
  /** The one-time message, or null if nothing changed for the player. */
  message: string | null;
  /** Credits given back for outposts. */
  refund: number;
  /** Fuel given back for a cancelled trip. */
  fuelBack: number;
}

/**
 * Brings a save up to the current universe. A save that is already current comes back untouched.
 * `toSeed` (stage N2): when given and the save belongs to another seed, the save is moved to that seed too
 * (same rule as an old universe: credits, ranks, ships, upgrades, paint jobs kept; the rest reset or refunded).
 * Without `toSeed` the save keeps its own seed (developer pages, the "continue as it is" path of ?dev=1).
 */
export function migrateSave(save: SaveData, toSeed?: number): Migration {
  const otherSeed = toSeed !== undefined && save.seed !== toSeed;
  if (universeVersionOf(save) >= UNIVERSE_VERSION && !otherSeed) return { data: save, message: null, refund: 0, fuelBack: 0 };
  const seed: number = otherSeed ? (toSeed as number) : save.seed;

  if (save.state === null) {
    // Nothing to keep: it was "start fresh in this universe". Just stamp it.
    return { data: { ...save, seed, universeVersion: UNIVERSE_VERSION }, message: null, refund: 0, fuelBack: 0 };
  }

  const old: GameState = normalizeState(save.state);
  let refund = 0;
  for (const id of old.ownedOutposts) refund += old.outpostPrices[id] ?? OUTPOST_REFUND_ESTIMATE;

  // A trip in flight is cancelled: the fuel it burned comes back, up to the tank.
  const fuelBack = old.currentJob ? tripFuelCost(old, old.currentJob.totalDistance) : old.freeTrip ? tripFuelCost(old, old.freeTrip.distanceLy) : 0;
  const tank = shipStats(old).fuelTankSize;

  const moved: GameState = {
    ...old,
    credits: old.credits + refund,
    fuel: Math.min(tank, old.fuel + fuelBack),
    currentDockId: startDockOf(seed).id,
    spacePlanetId: null,
    currentJob: null,
    freeTrip: null,
    explored: {},
    travelStartMs: null,
    travelEndMs: null,
    ownedOutposts: [],
    outpostPrices: {},
    outpostCount: 0,
    deliveredJobIds: [],
  };

  const message = refund > 0 ? `${MESSAGE_REBUILT} Your outposts were sold back for ${refund} credits.` : MESSAGE_REBUILT;
  return { data: { ...save, seed, state: moved, universeVersion: UNIVERSE_VERSION }, message, refund, fuelBack };
}
