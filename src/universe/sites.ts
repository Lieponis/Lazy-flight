// LAYER 1: the galaxy as the other layers see it. A "site" is only the address of a system: its number and where it is.
// The real work (the spiral disc, the cells, which system numbers exist) lives in ./galaxy. Nothing is stored.

import { findSystemById as findRawSystem, nearestSystems as nearestRaw, systemsWithin as withinRaw, type NearSystem, type QueryOptions } from "./galaxy";
import type { Vec3 } from "./galaxy";
import type { Seed } from "./random";

export type { Vec3 } from "./galaxy";

/** Where a star system is. This is only the "address"; the system layer adds the name, star, planets. */
export interface SystemSite {
  /** The system number: a plain whole number from 0 up to about 4.66e10. Unique. This is the system id everywhere. */
  id: number;
  position: Vec3;
}

/** A site with its distance from the point it was asked from. */
export interface NearSite extends SystemSite {
  /** Light years from the query point. */
  distance: number;
}

/** Straight-line distance between two points in light years. */
export function distance(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function toSite(s: { id: number; x: number; y: number; z: number }): SystemSite {
  return { id: s.id, position: { x: s.x, y: s.y, z: s.z } };
}

function toNear(s: NearSystem): NearSite {
  return { id: s.id, position: { x: s.x, y: s.y, z: s.z }, distance: s.distance };
}

/** Reads a system id: a whole number, or text made only of digits. Anything else (like an old "3:-2:5:0") gives null. */
export function parseSystemId(id: unknown): number | null {
  if (typeof id === "number") return Number.isSafeInteger(id) && id >= 0 ? id : null;
  if (typeof id === "string" && /^\d{1,16}$/.test(id)) {
    const n = Number(id);
    return Number.isSafeInteger(n) ? n : null;
  }
  return null;
}

/** True for the id style of universe versions 1 and 2 ("3:-2:5:0", "3:-2:5:0/2"). Such ids never exist in version 3. */
export function isLegacyId(id: unknown): boolean {
  return typeof id === "string" && /^-?\d+:-?\d+:-?\d+:\d+(\/\d+)?$/.test(id);
}

/** Finds one system's address by its number. Null if there is no such system (a free slot, a bad number, an old id). */
export function getSite(seed: Seed, id: unknown): SystemSite | null {
  const n = parseSystemId(id);
  if (n === null) return null;
  const found = findRawSystem(seed, n);
  return found ? toSite(found) : null;
}

/** The nearest `count` systems to a point, nearest first (equal distances: smaller number first). */
export function nearestSites(seed: Seed, center: Vec3, count: number, options: QueryOptions = {}): NearSite[] {
  return nearestRaw(seed, center, count, options).map(toNear);
}

/** All systems within `radius` light years of a point, nearest first. Only for small radii (see the README). */
export function sitesWithin(seed: Seed, center: Vec3, radius: number, options: QueryOptions = {}): NearSite[] {
  return withinRaw(seed, center, radius, options)
    .sort((a, b) => a.distance - b.distance || a.id - b.id)
    .map(toNear);
}

/** Distance in light years between two systems given by id. Null if either does not exist. */
export function distanceBetweenSystems(seed: Seed, idA: unknown, idB: unknown): number | null {
  const a = getSite(seed, idA);
  const b = getSite(seed, idB);
  if (!a || !b) return null;
  return distance(a.position, b.position);
}
