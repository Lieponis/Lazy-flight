// Paint jobs (liveries): cosmetic only, no gameplay effect. The render layer owns the art, names and descriptions
// (`liveriesFor` in src/render/assets); the game only needs the ids. A test fails if this table and the render list differ.
// Each ship you own keeps the paint jobs it owns and the one it wears (stored by ship id, like upgrades).
// Plain functions: they never throw, a failure gives a plain reason.

import { isFlying, notDockedReason } from "./location";
import { ownsShip } from "./fleet";
import { LIVERY_PRICE } from "./settings";
import { isShipId } from "./ships";
import type { GameState } from "./state";

/** The default paint of every ship (the look from before paint jobs existed). Always owned, always free. */
export const STANDARD_LIVERY = "standard";

/** Paint job ids per ship, the standard one first. Must equal the render list (a test checks it). */
export const LIVERY_IDS: Record<string, string[]> = {
  "cargo-hauler": [STANDARD_LIVERY, "hazard-yellow", "teal-line", "orange-express"],
  "passenger-liner": [STANDARD_LIVERY, "sky-blue", "spring-green", "rose-line"],
  scout: [STANDARD_LIVERY, "survey-lime", "rescue-red", "electric-blue"],
};

/** What one ship keeps: the ids it owns (always includes "standard") and the one it wears. */
export interface ShipLivery {
  owned: string[];
  worn: string;
}

/** The paint job ids a ship can have (empty for an unknown ship). */
export function liveryIdsFor(shipId: string): string[] {
  return LIVERY_IDS[shipId] ?? [];
}

export function isLiveryId(shipId: string, liveryId: string): boolean {
  return liveryIdsFor(shipId).includes(liveryId);
}

/** Repairs one saved entry: only known ids, no repeats, "standard" always owned, the worn one must be owned. */
export function cleanShipLivery(shipId: string, raw: unknown): ShipLivery {
  const known = liveryIdsFor(shipId);
  const entry = raw && typeof raw === "object" ? (raw as { owned?: unknown; worn?: unknown }) : {};
  const saved = Array.isArray(entry.owned) ? (entry.owned as unknown[]) : [];
  // Catalog order keeps the saved list tidy and the same every time.
  const owned = known.filter((id) => id === STANDARD_LIVERY || saved.includes(id));
  const worn = typeof entry.worn === "string" && owned.includes(entry.worn) ? entry.worn : STANDARD_LIVERY;
  return { owned, worn };
}

/** What a ship owns and wears (the default for a ship with no entry). */
export function shipLiveryOf(state: GameState, shipId: string): ShipLivery {
  const saved = (state.shipLiveries ?? {})[shipId];
  return saved ? cleanShipLivery(shipId, saved) : { owned: [STANDARD_LIVERY], worn: STANDARD_LIVERY };
}

/** The paint job a ship wears now ("standard" if none was chosen or the ship is unknown). */
export function currentLivery(state: GameState, shipId: string): string {
  return shipLiveryOf(state, shipId).worn;
}

export function ownsLivery(state: GameState, shipId: string, liveryId: string): boolean {
  return shipLiveryOf(state, shipId).owned.includes(liveryId);
}

/** One row of a paint shop list. Names and descriptions come from the render list (by id). */
export interface LiveryRow {
  id: string;
  owned: boolean;
  worn: boolean;
  /** 0 for the standard paint and for paint jobs you already own. */
  price: number;
  /** True when buyLivery would work right now. */
  canBuy: boolean;
  /** Why it cannot be bought ("" when it can; owned ones say so). */
  reason: string;
  /** True when you own it, are not wearing it, and are not flying. */
  canWear: boolean;
}

function buyBlock(state: GameState, shipId: string, liveryId: string): string {
  if (!isShipId(shipId)) return "There is no such ship.";
  if (!isLiveryId(shipId, liveryId)) return "There is no such paint job.";
  if (!ownsShip(state, shipId)) return "You do not own this ship.";
  if (liveryId === STANDARD_LIVERY) return "The standard paint is free and always yours.";
  if (ownsLivery(state, shipId, liveryId)) return "You already own this paint job.";
  const away = notDockedReason(state);
  if (away !== null) return state.currentJob || state.freeTrip ? "You cannot buy paint during a flight." : away;
  if (state.credits < LIVERY_PRICE) return `Costs ${LIVERY_PRICE} credits, you have ${state.credits}.`;
  return "";
}

/** The paint jobs of a ship, for a paint shop screen. Empty for an unknown ship. */
export function liveryCatalog(state: GameState, shipId: string): LiveryRow[] {
  if (!isShipId(shipId)) return [];
  const mine = shipLiveryOf(state, shipId);
  const yours = ownsShip(state, shipId);
  return liveryIdsFor(shipId).map((id) => {
    const owned = yours && mine.owned.includes(id);
    const reason = buyBlock(state, shipId, id);
    return {
      id,
      owned,
      worn: yours && mine.worn === id,
      price: owned || id === STANDARD_LIVERY ? 0 : LIVERY_PRICE,
      canBuy: reason === "",
      reason,
      canWear: owned && mine.worn !== id && !isFlying(state),
    };
  });
}

export type LiveryResult = { ok: true; state: GameState; price: number } | { ok: false; reason: string };

function withLivery(state: GameState, shipId: string, entry: ShipLivery): GameState {
  return { ...state, shipLiveries: { ...(state.shipLiveries ?? {}), [shipId]: entry } };
}

/** Buy a paint job for a ship you own (any of your ships, not only the active one). Docked only. Does not put it on. */
export function buyLivery(state: GameState, shipId: string, liveryId: string): LiveryResult {
  const reason = buyBlock(state, shipId, liveryId);
  if (reason) return { ok: false, reason };
  const mine = shipLiveryOf(state, shipId);
  const owned = liveryIdsFor(shipId).filter((id) => id === liveryId || mine.owned.includes(id));
  return { ok: true, price: LIVERY_PRICE, state: { ...withLivery(state, shipId, { owned, worn: mine.worn }), credits: state.credits - LIVERY_PRICE } };
}

/** Put on a paint job you own (free; "standard" is always available). Not during a flight. */
export function setLivery(state: GameState, shipId: string, liveryId: string): LiveryResult {
  if (!isShipId(shipId)) return { ok: false, reason: "There is no such ship." };
  if (!isLiveryId(shipId, liveryId)) return { ok: false, reason: "There is no such paint job." };
  if (!ownsShip(state, shipId)) return { ok: false, reason: "You do not own this ship." };
  if (isFlying(state)) return { ok: false, reason: "You cannot change paint during a flight." };
  const mine = shipLiveryOf(state, shipId);
  if (!mine.owned.includes(liveryId)) return { ok: false, reason: `You have not bought this paint job yet. It costs ${LIVERY_PRICE} credits.` };
  if (mine.worn === liveryId) return { ok: false, reason: "The ship already wears this paint." };
  return { ok: true, price: 0, state: withLivery(state, shipId, { owned: mine.owned, worn: liveryId }) };
}
