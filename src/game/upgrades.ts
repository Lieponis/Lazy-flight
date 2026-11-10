// Ship upgrades: four tracks, five levels each, kept per ship (an upgrade stays with its ship).
//   tank     - bigger fuel tank
//   hold     - bigger cargo bay and cabin
//   engines  - less fuel burned per light year
//   comfort  - more pay on passenger and tour jobs
// Every number is in settings.ts. These are plain functions; the Game object only connects them to the UI.

import {
  UPGRADE_COMFORT_PERCENT_PER_LEVEL,
  UPGRADE_ENGINE_PERCENT_PER_LEVEL,
  UPGRADE_HOLD_PERCENT_PER_LEVEL,
  UPGRADE_MAX_LEVEL,
  UPGRADE_PRICES,
  UPGRADE_TANK_PERCENT_PER_LEVEL,
} from "./settings";
import { getShip, isShipId } from "./ships";
import type { GameState } from "./state";

export type UpgradeTrack = "tank" | "hold" | "engines" | "comfort";
export const UPGRADE_TRACKS: UpgradeTrack[] = ["tank", "hold", "engines", "comfort"];

/** What the player sees as the name of each track. */
export const UPGRADE_TRACK_NAMES: Record<UpgradeTrack, string> = {
  tank: "Fuel Tank",
  hold: "Hold & Cabin",
  engines: "Efficient Engines",
  comfort: "Passenger Comfort",
};

/** The level (0 to 5) of every track of one ship. */
export type ShipUpgrades = Record<UpgradeTrack, number>;

export function noUpgrades(): ShipUpgrades {
  return { tank: 0, hold: 0, engines: 0, comfort: 0 };
}

export function isUpgradeTrack(track: string): track is UpgradeTrack {
  return (UPGRADE_TRACKS as string[]).includes(track);
}

function wholeLevel(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.min(UPGRADE_MAX_LEVEL, Math.max(0, n));
}

/** Safe levels from anything (saved data, missing parts): whole numbers from 0 to the maximum. */
export function cleanUpgrades(raw: unknown): ShipUpgrades {
  const source: Partial<Record<string, unknown>> = raw && typeof raw === "object" ? (raw as Partial<Record<string, unknown>>) : {};
  const out = noUpgrades();
  for (const track of UPGRADE_TRACKS) out[track] = wholeLevel(source[track]);
  return out;
}

/** The levels of a ship (all 0 if it has none or you do not own it). */
export function upgradeLevels(state: GameState, shipId: string = state.shipId): ShipUpgrades {
  return state.shipUpgrades[shipId] ?? noUpgrades();
}

/** What a ship really has: its shipyard numbers plus its upgrades. */
export interface ShipStats {
  cargoCapacity: number;
  /** 0 = no cabin (a hold upgrade never creates one). */
  cabinCapacity: number;
  fuelTankSize: number;
  /** Fuel burned compared with a ship without engine upgrades: 100 = normal, 94 = 6% less. */
  fuelBurnPercent: number;
  /** Extra pay percent on passenger and tour jobs. */
  comfortBonusPercent: number;
}

function grow(base: number, percent: number): number {
  return base <= 0 ? base : Math.round((base * (100 + percent)) / 100);
}

export function statsFor(shipId: string, levels: ShipUpgrades): ShipStats {
  const ship = getShip(shipId);
  const hold = levels.hold * UPGRADE_HOLD_PERCENT_PER_LEVEL;
  return {
    cargoCapacity: grow(ship.cargoCapacity, hold),
    cabinCapacity: grow(ship.cabinCapacity, hold),
    fuelTankSize: grow(ship.fuelTankSize, levels.tank * UPGRADE_TANK_PERCENT_PER_LEVEL),
    fuelBurnPercent: Math.max(1, 100 - levels.engines * UPGRADE_ENGINE_PERCENT_PER_LEVEL),
    comfortBonusPercent: levels.comfort * UPGRADE_COMFORT_PERCENT_PER_LEVEL,
  };
}

/** The real numbers of a ship you own (default: the active ship). */
export function shipStats(state: GameState, shipId: string = state.shipId): ShipStats {
  return statsFor(shipId, upgradeLevels(state, shipId));
}

/** Fuel never goes above the tank: clamps the active ship and every other owned ship. */
export function clampFuelToTanks(state: GameState): GameState {
  const tank = shipStats(state).fuelTankSize;
  const owned: Record<string, { fuel: number }> = {};
  for (const [id, entry] of Object.entries(state.ownedShips)) {
    owned[id] = { fuel: Math.min(entry.fuel, shipStats(state, id).fuelTankSize) };
  }
  return { ...state, fuel: Math.min(state.fuel, tank), ownedShips: owned };
}

// ------------------------------------------------------------ offers and buying

/** Credits for the next level of a track at this level, or null at the top. */
export function upgradePrice(level: number): number | null {
  return level >= UPGRADE_MAX_LEVEL ? null : (UPGRADE_PRICES[level] ?? null);
}

function ownsShipHere(state: GameState, shipId: string): boolean {
  return shipId === state.shipId || shipId in state.ownedShips;
}

/** Why this level cannot be bought right now ("" when it can). */
export function upgradeBlock(state: GameState, shipId: string, track: string): string {
  if (!isShipId(shipId)) return "There is no such ship.";
  if (!isUpgradeTrack(track)) return "There is no such upgrade.";
  if (!ownsShipHere(state, shipId)) return "You do not own this ship.";
  if (state.currentJob) return "You cannot buy an upgrade during a flight.";
  const level = upgradeLevels(state, shipId)[track];
  const price = upgradePrice(level);
  if (price === null) return "This upgrade is already at the highest level.";
  if (state.credits < price) return `Costs ${price} credits, you have ${state.credits}.`;
  return "";
}

export type BuyUpgradeResult = { ok: true; state: GameState; price: number; level: number } | { ok: false; reason: string };

/** Buy the next level of one track of one ship you own. One level at a time. */
export function buyUpgrade(state: GameState, shipId: string, track: string): BuyUpgradeResult {
  const reason = upgradeBlock(state, shipId, track);
  if (reason || !isUpgradeTrack(track)) return { ok: false, reason: reason || "There is no such upgrade." };
  const levels = upgradeLevels(state, shipId);
  const price = upgradePrice(levels[track]) ?? 0;
  const level = levels[track] + 1;
  const next: GameState = {
    ...state,
    credits: state.credits - price,
    shipUpgrades: { ...state.shipUpgrades, [shipId]: { ...levels, [track]: level } },
  };
  return { ok: true, state: clampFuelToTanks(next), price, level };
}

/** One row of the upgrade panel. */
export interface UpgradeOffer {
  track: UpgradeTrack;
  name: string;
  level: number;
  maxLevel: number;
  /** Credits for the next level, or null at the top. */
  nextPrice: number | null;
  /** What the next level does in plain words ("Tank 100 -> 110 fuel"); at the top, what the track gives now. */
  effect: string;
  canBuy: boolean;
  /** Why it cannot be bought ("" when it can). */
  reason: string;
}

function effectText(shipId: string, track: UpgradeTrack, levels: ShipUpgrades): string {
  const now = statsFor(shipId, levels);
  const atTop = levels[track] >= UPGRADE_MAX_LEVEL;
  const after = statsFor(shipId, { ...levels, [track]: Math.min(UPGRADE_MAX_LEVEL, levels[track] + 1) });
  const show = <T>(a: T, b: T): string => (atTop ? `${a}` : `${a} -> ${b}`);
  const suffix = atTop ? " (maximum)" : "";
  switch (track) {
    case "tank":
      return `Tank ${show(now.fuelTankSize, after.fuelTankSize)} fuel${suffix}`;
    case "hold": {
      const cargo = `Cargo ${show(now.cargoCapacity, after.cargoCapacity)}`;
      return (now.cabinCapacity > 0 ? `${cargo}, cabin ${show(now.cabinCapacity, after.cabinCapacity)}` : `${cargo}, no cabin`) + suffix;
    }
    case "engines":
      return `Fuel burn ${show(`${now.fuelBurnPercent}%`, `${after.fuelBurnPercent}%`)} of normal${suffix}`;
    case "comfort":
      return `Passenger and tour pay ${show(`+${now.comfortBonusPercent}%`, `+${after.comfortBonusPercent}%`)}${suffix}`;
  }
}

/** The four rows for one ship (default: the active ship). Works for any ship you own; others get "You do not own this ship.". */
export function upgradeOffers(state: GameState, shipId: string = state.shipId): UpgradeOffer[] {
  const valid = isShipId(shipId);
  const levels = valid ? upgradeLevels(state, shipId) : noUpgrades();
  return UPGRADE_TRACKS.map((track) => {
    const reason = upgradeBlock(state, shipId, track);
    return {
      track,
      name: UPGRADE_TRACK_NAMES[track],
      level: levels[track],
      maxLevel: UPGRADE_MAX_LEVEL,
      nextPrice: upgradePrice(levels[track]),
      effect: valid ? effectText(shipId, track, levels) : "",
      canBuy: reason === "",
      reason,
    };
  });
}
