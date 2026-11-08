// The whole game state. Plain data only (numbers, text, and one job copy), so it is easy to save later.
// Agent 6 saves exactly this object (see docs/report-agent-4a.md).

import type { Job } from "../universe";
import { STARTER_SHIP_ID, STARTING_CREDITS } from "./settings";
import { getShip } from "./ships";

export interface GameState {
  credits: number;
  fuel: number;
  /** Id of the ship, see ships.ts. */
  shipId: string;
  /** The dock you are at (or left from, while a job is in flight). Same id as its planet. */
  currentDockId: string;
  /** The accepted job (a full copy), or null. */
  currentJob: Job | null;
  /** Game time (ms) when the trip started, or null. */
  travelStartMs: number | null;
  /** Game time (ms) when the trip ends, or null. */
  travelEndMs: number | null;
}

/** A fresh game: starting credits, a full tank, docked at `startDockId`, no job. */
export function newGameState(startDockId: string): GameState {
  return {
    credits: STARTING_CREDITS,
    fuel: getShip(STARTER_SHIP_ID).fuelTankSize,
    shipId: STARTER_SHIP_ID,
    currentDockId: startDockId,
    currentJob: null,
    travelStartMs: null,
    travelEndMs: null,
  };
}
