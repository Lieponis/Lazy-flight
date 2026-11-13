// Counts how names look around a point: how many systems have a pure name, how long names get, and whether any
// two things (systems, planets, docks) share a full name. Used by the debug page and by tests. It only READS.

import { distance, type Vec3 } from "./galaxy";
import { getDock, getPlanetsOfSystem, listSystemsNear } from "./lookup";
import type { Seed } from "./random";

export interface NameStats {
  seed: Seed;
  systems: number;
  pureSystems: number;
  planets: number;
  docks: number;
  /** Longest full name of each kind in the sample. */
  longestSystem: string;
  longestPlanet: string;
  longestDock: string;
  /** Names that appeared more than once in the sample (systems, planets and dock full names together). Must be 0. */
  collisions: number;
  /** Systems whose name is empty or longer than the limits in settings. Must be 0. */
  badLengths: number;
}

export function nameStats(seed: Seed, center: Vec3 = { x: 0, y: 0, z: 0 }, radius = 35, maxDockRadius = radius): NameStats {
  const seen = new Set<string>();
  const stats: NameStats = {
    seed,
    systems: 0,
    pureSystems: 0,
    planets: 0,
    docks: 0,
    longestSystem: "",
    longestPlanet: "",
    longestDock: "",
    collisions: 0,
    badLengths: 0,
  };
  const take = (name: string): void => {
    const key = name.toLowerCase();
    if (seen.has(key)) stats.collisions++;
    seen.add(key);
  };
  for (const system of listSystemsNear(seed, center, radius)) {
    stats.systems++;
    if (system.isPure) stats.pureSystems++;
    take(system.name);
    if (system.name.length > stats.longestSystem.length) stats.longestSystem = system.name;
    if (system.name.trim() === "") stats.badLengths++;
    if (distance(system.position, center) > maxDockRadius) continue;
    for (const planet of getPlanetsOfSystem(seed, system.id)) {
      stats.planets++;
      take(planet.name);
      if (planet.name.length > stats.longestPlanet.length) stats.longestPlanet = planet.name;
      const dock = getDock(seed, planet.id);
      if (!dock) continue;
      stats.docks++;
      take(dock.fullName);
      if (dock.fullName.length > stats.longestDock.length) stats.longestDock = dock.fullName;
    }
  }
  return stats;
}
