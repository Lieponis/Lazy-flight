// LAYER 1: the galaxy. An endless 3D grid of cubes ("sectors"), each holding 0 to 3 star systems.
// Where a system sits is worked out from the seed plus the cube's coordinates, nothing is stored.

import { rngFor, type Seed } from "./random";
import { SECTOR_SIZE } from "./settings";

/** A point in space, in light years. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Where a star system is. This is only the "address"; the system layer adds the name, star, planets. */
export interface SystemSite {
  /** Text like "3:-2:5:0" (cube x, y, z, then number inside the cube). Unique. */
  id: string;
  sx: number;
  sy: number;
  sz: number;
  index: number;
  position: Vec3;
}

export function systemIdOf(sx: number, sy: number, sz: number, index: number): string {
  return `${sx}:${sy}:${sz}:${index}`;
}

/** Reads an id like "3:-2:5:0". Returns null if the text is not a valid id. */
export function parseSystemId(id: string): { sx: number; sy: number; sz: number; index: number } | null {
  const parts = id.split(":");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^-?\d+$/.test(p) ? Number(p) : NaN));
  const [sx, sy, sz, index] = nums as [number, number, number, number];
  if ([sx, sy, sz, index].some((n) => Number.isNaN(n)) || index < 0) return null;
  return { sx, sy, sz, index };
}

/** Straight-line distance between two points in light years. */
export function distance(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Which cube a point is in. */
export function sectorOf(p: Vec3): { sx: number; sy: number; sz: number } {
  return {
    sx: Math.floor(p.x / SECTOR_SIZE),
    sy: Math.floor(p.y / SECTOR_SIZE),
    sz: Math.floor(p.z / SECTOR_SIZE),
  };
}

/** All star systems inside one cube of space. */
export function getSitesInSector(seed: Seed, sx: number, sy: number, sz: number): SystemSite[] {
  const rng = rngFor(seed, "galaxy", sx, sy, sz);
  // 0 systems 25%, 1 system 45%, 2 systems 25%, 3 systems 5%  (about 1.1 on average)
  const roll = rng.next();
  const count = roll < 0.25 ? 0 : roll < 0.7 ? 1 : roll < 0.95 ? 2 : 3;
  const sites: SystemSite[] = [];
  for (let index = 0; index < count; index++) {
    sites.push({
      id: systemIdOf(sx, sy, sz, index),
      sx,
      sy,
      sz,
      index,
      position: {
        x: (sx + rng.next()) * SECTOR_SIZE,
        y: (sy + rng.next()) * SECTOR_SIZE,
        z: (sz + rng.next()) * SECTOR_SIZE,
      },
    });
  }
  return sites;
}

/** Finds one system by its id. Returns null if no such system exists in this universe. */
export function getSite(seed: Seed, id: string): SystemSite | null {
  const parsed = parseSystemId(id);
  if (!parsed) return null;
  const sites = getSitesInSector(seed, parsed.sx, parsed.sy, parsed.sz);
  return sites[parsed.index] ?? null;
}

/** Distance in light years between two systems given by id. Null if either does not exist. */
export function distanceBetweenSystems(seed: Seed, idA: string, idB: string): number | null {
  const a = getSite(seed, idA);
  const b = getSite(seed, idB);
  if (!a || !b) return null;
  return distance(a.position, b.position);
}

/** All systems within `radius` light years of a point, nearest first (ties broken by id). */
export function listSitesNear(seed: Seed, center: Vec3, radius: number): SystemSite[] {
  const lo = sectorOf({ x: center.x - radius, y: center.y - radius, z: center.z - radius });
  const hi = sectorOf({ x: center.x + radius, y: center.y + radius, z: center.z + radius });
  const found: { site: SystemSite; d: number }[] = [];
  for (let sx = lo.sx; sx <= hi.sx; sx++) {
    for (let sy = lo.sy; sy <= hi.sy; sy++) {
      for (let sz = lo.sz; sz <= hi.sz; sz++) {
        for (const site of getSitesInSector(seed, sx, sy, sz)) {
          const d = distance(site.position, center);
          if (d <= radius) found.push({ site, d });
        }
      }
    }
  }
  found.sort((a, b) => a.d - b.d || (a.site.id < b.site.id ? -1 : a.site.id > b.site.id ? 1 : 0));
  return found.map((f) => f.site);
}
