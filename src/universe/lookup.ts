// Handy "find by id" and "list nearby" functions that combine the layers.
// (This file sits on top of all the layers, so it may use all of them.)

import { dockPlanetIndexes, docksOf, generateDock, type Dock } from "./dock";
import { distance, getSite, listSitesNear, type Vec3 } from "./galaxy";
import { generatePlanet, generatePlanets, type Planet } from "./planet";
import { systemIdOfPureName } from "./purenames";
import type { Seed } from "./random";
import { decodeSystemCode, normalizeSystemCode } from "./syscode";
import { generateSystem, type StarSystem } from "./system";

/** Finds a system by id (like "3:-2:5:0"). Null if it does not exist. */
export function getSystem(seed: Seed, systemId: string): StarSystem | null {
  const site = getSite(seed, systemId);
  return site ? generateSystem(seed, site) : null;
}

/** All planets of a system by id. Empty list if the system does not exist. */
export function getPlanetsOfSystem(seed: Seed, systemId: string): Planet[] {
  const system = getSystem(seed, systemId);
  return system ? generatePlanets(seed, system) : [];
}

/** Splits a dock/planet id like "3:-2:5:0/2" into system id and planet number. */
export function parseDockId(dockId: string): { systemId: string; planetIndex: number } | null {
  const slash = dockId.indexOf("/");
  if (slash < 0) return null;
  const planetText = dockId.slice(slash + 1);
  if (!/^\d+$/.test(planetText)) return null;
  return { systemId: dockId.slice(0, slash), planetIndex: Number(planetText) };
}

/** Finds a planet by id. Null if it does not exist. */
export function getPlanet(seed: Seed, planetId: string): Planet | null {
  const parsed = parseDockId(planetId);
  if (!parsed) return null;
  const system = getSystem(seed, parsed.systemId);
  if (!system || parsed.planetIndex >= system.planetCount) return null;
  return generatePlanet(seed, system, parsed.planetIndex);
}

/** True if this id (same as a planet id, like "3:-2:5:0/2") is a planet that has a dock. */
export function hasDock(seed: Seed, dockId: string): boolean {
  const parsed = parseDockId(dockId);
  if (!parsed) return false;
  const system = getSystem(seed, parsed.systemId);
  if (!system || parsed.planetIndex >= system.planetCount) return false;
  return dockPlanetIndexes(seed, system).includes(parsed.planetIndex);
}

/** Finds a dock by id (same id as its planet). Null if there is no such dock, including planets without a dock. */
export function getDock(seed: Seed, dockId: string): Dock | null {
  if (!hasDock(seed, dockId)) return null;
  const planet = getPlanet(seed, dockId);
  return planet ? generateDock(seed, planet) : null;
}

/** All docks of a system by id (1 to 3, in planet order). Empty list if the system does not exist. */
export function getDocksOfSystem(seed: Seed, systemId: string): Dock[] {
  const system = getSystem(seed, systemId);
  return system ? docksOf(seed, system) : [];
}

/** Systems within `radius` light years of a point, nearest first. */
export function listSystemsNear(seed: Seed, center: Vec3, radius: number): StarSystem[] {
  return listSitesNear(seed, center, radius).map((site) => generateSystem(seed, site));
}

/** Distance in light years between two docks (0 if in the same system). Null if either dock does not exist. */
export function distanceBetweenDocks(seed: Seed, dockIdA: string, dockIdB: string): number | null {
  if (!hasDock(seed, dockIdA) || !hasDock(seed, dockIdB)) return null;
  const a = parseDockId(dockIdA);
  const b = parseDockId(dockIdB);
  if (!a || !b) return null;
  const siteA = getSite(seed, a.systemId);
  const siteB = getSite(seed, b.systemId);
  if (!siteA || !siteB) return null;
  return distance(siteA.position, siteB.position);
}

/**
 * The dock a new game starts at: the first dock of the system nearest to the middle of the galaxy (0, 0, 0).
 * Every layer (game, save, UI, debug pages) uses this one function, so they all agree. Uses no random numbers of its own.
 * A system always has at least one dock, so the answer exists whenever the galaxy has any system.
 */
export function startDockOf(seed: Seed): Dock {
  for (const radius of [10, 20, 40, 80, 160, 320]) {
    const system = listSystemsNear(seed, { x: 0, y: 0, z: 0 }, radius)[0];
    const first = system ? docksOf(seed, system)[0] : undefined;
    if (first) return first;
  }
  throw new Error("The galaxy has no system to start in.");
}

/**
 * Find a system by what a player might type: its full name ("Kopipex 4F-92"), only its code ("4F-92", with or
 * without the hyphen), or a pure name ("Lazy Harbour"). Capitals and extra spaces do not matter.
 * Returns null if no such system exists.
 */
export function findSystemByName(seed: Seed, text: string): StarSystem | null {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return null;
  const pureId = systemIdOfPureName(seed, clean);
  if (pureId) return getSystem(seed, pureId);
  const words = clean.split(" ");
  const code = normalizeSystemCode(words[words.length - 1]!);
  if (!code) return null;
  const id = decodeSystemCode(code);
  const system = id ? getSystem(seed, id) : null;
  if (!system) return null;
  // If a word part was typed too, it must be the right one.
  if (words.length > 1 && words.slice(0, -1).join(" ").toLowerCase() !== system.baseName.toLowerCase()) return null;
  return system;
}
