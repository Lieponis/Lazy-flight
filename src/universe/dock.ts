// LAYER 4: the dock. A dock is a surface OUTPOST or an orbiting STATION on one planet.
// Universe version 2: only some planets have a dock. Each system has 1 to 3 docks, more for bigger systems.
// Outposts can be bought by the player and give two perks. Stations cannot be bought.

import { GOODS } from "./data/goods";
import { generateOutpostName, generateStationName } from "./names";
import { getSite } from "./galaxy";
import { generatePlanet, type Planet } from "./planet";
import { rngFor, type Seed } from "./random";
import { DOCK_PLANETS_PER_DOCK, MAX_DOCKS_PER_SYSTEM } from "./settings";
import { generateSystem, type StarSystem } from "./system";

export type DockKind = "OUTPOST" | "STATION";

export interface OutpostPerks {
  /** Fraction off fuel prices, e.g. 0.12 = 12% cheaper fuel. */
  fuelDiscount: number;
  /** Credits earned per universe hour while owned. */
  passiveIncomePerHour: number;
}

export interface Dock {
  /** Same id as the planet it sits on, e.g. "3:-2:5:0/2". */
  id: string;
  planetId: string;
  systemId: string;
  /** Short flavour name, unique inside its system: "Lazy Anchor Outpost". */
  name: string;
  /** Unique in the whole universe: "<short name>, <planet name>", e.g. "Lazy Anchor Outpost, Kopipex 4F-92 II". */
  fullName: string;
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

function kindAndFirstName(seed: Seed, planet: Planet): { rng: ReturnType<typeof rngFor>; kind: DockKind; name: string } {
  const rng = rngFor(seed, "dock", planet.id);
  // Gas giants have no surface, so they always get a station.
  const kind: DockKind = planet.type === "GAS" ? "STATION" : rng.chance(0.5) ? "OUTPOST" : "STATION";
  const name = kind === "OUTPOST" ? generateOutpostName(rng) : generateStationName(rng);
  return { rng, kind, name };
}

const shortNameCache = new Map<string, Map<number, string>>();

/**
 * The short names of a system's docks, made unique inside the system. The first dock (smallest planet number)
 * keeps its first-rolled name; a later dock whose name is already taken re-rolls from its own "dockname" stream.
 * A planet without a dock (generateDock allows that) is treated as the last one, so it never changes real docks.
 */
function shortNamesOf(seed: Seed, system: StarSystem, extraIndex: number): Map<number, string> {
  const key = `${seed}|${system.id}|${extraIndex}`;
  const hit = shortNameCache.get(key);
  if (hit) return hit;
  const order = dockPlanetIndexes(seed, system);
  if (extraIndex >= 0 && !order.includes(extraIndex)) order.push(extraIndex);
  const used = new Set<string>();
  const names = new Map<number, string>();
  for (const index of order) {
    const planet = generatePlanet(seed, system, index);
    const first = kindAndFirstName(seed, planet);
    let name = first.name;
    for (let attempt = 0; used.has(name.toLowerCase()) && attempt < 60; attempt++) {
      const rng = rngFor(seed, "dockname", planet.id, attempt);
      name = first.kind === "OUTPOST" ? generateOutpostName(rng) : generateStationName(rng);
    }
    if (used.has(name.toLowerCase())) name = `${name} ${index + 1}`; // practically never
    used.add(name.toLowerCase());
    names.set(index, name);
  }
  if (shortNameCache.size > 2000) shortNameCache.clear();
  shortNameCache.set(key, names);
  return names;
}

const planetNameCache = new Map<string, string>();

function shortNameFor(seed: Seed, planet: Planet): string {
  // Asked for very often (every dock lookup), so remember the answer. Names only depend on seed and planet id.
  const key = `${seed}|${planet.id}`;
  const known = planetNameCache.get(key);
  if (known !== undefined) return known;
  const name = computeShortName(seed, planet);
  if (planetNameCache.size > 20000) planetNameCache.clear();
  planetNameCache.set(key, name);
  return name;
}

function computeShortName(seed: Seed, planet: Planet): string {
  const site = getSite(seed, planet.systemId);
  if (!site) return kindAndFirstName(seed, planet).name;
  const system = generateSystem(seed, site);
  const real = dockPlanetIndexes(seed, system).includes(planet.index);
  return shortNamesOf(seed, system, real ? -1 : planet.index).get(planet.index) ?? kindAndFirstName(seed, planet).name;
}

export function generateDock(seed: Seed, planet: Planet): Dock {
  const { rng, kind } = kindAndFirstName(seed, planet);
  const name = shortNameFor(seed, planet);

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
    fullName: `${name}, ${planet.name}`,
    kind,
    produces,
    wants,
    hasPassengerTerminal,
    outpostPrice,
    perks,
  };
}

/** The most docks a system with this many planets can have: round(planets / 3.3), from 1 to 3. */
export function maxDocksFor(planetCount: number): number {
  const raw = Math.round(planetCount / DOCK_PLANETS_PER_DOCK);
  return Math.min(MAX_DOCKS_PER_SYSTEM, Math.max(1, raw));
}

/**
 * Which planets of a system have a dock, as planet numbers (smallest first).
 * The number of docks is a random whole number from 1 to maxDocksFor(planetCount); the planets are picked
 * at random. Both come only from the seed and the system, so the answer never changes.
 */
export function dockPlanetIndexes(seed: Seed, system: StarSystem): number[] {
  const rng = rngFor(seed, "docks", system.id);
  const count = rng.int(1, maxDocksFor(system.planetCount));
  const all: number[] = [];
  for (let i = 0; i < system.planetCount; i++) all.push(i);
  return rng.shuffled(all).slice(0, count).sort((a, b) => a - b);
}

/** All docks of a system, in planet order. Always 1 to 3 docks. */
export function docksOf(seed: Seed, system: StarSystem): Dock[] {
  return dockPlanetIndexes(seed, system).map((index) => generateDock(seed, generatePlanet(seed, system, index)));
}
