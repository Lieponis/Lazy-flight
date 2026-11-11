// Where the player is. Three cases, from the state alone:
//   docked        spacePlanetId = null, no job, no free trip    (currentDockId is where you are)
//   in space      spacePlanetId = the id of a planet WITHOUT a dock (you float there; currentDockId is the last dock you used)
//   flying        a job or a free trip is on its way
// Pure logic: no universe, no clock.

import { FLYING_LINE, IN_SPACE_LINES } from "./debriefs";
import { hashString } from "../universe";
import type { GameState } from "./state";

/** True while a job or a free trip is on its way. */
export function isFlying(state: GameState): boolean {
  return state.currentJob !== null || state.freeTrip !== null;
}

/** True while you float at a planet without a dock (and are not flying). */
export function isInSpace(state: GameState): boolean {
  return state.spacePlanetId !== null && !isFlying(state);
}

/** The id of the place you are at: the planet you float at, or the dock you are docked at. */
export function currentPlaceId(state: GameState): string {
  return state.spacePlanetId ?? state.currentDockId;
}

/**
 * Null if you are docked and not flying (so jobs, buying and refuelling are possible).
 * Otherwise the plain, funny reason they are not. `placeName` is the planet's name for the funny line.
 */
export function notDockedReason(state: GameState, placeName = "this planet"): string | null {
  if (isFlying(state)) return FLYING_LINE;
  if (state.spacePlanetId !== null) {
    const line = IN_SPACE_LINES[hashString(state.spacePlanetId) % IN_SPACE_LINES.length] ?? "You are not at a dock.";
    return line.split("{place}").join(placeName);
  }
  return null;
}
