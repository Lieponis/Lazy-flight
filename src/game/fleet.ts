// Owning, buying and switching ships. Plain functions: they never throw, failures give a plain reason.

import { SHIP_ORDER, getShip, isShipId, type ShipDef } from "./ships";
import { isFlying, notDockedReason } from "./location";
import type { GameState } from "./state";
import { clampFuelToTanks, shipStats, upgradeLevels, type ShipStats, type ShipUpgrades } from "./upgrades";

export type FleetResult = { ok: true; state: GameState } | { ok: false; reason: string };

/** Ids of every ship you own: the active one first, then the others. */
export function ownedShipIds(state: GameState): string[] {
  return [state.shipId, ...SHIP_ORDER.filter((id) => id !== state.shipId && id in state.ownedShips)];
}

export function ownsShip(state: GameState, id: string): boolean {
  return id === state.shipId || id in state.ownedShips;
}

/** Fuel of an owned ship (the active ship's is state.fuel). Null if you do not own it. */
export function shipFuel(state: GameState, id: string): number | null {
  if (id === state.shipId) return state.fuel;
  return state.ownedShips[id]?.fuel ?? null;
}

/** One row of the shipyard. */
export interface ShipCatalogEntry {
  ship: ShipDef;
  owned: boolean;
  active: boolean;
  /** True when buyNow would work right now. */
  canBuy: boolean;
  /** Why it cannot be bought ("" when it can). Owned ships say "You already own this ship.". */
  reason: string;
  /** True when you own it, it is not active, and you are docked (switching is free). */
  canSwitch: boolean;
  /** This ship's fuel if you own it, otherwise null. */
  fuel: number | null;
  /** The real numbers of this ship with its upgrades (the shipyard base numbers if you do not own it). */
  stats: ShipStats;
  /** Its upgrade levels (all 0 if you do not own it). */
  upgrades: ShipUpgrades;
}

function buyBlock(state: GameState, id: string): string {
  if (!isShipId(id)) return "There is no such ship.";
  if (ownsShip(state, id)) return "You already own this ship.";
  const away = notDockedReason(state);
  if (away !== null) return state.currentJob || state.freeTrip ? "You cannot buy a ship during a flight." : away;
  const price = getShip(id).price;
  if (state.credits < price) return `Costs ${price} credits, you have ${state.credits}.`;
  return "";
}

export function shipCatalog(state: GameState): ShipCatalogEntry[] {
  return SHIP_ORDER.map((id) => {
    const ship = getShip(id);
    const owned = ownsShip(state, id);
    const reason = buyBlock(state, id);
    return {
      ship,
      owned,
      active: id === state.shipId,
      canBuy: reason === "",
      reason,
      canSwitch: owned && id !== state.shipId && !isFlying(state),
      fuel: shipFuel(state, id),
      stats: shipStats(state, id),
      upgrades: upgradeLevels(state, id),
    };
  });
}

/** Buy a ship: costs its price, starts with a full tank. Does not switch to it. */
export function buyShip(state: GameState, id: string): FleetResult {
  const reason = buyBlock(state, id);
  if (reason) return { ok: false, reason };
  const ship = getShip(id);
  return {
    ok: true,
    state: {
      ...state,
      credits: state.credits - ship.price,
      ownedShips: { ...state.ownedShips, [id]: { fuel: ship.fuelTankSize } },
    },
  };
}

/** Switch the active ship (free, docked only). Each ship keeps its own fuel. */
export function switchShip(state: GameState, id: string): FleetResult {
  if (!isShipId(id)) return { ok: false, reason: "There is no such ship." };
  if (isFlying(state)) return { ok: false, reason: "You cannot switch ships during a flight." };
  if (id === state.shipId) return { ok: false, reason: "That ship is already active." };
  const target = state.ownedShips[id];
  if (!target) return { ok: false, reason: "You do not own this ship." };
  const others = { ...state.ownedShips };
  delete others[id];
  others[state.shipId] = { fuel: state.fuel };
  return { ok: true, state: clampFuelToTanks({ ...state, shipId: id, fuel: target.fuel, ownedShips: others }) };
}
