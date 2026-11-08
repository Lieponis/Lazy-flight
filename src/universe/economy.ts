// The economy: prices of goods at a dock, at a given time slot (1 slot = 1 universe hour).
//
// price = base price x (how this dock feels about the good) x (slow drift over time)
//  - goods the dock PRODUCES are cheap (about 55% to 80% of base),
//  - goods the dock WANTS are expensive (about 130% to 170%),
//  - everything else is near base (90% to 110%).
// The drift is a gentle wave plus a little smooth wobble, so prices move slowly, never jump.
// The final price is always kept between MIN_PRICE_MULTIPLIER and MAX_PRICE_MULTIPLIER of base.

import { GOODS, getGood, type Good } from "./data/goods";
import type { Dock } from "./dock";
import { hashUnit, rngFor, type Seed } from "./random";
import { MAX_PRICE_MULTIPLIER, MIN_PRICE_MULTIPLIER } from "./settings";

export type MarketRole = "PRODUCES" | "WANTS" | "NEUTRAL";

export interface MarketEntry {
  good: Good;
  role: MarketRole;
  /** Credits per unit right now (whole number, at least 1). */
  price: number;
}

export function roleOf(dock: Dock, goodId: string): MarketRole {
  if (dock.produces.includes(goodId)) return "PRODUCES";
  if (dock.wants.includes(goodId)) return "WANTS";
  return "NEUTRAL";
}

/** Smooth value from 0 to 1 that changes slowly: blends one random value per 12 slots. */
function smoothNoise(seed: Seed, dockId: string, goodId: string, slot: number): number {
  const block = 12;
  const k = Math.floor(slot / block);
  const t = (slot - k * block) / block;
  const a = hashUnit(seed, "price-noise", dockId, goodId, k);
  const b = hashUnit(seed, "price-noise", dockId, goodId, k + 1);
  const eased = t * t * (3 - 2 * t);
  return a + (b - a) * eased;
}

/** Credits per unit of one good at a dock in a time slot. */
export function getPrice(seed: Seed, dock: Dock, goodId: string, slot: number): number {
  const good = getGood(goodId);
  if (!good) throw new Error(`Unknown good: ${goodId}`);
  const role = roleOf(dock, goodId);
  const rng = rngFor(seed, "market", dock.id, goodId);
  const roleMultiplier =
    role === "PRODUCES" ? rng.float(0.55, 0.8) : role === "WANTS" ? rng.float(1.3, 1.7) : rng.float(0.9, 1.1);
  const period = rng.float(24, 72); // slots for one full wave
  const phase = rng.float(0, Math.PI * 2);
  const wave = 0.08 * Math.sin((slot / period) * Math.PI * 2 + phase);
  const wobble = (smoothNoise(seed, dock.id, goodId, slot) - 0.5) * 0.1;
  const multiplier = Math.min(MAX_PRICE_MULTIPLIER, Math.max(MIN_PRICE_MULTIPLIER, roleMultiplier * (1 + wave + wobble)));
  return Math.max(1, Math.round(good.basePrice * multiplier));
}

/** The full price list of a dock in a time slot (all goods, in the order of GOODS). */
export function getMarket(seed: Seed, dock: Dock, slot: number): MarketEntry[] {
  return GOODS.map((good) => ({
    good,
    role: roleOf(dock, good.id),
    price: getPrice(seed, dock, good.id, slot),
  }));
}
