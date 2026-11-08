// LAYER 4: the dock. Every planet has exactly ONE: a surface OUTPOST or an orbiting STATION.
// Outposts can be bought by the player and give two perks. Stations cannot be bought.

import { GOODS } from "./data/goods";
import { generateOutpostName, generateStationName } from "./names";
import type { Planet } from "./planet";
import { rngFor, type Seed } from "./random";

export type DockKind = "OUTPOST" | "STATION";

export interface OutpostPerks {
  /** Fraction off fuel prices, e.g. 0.12 = 12% cheaper fuel. */
  fuelDiscount: number;
  /** Credits earned per universe hour while owned. */
  passiveIncomePerHour: number;
}

export interface Dock {
  /** Same id as its planet, e.g. "3:-2:5:0/2". */
  id: string;
  planetId: string;
  systemId: string;
  name: string;
  kind: DockKind;
  /** Good ids this dock makes cheaply (3). */
  produces: string[];
  /** Good ids this dock pays extra for (3). Never overlaps with `produces`. */
  wants: string[];
  hasPassengerTerminal: boolean;
  /** Credits to buy this outpost. null for stations (not for sale). */
  outpostPrice: number | null;
  /** The perks of owning it. null for stations. */
  perks: OutpostPerks | null;
}

export function generateDock(seed: Seed, planet: Planet): Dock {
  const rng = rngFor(seed, "dock", planet.id);
  // Gas giants have no surface, so they always get a station.
  const kind: DockKind = planet.type === "GAS" ? "STATION" : rng.chance(0.5) ? "OUTPOST" : "STATION";
  const name = kind === "OUTPOST" ? generateOutpostName(rng) : generateStationName(rng);

  const shuffled = rng.shuffled(GOODS.map((g) => g.id));
  const produces = shuffled.slice(0, 3);
  const wants = shuffled.slice(3, 6);

  const hasPassengerTerminal = rng.chance(kind === "STATION" ? 0.8 : 0.5);

  let outpostPrice: number | null = null;
  let perks: OutpostPerks | null = null;
  if (kind === "OUTPOST") {
    outpostPrice = Math.round(rng.float(5000, 40000) / 100) * 100;
    perks = {
      fuelDiscount: Math.round(rng.float(0.05, 0.2) * 100) / 100,
      passiveIncomePerHour: Math.max(5, Math.round(outpostPrice / 800)),
    };
  }

  return {
    id: planet.id,
    planetId: planet.id,
    systemId: planet.systemId,
    name,
    kind,
    produces,
    wants,
    hasPassengerTerminal,
    outpostPrice,
    perks,
  };
}
