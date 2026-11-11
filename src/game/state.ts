// The whole game state. Plain data only (numbers, text, and one job copy), so it is easy to save later.
// Agent 6 saves exactly this object (see docs/report-agent-4b.md).

import type { Job } from "../universe";
import { cleanExplored } from "./explore";
import { emptyCompletedJobs, RANK_KINDS, type CompletedJobs } from "./ranks";
import { STARTER_SHIP_ID, STARTING_CREDITS } from "./settings";
import { getShip, isShipId } from "./ships";
import { cleanUpgrades, noUpgrades, statsFor, type ShipUpgrades } from "./upgrades";

/** A free trip (no job) on its way: where from, where to, how far. The start and end times are the same fields a job uses. */
export interface FreeTrip {
  /** The dock or scenery planet you left. */
  fromId: string;
  /** The dock or scenery planet you are flying to (a dock's id is its planet's id). */
  toId: string;
  /** Light years between the two star systems (0 inside one system). */
  distanceLy: number;
}

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
  /**
   * The upgrade levels (0 to 5) of every ship you own, by ship id: { "scout": { tank: 2, hold: 0, engines: 1, comfort: 0 } }.
   * A ship with no entry has level 0 everywhere. Upgrades stay with their ship (see upgrades.ts).
   */
  shipUpgrades: Record<string, ShipUpgrades>;
  /** How many jobs of each kind you have delivered (this decides your ranks, see ranks.ts). */
  completedJobs: CompletedJobs;
  /** The ids of the outposts you own (your home bases), in the order you bought them. */
  ownedOutposts: string[];
  /** What you paid for each outpost you own, by dock id (credits). Missing = bought before this was stored. */
  outpostPrices: Record<string, number>;
  /** How many outposts you own. Always the length of ownedOutposts. */
  outpostCount: number;
  /** The dock you are at (or left from, while a job is in flight). Same id as its planet. */
  currentDockId: string;
  /**
   * Null = you are docked at currentDockId. Otherwise the id of the planet WITHOUT a dock where you float in space
   * (currentDockId is then the last dock you used). Old saves have no such field and stay docked.
   */
  spacePlanetId: string | null;
  /** The accepted job (a full copy), or null. */
  currentJob: Job | null;
  /** A free trip (no job) on its way, or null. Never set together with currentJob. */
  freeTrip: FreeTrip | null;
  /**
   * Where you have been, compactly: star system id -> a number whose bits are the planets of that system you arrived at
   * (see explore.ts). Its keys are the explored systems. Old saves start empty.
   */
  explored: Record<string, number>;
  /** Game time (ms) when the trip started, or null. */
  travelStartMs: number | null;
  /** Game time (ms) when the trip ends, or null. */
  travelEndMs: number | null;
  /**
   * Ids of jobs you delivered in the current board period. They are hidden from the board, so a job you already
   * delivered cannot show up again (and pay again) when you come back within the same period (bug 6b-2).
   * Old periods are dropped on each arrival, so this list stays short.
   */
  deliveredJobIds: string[];
}

/** Most delivered ids kept (safety limit; normally only the current board period's few ids are kept). */
export const MAX_DELIVERED_IDS = 200;

/** A fresh game: starting credits, a full tank, docked at `startDockId`, no job. */
export function newGameState(startDockId: string): GameState {
  return {
    credits: STARTING_CREDITS,
    fuel: getShip(STARTER_SHIP_ID).fuelTankSize,
    shipId: STARTER_SHIP_ID,
    ownedShips: {},
    shipUpgrades: {},
    completedJobs: emptyCompletedJobs(),
    ownedOutposts: [],
    outpostPrices: {},
    outpostCount: 0,
    currentDockId: startDockId,
    spacePlanetId: null,
    currentJob: null,
    freeTrip: null,
    explored: {},
    travelStartMs: null,
    travelEndMs: null,
    deliveredJobIds: [],
  };
}

function cleanFreeTrip(raw: unknown): FreeTrip | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.fromId !== "string" || t.fromId === "" || typeof t.toId !== "string" || t.toId === "") return null;
  if (typeof t.distanceLy !== "number" || !Number.isFinite(t.distanceLy) || t.distanceLy < 0) return null;
  return { fromId: t.fromId, toId: t.toId, distanceLy: t.distanceLy };
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Turns saved data (maybe from an old version, maybe missing parts) into a safe GameState.
 * Missing ownedShips = you own only the active ship. Unknown ships are dropped.
 * Missing shipUpgrades (saves from before upgrades) = every ship at level 0; bad levels are repaired.
 * Missing completedJobs / ownedOutposts (saves from before ranks and outposts) = no ranks yet, no outposts.
 */
export function normalizeState(raw: Partial<GameState> & { currentDockId: string }): GameState {
  const shipId = typeof raw.shipId === "string" && isShipId(raw.shipId) ? raw.shipId : STARTER_SHIP_ID;
  const source = raw.ownedShips && typeof raw.ownedShips === "object" ? raw.ownedShips : {};
  const ownedIds = Object.keys(source).filter((id) => isShipId(id) && id !== shipId);
  // Upgrade levels first, because the real tank size depends on them. Only ships you own can have upgrades.
  const rawUpgrades: Partial<Record<string, unknown>> =
    raw.shipUpgrades && typeof raw.shipUpgrades === "object" ? (raw.shipUpgrades as Partial<Record<string, unknown>>) : {};
  const upgrades: Record<string, ShipUpgrades> = {};
  for (const id of [shipId, ...ownedIds]) {
    if (rawUpgrades[id] !== undefined) upgrades[id] = cleanUpgrades(rawUpgrades[id]);
  }
  const tankOf = (id: string): number => statsFor(id, upgrades[id] ?? noUpgrades()).fuelTankSize;
  const tank = tankOf(shipId);
  const owned: Record<string, { fuel: number }> = {};
  for (const id of ownedIds) {
    const entry = source[id];
    const shipTank = tankOf(id);
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
  // The price paid per outpost: whole credits above 0, and only for outposts you own.
  const rawPrices: Partial<Record<string, unknown>> =
    raw.outpostPrices && typeof raw.outpostPrices === "object" ? (raw.outpostPrices as Partial<Record<string, unknown>>) : {};
  const outpostPrices: Record<string, number> = {};
  for (const id of ownedOutposts) {
    const paid = rawPrices[id];
    if (typeof paid === "number" && Number.isFinite(paid) && paid > 0) outpostPrices[id] = Math.round(paid);
  }
  const hasTimes = raw.travelStartMs != null && raw.travelEndMs != null;
  const hasJob = raw.currentJob != null && hasTimes;
  const freeTrip = !hasJob && hasTimes ? cleanFreeTrip(raw.freeTrip) : null;
  const hasTrip = hasJob || freeTrip !== null;
  return {
    credits: Math.max(0, Math.round(finiteOr(raw.credits, STARTING_CREDITS))),
    fuel: Math.min(tank, Math.max(0, Math.round(finiteOr(raw.fuel, tank)))),
    shipId,
    ownedShips: owned,
    shipUpgrades: upgrades,
    completedJobs: completed,
    ownedOutposts,
    outpostPrices,
    outpostCount: ownedOutposts.length,
    currentDockId: raw.currentDockId,
    spacePlanetId: typeof raw.spacePlanetId === "string" && raw.spacePlanetId !== "" ? raw.spacePlanetId : null,
    currentJob: hasJob ? (raw.currentJob as Job) : null,
    freeTrip,
    explored: cleanExplored(raw.explored),
    travelStartMs: hasTrip ? (raw.travelStartMs as number) : null,
    travelEndMs: hasTrip ? (raw.travelEndMs as number) : null,
    deliveredJobIds: Array.isArray(raw.deliveredJobIds)
      ? (raw.deliveredJobIds as unknown[]).filter((id): id is string => typeof id === "string" && id !== "").slice(-MAX_DELIVERED_IDS)
      : [],
  };
}
