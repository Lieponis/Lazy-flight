// Handy "find by id" and "find nearby" functions that combine the layers.
// (This file sits on top of all the layers, so it may use all of them.)
//
// IDS in universe version 3:
//   system id  = the system number, a plain whole number, e.g. 28113904412
//   planet id  = "<system number>/<planet number>", e.g. "28113904412/2"   (planet number 0 = closest to the star)
//   dock id    = the id of the planet it sits on (only planets that have a dock)
// Every id turns back into its parts without searching (parseSystemId, parsePlanetId). Ids of the old kind
// ("3:-2:5:0", "3:-2:5:0/2") never exist: every function here answers null / false / [] for them (see isLegacyId).

import { dockPlanetIndexes, docksOf, generateDock, type Dock } from "./dock";
import { decodeSystemNumber, START_POINT } from "./galaxy";
import { generatePlanet, generatePlanets, type Planet } from "./planet";
import { systemIdOfPureName } from "./purenames";
import type { Seed } from "./random";
import { distance, getSite, nearestSites, parseSystemId, sitesWithin, type NearSite, type Vec3 } from "./sites";
import { generateSystem, type StarSystem } from "./system";

/** A system with its distance from the point it was asked from. */
export interface NearSystem {
  system: StarSystem;
  /** Light years from the query point. */
  distance: number;
}

/** A dock with where it is and its distance from the point it was asked from. */
export interface NearDock {
  dockId: string;
  systemId: number;
  /** Planet number inside the system (0 = closest to the star). */
  planetIndex: number;
  position: Vec3;
  /** Light years from the query point (docks in the same system have the same distance). */
  distance: number;
}

/** Splits a planet/dock id like "28113904412/2" into the system number and the planet number. Null for anything else. */
export function parsePlanetId(id: unknown): { systemId: number; planetIndex: number } | null {
  if (typeof id !== "string") return null;
  const slash = id.indexOf("/");
  if (slash < 0) return null;
  const planetText = id.slice(slash + 1);
  if (!/^\d{1,2}$/.test(planetText)) return null;
  const systemId = parseSystemId(id.slice(0, slash));
  if (systemId === null) return null;
  return { systemId, planetIndex: Number(planetText) };
}

/** The same function under its old name (dock ids and planet ids have the same form). */
export const parseDockId = parsePlanetId;

/** The id text of a planet or dock. */
export function planetIdOf(systemId: number, planetIndex: number): string {
  return `${systemId}/${planetIndex}`;
}

/** Finds a system by its number. Null if it does not exist (free slot, bad number, an old-style id). Touches one slot only. */
export function findSystemById(seed: Seed, systemId: unknown): StarSystem | null {
  const site = getSite(seed, systemId);
  return site ? generateSystem(seed, site) : null;
}

/** Finds a planet by id. Null if it does not exist. */
export function findPlanetById(seed: Seed, planetId: unknown): Planet | null {
  const parsed = parsePlanetId(planetId);
  if (!parsed) return null;
  const system = findSystemById(seed, parsed.systemId);
  if (!system || parsed.planetIndex >= system.planetCount) return null;
  return generatePlanet(seed, system, parsed.planetIndex);
}

/** True if this id is a planet that has a dock. */
export function hasDock(seed: Seed, dockId: unknown): boolean {
  const parsed = parsePlanetId(dockId);
  if (!parsed) return false;
  const system = findSystemById(seed, parsed.systemId);
  if (!system || parsed.planetIndex >= system.planetCount) return false;
  return dockPlanetIndexes(seed, system).includes(parsed.planetIndex);
}

/** Finds a dock by id (same id as its planet). Null if there is no such dock, including planets without a dock. */
export function findDockById(seed: Seed, dockId: unknown): Dock | null {
  const parsed = parsePlanetId(dockId);
  if (!parsed) return null;
  const system = findSystemById(seed, parsed.systemId);
  if (!system || parsed.planetIndex >= system.planetCount) return null;
  if (!dockPlanetIndexes(seed, system).includes(parsed.planetIndex)) return null;
  return generateDock(seed, generatePlanet(seed, system, parsed.planetIndex));
}

/** All planets of a system, closest to the star first. Empty list if the system does not exist. */
export function getPlanets(seed: Seed, systemId: unknown): Planet[] {
  const system = findSystemById(seed, systemId);
  return system ? generatePlanets(seed, system) : [];
}

/** All docks of a system (1 to 3, in planet order). Empty list if the system does not exist. */
export function getDocks(seed: Seed, systemId: unknown): Dock[] {
  const system = findSystemById(seed, systemId);
  return system ? docksOf(seed, system) : [];
}

// The names the other layers already use for these (kept so callers read the same).
export const getSystem = findSystemById;
export const getPlanet = findPlanetById;
export const getDock = findDockById;
export const getPlanetsOfSystem = getPlanets;
export const getDocksOfSystem = getDocks;

/** Distance in light years between two docks (0 if in the same system). Null if either dock does not exist. */
export function distanceBetweenDocks(seed: Seed, dockIdA: unknown, dockIdB: unknown): number | null {
  if (!hasDock(seed, dockIdA) || !hasDock(seed, dockIdB)) return null;
  const a = parsePlanetId(dockIdA);
  const b = parsePlanetId(dockIdB);
  if (!a || !b) return null;
  const siteA = getSite(seed, a.systemId);
  const siteB = getSite(seed, b.systemId);
  if (!siteA || !siteB) return null;
  return distance(siteA.position, siteB.position);
}

// ------------------------------------------------------------------------------------------------ nearby

/** The nearest `count` systems to a point (full systems with names), nearest first. Cost: see the README. */
export function nearestSystems(seed: Seed, center: Vec3, count: number): NearSystem[] {
  return nearestSites(seed, center, count).map((s) => ({ system: generateSystem(seed, s), distance: s.distance }));
}

/** All systems within `radius` light years (full systems), nearest first. Only for SMALL radii (the README says how small). */
export function systemsWithin(seed: Seed, center: Vec3, radius: number): NearSystem[] {
  return sitesWithin(seed, center, radius).map((s) => ({ system: generateSystem(seed, s), distance: s.distance }));
}

/** The docks of the systems in a list of sites, in site order, then planet order. */
export function docksOfSites(seed: Seed, sites: readonly NearSite[], out: NearDock[], from: number): void {
  for (let i = from; i < sites.length; i++) {
    const site = sites[i] as NearSite;
    for (const planetIndex of dockPlanetIndexes(seed, generateSystem(seed, site))) {
      out.push({ dockId: planetIdOf(site.id, planetIndex), systemId: site.id, planetIndex, position: site.position, distance: site.distance });
    }
  }
}

/**
 * The nearest `count` docks to a point, nearest first (docks of one system share a distance and come in planet order;
 * two systems at exactly the same distance: smaller number first). It looks at the nearest systems (every system has
 * 1 to 3 docks, so about count / 1.4 systems are needed) and widens the search if there are too few docks.
 */
export function nearestDocks(seed: Seed, center: Vec3, count: number): NearDock[] {
  if (count <= 0) return [];
  let systems = Math.max(4, Math.ceil(count / 1.4) + 2);
  for (;;) {
    const sites = nearestSites(seed, center, systems);
    const docks: NearDock[] = [];
    docksOfSites(seed, sites, docks, 0);
    if (docks.length >= count || sites.length < systems) return docks.slice(0, count);
    systems = Math.ceil(systems * 1.5);
  }
}

// ------------------------------------------------------------------------------------------------ the start

/**
 * The system a new game starts in: the nearest system with a dock to START_POINT (the inner edge of a spiral arm, one
 * third of the way from the centre to the rim). Every system has at least one dock, so this is simply the nearest
 * system. Two systems at exactly the same distance would be settled by the smaller system number. Other seeds (developer
 * pages) use the same point and the same rule. Uses no random numbers of its own.
 */
export function startSystem(seed: Seed): StarSystem {
  for (const count of [8, 64, 512]) {
    for (const site of nearestSites(seed, START_POINT, count)) {
      const system = generateSystem(seed, site);
      if (dockPlanetIndexes(seed, system).length > 0) return system;
    }
  }
  throw new Error("The galaxy has no system to start in.");
}

/**
 * The dock a new game starts at: the first dock (smallest planet number) of startSystem. Every layer (game, save, UI,
 * debug pages) uses this one function, so they all agree.
 */
export function startDockOf(seed: Seed): Dock {
  const system = startSystem(seed);
  const first = docksOf(seed, system)[0];
  if (!first) throw new Error("The start system has no dock.");
  return first;
}

// ------------------------------------------------------------------------------------------------ find by name

/**
 * Find a system by what a player might type: its full name ("Kopipex N2R4-5HJ7"), only its code ("N2R4-5HJ7", with or
 * without the hyphen), or a pure name ("Lazy Harbour"). Capitals and extra spaces do not matter.
 * Returns null if no such system exists.
 */
export function findSystemByName(seed: Seed, text: string): StarSystem | null {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return null;
  const pureId = systemIdOfPureName(seed, clean);
  if (pureId !== null) return findSystemById(seed, pureId);
  const words = clean.split(" ");
  const id = decodeSystemNumber(words[words.length - 1] as string);
  const system = id === null ? null : findSystemById(seed, id);
  if (!system) return null;
  // If a word part was typed too, it must be the right one.
  if (words.length > 1 && words.slice(0, -1).join(" ").toLowerCase() !== system.baseName.toLowerCase()) return null;
  return system;
}
