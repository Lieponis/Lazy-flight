// The whole game state. Plain data only (numbers, text, and one job copy), so it is easy to save later.
// Agent 6 saves exactly this object (see docs/report-agent-4b.md).

import type { Job } from "../universe";
import { emptyCompletedJobs, RANK_KINDS, type CompletedJobs } from "./ranks";
import { STARTER_SHIP_ID, STARTING_CREDITS } from "./settings";
import { getShip, isShipId } from "./ships";

export interface GameState {
  credits: number;
  /** Fuel of the ACTIVE ship. */
  fuel: number;
  /** Id of the ACTIVE ship, see ships.ts. */
  shipId: string;
  /**
   * The ships you own that are NOT the active one, with their own fuel: { "scout": { fuel: 80 } }.
   * You own the active ship plus every ship listed here. Empty at the start.
   */
  ownedShips: Record<string, { fuel: number }>;
  /** How many jobs of each kind you have delivered (this decides your ranks, see ranks.ts). */
  completedJobs: CompletedJobs;
  /** The ids of the outposts you own (your home bases), in the order you bought them. */
  ownedOutposts: string[];
  /** How many outposts you own. Always the length of ownedOutposts. */
  outpostCount: number;
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
    ownedShips: {},
    completedJobs: emptyCompletedJobs(),
    ownedOutposts: [],
    outpostCount: 0,
    currentDockId: startDockId,
    currentJob: null,
    travelStartMs: null,
    travelEndMs: null,
  };
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Turns saved data (maybe from an old version, maybe missing parts) into a safe GameState.
 * Missing ownedShips = you own only the active ship. Unknown ships are dropped.
 * Missing completedJobs / ownedOutposts (saves from before ranks and outposts) = no ranks yet, no outposts.
 */
export function normalizeState(raw: Partial<GameState> & { currentDockId: string }): GameState {
  const shipId = typeof raw.shipId === "string" && isShipId(raw.shipId) ? raw.shipId : STARTER_SHIP_ID;
  const tank = getShip(shipId).fuelTankSize;
  const owned: Record<string, { fuel: number }> = {};
  const source = raw.ownedShips && typeof raw.ownedShips === "object" ? raw.ownedShips : {};
  for (const id of Object.keys(source)) {
    if (!isShipId(id) || id === shipId) continue;
    const entry = source[id];
    const shipTank = getShip(id).fuelTankSize;
    owned[id] = { fuel: Math.min(shipTank, Math.max(0, Math.round(finiteOr(entry?.fuel, shipTank)))) };
  }
  const completed = emptyCompletedJobs();
  const rawDone: Partial<Record<string, unknown>> =
    raw.completedJobs && typeof raw.completedJobs === "object" ? (raw.completedJobs as Partial<Record<string, unknown>>) : {};
  for (const kind of RANK_KINDS) completed[kind] = Math.max(0, Math.floor(finiteOr(rawDone[kind], 0)));
  const ownedOutposts: string[] = [];
  if (Array.isArray(raw.ownedOutposts)) {
    for (const id of raw.ownedOutposts as unknown[]) {
      if (typeof id === "string" && id !== "" && !ownedOutposts.includes(id)) ownedOutposts.push(id);
    }
  }
  const hasJob = raw.currentJob != null && raw.travelStartMs != null && raw.travelEndMs != null;
  return {
    credits: Math.max(0, Math.round(finiteOr(raw.credits, STARTING_CREDITS))),
    fuel: Math.min(tank, Math.max(0, Math.round(finiteOr(raw.fuel, tank)))),
    shipId,
    ownedShips: owned,
    completedJobs: completed,
    ownedOutposts,
    outpostCount: ownedOutposts.length,
    currentDockId: raw.currentDockId,
    currentJob: hasJob ? (raw.currentJob as Job) : null,
    travelStartMs: hasJob ? (raw.travelStartMs as number) : null,
    travelEndMs: hasJob ? (raw.travelEndMs as number) : null,
  };
}
