// Handy "find by id" and "list nearby" functions that combine the layers.
// (This file sits on top of all the layers, so it may use all of them.)

import { generateDock, type Dock } from "./dock";
import { distance, getSite, listSitesNear, type Vec3 } from "./galaxy";
import { generatePlanet, generatePlanets, type Planet } from "./planet";
import type { Seed } from "./random";
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

/** Finds a dock by id (same id as its planet). Null if it does not exist. */
export function getDock(seed: Seed, dockId: string): Dock | null {
  const planet = getPlanet(seed, dockId);
  return planet ? generateDock(seed, planet) : null;
}

/** Systems within `radius` light years of a point, nearest first. */
export function listSystemsNear(seed: Seed, center: Vec3, radius: number): StarSystem[] {
  return listSitesNear(seed, center, radius).map((site) => generateSystem(seed, site));
}

/** Distance in light years between two docks (0 if in the same system). Null if either does not exist. */
export function distanceBetweenDocks(seed: Seed, dockIdA: string, dockIdB: string): number | null {
  const a = parseDockId(dockIdA);
  const b = parseDockId(dockIdB);
  if (!a || !b) return null;
  const siteA = getSite(seed, a.systemId);
  const siteB = getSite(seed, b.systemId);
  if (!siteA || !siteB) return null;
  return distance(siteA.position, siteB.position);
}
