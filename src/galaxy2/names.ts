// Names: "<word> <code>" ("Kopipex N2R4-5HJ7"), and for a few systems near the start a pure name ("Lazy Harbour").
// The word part is the same word generator as today's game (it is not unique, the code makes the full name unique).
// A pure name has exactly ONE owner: the name picks its system (from a fixed series of tries, inside the start region),
// and a system gets a pure name only if it owns one. So pure names cannot repeat, even in an endless galaxy.

import { rngFor, type Seed } from "../universe/random";
import { generateSystemName } from "../universe/names";
import { PURE_NAMES } from "../universe/purenames";
import { cellNumber, cellTable, slabIndexAt, type Slab } from "./cells";
import { encodeSystemNumber } from "./code";
import { START_POINT } from "./start";
import { PURE_REGION } from "./params";
import { findSystemById } from "./systems";

export interface SystemName {
  /** The whole name: pure name, or word + code. */
  name: string;
  /** The word part (or the whole pure name). */
  word: string;
  code: string;
  isPure: boolean;
}

const MAX_TRIES = 300;

interface Owners {
  byId: Map<number, string>;
  byName: Map<string, number>;
}

const ownerCache = new Map<string, Owners>();

/** Works out which system owns each pure name (about 4,200 names, a fraction of a second, then remembered). */
function ownersFor(seed: Seed): Owners {
  const key = String(seed);
  const known = ownerCache.get(key);
  if (known) return known;
  const table = cellTable();
  const startRing = slabIndexAt(Math.sqrt(START_POINT.x ** 2 + START_POINT.z ** 2));
  const byId = new Map<number, string>();
  const byName = new Map<string, number>();
  for (const name of PURE_NAMES) {
    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
      const rng = rngFor(seed, "galaxy2-pure", name, attempt);
      // A random ring near the start ring, a random sector near the start direction, a random layer near the plane.
      const ringSpan = Math.max(1, Math.round(PURE_REGION / Math.max(1, ((table.slabs[startRing] as Slab).rb - (table.slabs[startRing] as Slab).ra))));
      const ring = Math.min(table.slabs.length - 1, Math.max(0, startRing + rng.int(-ringSpan, ringSpan)));
      const slab = table.slabs[ring] as Slab;
      const startAngle = Math.atan2(START_POINT.z, START_POINT.x);
      const sectorSpan = Math.max(1, Math.round(PURE_REGION / (0.5 * (slab.ra + slab.rb) * slab.dTheta)));
      const centreSector = Math.floor((((startAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / slab.dTheta);
      const sector = (((centreSector + rng.int(-sectorSpan, sectorSpan)) % slab.sectors) + slab.sectors) % slab.sectors;
      const layerSpan = Math.max(1, Math.round(PURE_REGION / slab.dy));
      const middle = Math.floor(slab.layers / 2);
      const layer = Math.min(slab.layers - 1, Math.max(0, middle + rng.int(-layerSpan, layerSpan)));
      const slot = rng.int(0, slab.slotCount - 1);
      const id = cellNumber(slab, sector, layer) * table.slots + slot;
      if (byId.has(id)) continue;
      if (!findSystemById(seed, id)) continue;
      byId.set(id, name);
      byName.set(name.toLowerCase(), id);
      break;
    }
  }
  const owners = { byId, byName };
  if (ownerCache.size > 8) ownerCache.clear();
  ownerCache.set(key, owners);
  return owners;
}

/** The names of a system by its number. */
export function systemName(seed: Seed, id: number): SystemName {
  const code = encodeSystemNumber(id);
  const pure = ownersFor(seed).byId.get(id) ?? null;
  if (pure) return { name: pure, word: pure, code, isPure: true };
  const word = generateSystemName(rngFor(seed, "galaxy2-word", id));
  return { name: `${word} ${code}`, word, code, isPure: false };
}

/** The system number that owns a pure name (any capitals), or null. */
export function systemNumberOfPureName(seed: Seed, name: string): number | null {
  return ownersFor(seed).byName.get(name.trim().replace(/\s+/g, " ").toLowerCase()) ?? null;
}

/** How many pure names found a system. */
export function pureNameCount(seed: Seed): number {
  return ownersFor(seed).byId.size;
}
