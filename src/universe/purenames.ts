// Pure names: some systems near the home point have a name that is just words ("Lazy Harbour"), no code.
//
// The rule that keeps them unique in an endless universe: the NAME chooses its system, not the other way round.
//  - There is a fixed list of curated names (PURE_NAMES).
//  - Each name tries a fixed series of "slots" (a sector and a number inside it), chosen by a hash of the seed, the
//    name and the try number, inside the cube of sectors around the origin (PURE_NAME_REGION). The first slot that
//    holds a real system nobody else has claimed becomes the name's one owner. Names are handled in list order.
//  - A system gets a pure name only if it is the owner of one. So no name can have two owners, and no system two names.
// Everything is worked out from the seed alone (nothing stored); the table below is only a memory of that result.

import { PURE_ADJECTIVES, PURE_NOUNS } from "./data/purenames";
import { SYSTEM_ENDS, SYSTEM_STARTS } from "./data/words";
import { getSitesInSector, parseSystemId } from "./galaxy";
import { rngFor, type Seed } from "./random";
import { PURE_NAME_REGION } from "./settings";

/** How many slots a name may try before it is left without a system (almost never happens). */
const MAX_TRIES = 200;

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
  /** system id -> its pure name */
  bySystem: Map<string, string>;
  /** lower-case pure name -> system id */
  byName: Map<string, string>;
}

const tables = new Map<string, Table>();
const MAX_TABLES = 24;

function tableFor(seed: Seed): Table {
  const key = String(seed);
  const found = tables.get(key);
  if (found) return found;

  const bySystem = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const name of PURE_NAMES) {
    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
      const rng = rngFor(seed, "purename", name, attempt);
      const sx = rng.int(-PURE_NAME_REGION, PURE_NAME_REGION - 1);
      const sy = rng.int(-PURE_NAME_REGION, PURE_NAME_REGION - 1);
      const sz = rng.int(-PURE_NAME_REGION, PURE_NAME_REGION - 1);
      const index = rng.int(0, 2);
      const site = getSitesInSector(seed, sx, sy, sz)[index];
      if (!site || bySystem.has(site.id)) continue;
      bySystem.set(site.id, name);
      byName.set(name.toLowerCase(), site.id);
      break;
    }
  }
  const table = { bySystem, byName };
  if (tables.size >= MAX_TABLES) tables.delete(tables.keys().next().value as string);
  tables.set(key, table);
  return table;
}

function insideRegion(systemId: string): boolean {
  const p = parseSystemId(systemId);
  if (!p) return false;
  const r = PURE_NAME_REGION;
  return [p.sx, p.sy, p.sz].every((v) => v >= -r && v < r);
}

/** The pure name of a system, or null if it has none (most systems have none). */
export function pureNameOf(seed: Seed, systemId: string): string | null {
  if (!insideRegion(systemId)) return null;
  return tableFor(seed).bySystem.get(systemId) ?? null;
}

/** The system that owns a pure name (any capitals), or null. */
export function systemIdOfPureName(seed: Seed, name: string): string | null {
  return tableFor(seed).byName.get(name.trim().replace(/\s+/g, " ").toLowerCase()) ?? null;
}

/** How many pure names found a system in this seed's universe. */
export function pureNameCount(seed: Seed): number {
  return tableFor(seed).bySystem.size;
}
