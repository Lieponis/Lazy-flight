// The whole game state. Plain data only (numbers, text, and one job copy), so it is easy to save later.
// Agent 6 saves exactly this object (see docs/report-agent-4b.md).

import type { Job } from "../universe";
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
  const hasJob = raw.currentJob != null && raw.travelStartMs != null && raw.travelEndMs != null;
  return {
    credits: Math.max(0, Math.round(finiteOr(raw.credits, STARTING_CREDITS))),
    fuel: Math.min(tank, Math.max(0, Math.round(finiteOr(raw.fuel, tank)))),
    shipId,
    ownedShips: owned,
    currentDockId: raw.currentDockId,
    currentJob: hasJob ? (raw.currentJob as Job) : null,
    travelStartMs: hasJob ? (raw.travelStartMs as number) : null,
    travelEndMs: hasJob ? (raw.travelEndMs as number) : null,
  };
}
