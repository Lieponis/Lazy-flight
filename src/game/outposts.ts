// Outposts: a home base the player can buy (surface outposts only; stations are never for sale).
// Perks of owning one (numbers in settings.ts), both for the whole star system the outpost is in:
//   1. cheaper fuel at every dock of that system
//   2. bonus pay on jobs that end in that system
// The state keeps just the list of owned dock ids (and its length as a plain count).

import { OUTPOST_DELIVERY_BONUS_PERCENT, OUTPOST_FUEL_DISCOUNT_PERCENT, OUTPOST_PRICE_FACTOR } from "./settings";
import type { GameState } from "./state";

/** "3:-2:5:0/2" -> "3:-2:5:0" (dock ids are "<system id>/<planet number>"). */
export function systemOfDock(dockId: string): string {
  const cut = dockId.lastIndexOf("/");
  return cut < 0 ? dockId : dockId.slice(0, cut);
}

export function ownsOutpost(state: GameState, dockId: string): boolean {
  return state.ownedOutposts.includes(dockId);
}

/** True if you own an outpost anywhere in the star system of this dock. */
export function ownsOutpostInSystemOf(state: GameState, dockId: string): boolean {
  const system = systemOfDock(dockId);
  return state.ownedOutposts.some((id) => systemOfDock(id) === system);
}

/** Percent off fuel at this dock (0 when you own no outpost in its system). */
export function fuelDiscountPercentAt(state: GameState, dockId: string): number {
  return ownsOutpostInSystemOf(state, dockId) ? clampPercent(OUTPOST_FUEL_DISCOUNT_PERCENT) : 0;
}

/** Percent extra pay for a job that ends at this dock (0 when you own no outpost in its system). */
export function deliveryBonusPercentAt(state: GameState, dockId: string): number {
  return ownsOutpostInSystemOf(state, dockId) ? Math.max(0, OUTPOST_DELIVERY_BONUS_PERCENT) : 0;
}

function clampPercent(p: number): number {
  return Math.min(90, Math.max(0, p)); // fuel is never free
}

/** The facts about a dock that the rules need (the Game reads them from the universe). */
export interface DockFacts {
  id: string;
  kind: "OUTPOST" | "STATION";
  /** The universe's price for an outpost, or null for a station. */
  outpostPrice: number | null;
}

/** What this outpost costs, in whole credits. Null if the dock is not for sale (a station). */
export function outpostPrice(dock: DockFacts): number | null {
  if (dock.kind !== "OUTPOST" || dock.outpostPrice === null) return null;
  return Math.max(1, Math.round(dock.outpostPrice * OUTPOST_PRICE_FACTOR));
}

/** Why this dock cannot be bought right now, or "" if it can. */
export function outpostBlock(state: GameState, dock: DockFacts): string {
  const price = outpostPrice(dock);
  if (price === null) return "Stations are not for sale. Only outposts are.";
  if (ownsOutpost(state, dock.id)) return "You already own this outpost.";
  if (state.currentJob) return "You cannot buy an outpost during a flight.";
  if (state.currentDockId !== dock.id) return "You can only buy an outpost where you are docked.";
  if (state.credits < price) return `Costs ${price} credits, you have ${state.credits}.`;
  return "";
}

export type BuyOutpostResult = { ok: true; state: GameState; price: number } | { ok: false; reason: string };

/** Buy the outpost at this dock: costs its price, adds it to your list. */
export function buyOutpost(state: GameState, dock: DockFacts): BuyOutpostResult {
  const reason = outpostBlock(state, dock);
  if (reason) return { ok: false, reason };
  const price = outpostPrice(dock) ?? 0;
  const owned = [...state.ownedOutposts, dock.id];
  return {
    ok: true,
    price,
    // The price paid is kept, so a later rebuild of the universe can refund exactly this amount.
    state: { ...state, credits: state.credits - price, ownedOutposts: owned, outpostPrices: { ...state.outpostPrices, [dock.id]: price }, outpostCount: owned.length },
  };
}
