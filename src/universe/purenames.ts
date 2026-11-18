// Pure names: some systems near the start have a name that is just words ("Lazy Harbour"), no code.
//
// The rule that keeps them unique in an endless universe: the NAME chooses its system, not the other way round.
//  - There is a fixed list of curated names (PURE_NAMES).
//  - Each name tries a fixed series of "slots" (a system number), chosen by a hash of the seed, the name and the try
//    number, inside a box of about PURE_REGION light years around the start point. The first slot that holds a real
//    system nobody else has claimed becomes the name's one owner. Names are handled in list order.
//  - A system gets a pure name only if it is the owner of one. So no name can have two owners, and no system two names.
// Everything is worked out from the seed alone (nothing stored); the table below is only a memory of that result.

import { PURE_ADJECTIVES, PURE_NOUNS } from "./data/purenames";
import { SYSTEM_ENDS, SYSTEM_STARTS } from "./data/words";
import { PURE_REGION, START_POINT, cellNumber, cellTable, findSystemById as findRawSystem, slabIndexAt, type Slab } from "./galaxy";
import { rngFor, type Seed } from "./random";

/** How many slots a name may try before it is left without a system (almost never happens). */
const MAX_TRIES = 300;

function buildNameList(): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const add = (name: string) => {
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      names.push(name);
    }
  };
  // "Lazy Harbour": every adjective with every noun.
  for (const adjective of PURE_ADJECTIVES) for (const noun of PURE_NOUNS) add(`${adjective} ${noun}`);
  // Coined one-word names like "Kopilon": start + end of the system word lists.
  for (const start of SYSTEM_STARTS) for (const end of SYSTEM_ENDS) add(start + end);
  return names;
}

/** All pure names in a fixed order (more than 4,000). */
export const PURE_NAMES: readonly string[] = buildNameList();

interface Table {
  /** system number -> its pure name */
  bySystem: Map<number, string>;
  /** lower-case pure name -> system number */
  byName: Map<string, number>;
}

const tables = new Map<string, Table>();
const MAX_TABLES = 24;

/** Where the start point sits, in the ring table (worked out once). */
function startGeometry(): { ring: number; angle: number } {
  const ring = slabIndexAt(Math.sqrt(START_POINT.x * START_POINT.x + START_POINT.z * START_POINT.z));
  return { ring, angle: Math.atan2(START_POINT.z, START_POINT.x) };
}

function tableFor(seed: Seed): Table {
  const key = String(seed);
  const found = tables.get(key);
  if (found) return found;

  const galaxy = cellTable();
  const { ring: startRing, angle: startAngle } = startGeometry();
  const startSlab = galaxy.slabs[startRing] as Slab;
  const bySystem = new Map<number, string>();
  const byName = new Map<string, number>();
  for (const name of PURE_NAMES) {
    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
      const rng = rngFor(seed, "purename", name, attempt);
      // A random ring near the start ring, a random sector near the start direction, a random layer near the plane.
      const ringSpan = Math.max(1, Math.round(PURE_REGION / Math.max(1, startSlab.rb - startSlab.ra)));
      const ring = Math.min(galaxy.slabs.length - 1, Math.max(0, startRing + rng.int(-ringSpan, ringSpan)));
      const slab = galaxy.slabs[ring] as Slab;
      const sectorSpan = Math.max(1, Math.round(PURE_REGION / (0.5 * (slab.ra + slab.rb) * slab.dTheta)));
      const centreSector = Math.floor((((startAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / slab.dTheta);
      const sector = (((centreSector + rng.int(-sectorSpan, sectorSpan)) % slab.sectors) + slab.sectors) % slab.sectors;
      const layerSpan = Math.max(1, Math.round(PURE_REGION / slab.dy));
      const middle = Math.floor(slab.layers / 2);
      const layer = Math.min(slab.layers - 1, Math.max(0, middle + rng.int(-layerSpan, layerSpan)));
      const slot = rng.int(0, slab.slotCount - 1);
      const id = cellNumber(slab, sector, layer) * galaxy.slots + slot;
      if (bySystem.has(id)) continue;
      if (!findRawSystem(seed, id)) continue;
      bySystem.set(id, name);
      byName.set(name.toLowerCase(), id);
      break;
    }
  }
  const table = { bySystem, byName };
  if (tables.size >= MAX_TABLES) tables.delete(tables.keys().next().value as string);
  tables.set(key, table);
  return table;
}

/** The pure name of a system, or null if it has none (most systems have none). */
export function pureNameOf(seed: Seed, systemId: number): string | null {
  // The table only holds systems near the start, so a plain lookup is enough.
  return tableFor(seed).bySystem.get(systemId) ?? null;
}

/** The system that owns a pure name (any capitals), or null. */
export function systemIdOfPureName(seed: Seed, name: string): number | null {
  return tableFor(seed).byName.get(name.trim().replace(/\s+/g, " ").toLowerCase()) ?? null;
}

/** How many pure names found a system in this seed's universe. */
export function pureNameCount(seed: Seed): number {
  return tableFor(seed).bySystem.size;
}
