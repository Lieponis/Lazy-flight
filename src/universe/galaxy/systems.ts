// Systems: where they are, whether a given system number exists, and the queries the map and the game need.

import { slabIndexAt, cellTable, cellAddress, cellNumber, type Slab } from "./cells";
import { densityPolar, densityAt, type Vec3 } from "./density";
import { sincosDet, SC } from "./detmath";
import { hashNumber, partOf, seedToInt } from "./hash";
import { DISC_RADIUS, ODD_TWIN, ODD_WANDER } from "./params";
import type { Seed } from "../random";

export interface GalaxySystem {
  /** The system number: unique, whole, and it turns back into the cell and slot (see cells.ts). */
  id: number;
  x: number;
  y: number;
  z: number;
}

export interface NearSystem extends GalaxySystem {
  /** Distance from the query centre (ly). */
  distance: number;
}


/** Works out the system in one slot. Returns false if the slot is empty (the chance said no). Writes into `out`. */
function slotSystem(seed32: number, slab: Slab, sector: number, layer: number, slot: number, id: number, out: GalaxySystem): boolean {
  if (slot >= slab.slotCount) return false;
  const h = hashNumber(seed32, id);
  const chance = partOf(h, 0);
  if (chance >= slab.pBound) return false; // quick no, before any heavy maths

  const g = slab.g;
  const kind = partOf(h, 1);
  let ux: number;
  let uy: number;
  let uz: number;
  if (kind < ODD_TWIN) {
    // Twin: sits right next to where the next slot would put its system (a close pair).
    const other = (slot + 1) % slab.slotCount;
    const ho = hashNumber(seed32, id - slot + other);
    const i = other % g;
    const j = Math.floor(other / g) % g;
    const l = Math.floor(other / (g * g));
    ux = (i + 0.2 + 0.6 * partOf(ho, 2)) / g + (partOf(h, 5) - 0.5) * (0.4 / g);
    uy = (j + 0.2 + 0.6 * partOf(ho, 3)) / g + (partOf(h, 6) - 0.5) * (0.4 / g);
    uz = (l + 0.2 + 0.6 * partOf(ho, 4)) / g + (partOf(h, 7) - 0.5) * (0.4 / g);
  } else if (kind < ODD_TWIN + ODD_WANDER) {
    // Wanderer: anywhere in the cell (can be very near or far from the others).
    ux = partOf(h, 2);
    uy = partOf(h, 3);
    uz = partOf(h, 4);
  } else {
    // Normal: anywhere inside its own little box of the lattice (a "jittered grid": even, but no visible grid).
    const i = slot % g;
    const j = Math.floor(slot / g) % g;
    const l = Math.floor(slot / (g * g));
    ux = (i + partOf(h, 2)) / g;
    uy = (j + partOf(h, 3)) / g;
    uz = (l + partOf(h, 4)) / g;
  }
  if (ux < 0) ux = 0;
  else if (ux > 0.999999) ux = 0.999999;
  if (uy < 0) uy = 0;
  else if (uy > 0.999999) uy = 0.999999;
  if (uz < 0) uz = 0;
  else if (uz > 0.999999) uz = 0.999999;

  const r = Math.sqrt(slab.ra * slab.ra + ux * (slab.rb * slab.rb - slab.ra * slab.ra)); // equal area, so even
  const theta = (sector + uy) * slab.dTheta;
  const y = -slab.ymax + (layer + uz) * slab.dy;
  sincosDet(theta);
  const c = SC.cos;
  const s = SC.sin;
  // The coin toss: chance of a system here = density x cell volume / slots.
  if (chance >= (densityPolar(r, y, c, s) * slab.volume) / slab.slotCount) return false;
  out.id = id;
  out.x = r * c;
  out.y = y;
  out.z = r * s;
  return true;
}

const scratch: GalaxySystem = { id: 0, x: 0, y: 0, z: 0 };

/** The system with this number, or null if there is none (a number can be a free slot, or not in the galaxy). */
export function findSystemById(seed: Seed, id: number): GalaxySystem | null {
  if (!Number.isSafeInteger(id) || id < 0) return null;
  const table = cellTable();
  if (id >= table.idSpace) return null;
  const slot = id % table.slots;
  const cell = (id - slot) / table.slots;
  const a = cellAddress(cell);
  const slab = table.slabs[a.slab] as Slab;
  if (!slotSystem(seedToInt(seed), slab, a.sector, a.layer, slot, id, scratch)) return null;
  return { id, x: scratch.x, y: scratch.y, z: scratch.z };
}

/** Calls `visit` for every system in one cell. */
function eachSystemInCell(seed32: number, slab: Slab, sector: number, layer: number, visit: (s: GalaxySystem) => void): void {
  const base = cellNumber(slab, sector, layer) * cellTable().slots;
  for (let slot = 0; slot < slab.slotCount; slot++) {
    if (slotSystem(seed32, slab, sector, layer, slot, base + slot, scratch)) visit(scratch);
  }
}

/** All systems of one cell, by cell number (for tests and tools). */
export function systemsOfCell(seed: Seed, cell: number): GalaxySystem[] {
  const a = cellAddress(cell);
  const slab = cellTable().slabs[a.slab] as Slab;
  const out: GalaxySystem[] = [];
  eachSystemInCell(seedToInt(seed), slab, a.sector, a.layer, (s) => out.push({ id: s.id, x: s.x, y: s.y, z: s.z }));
  return out;
}

/** How many systems are in a cell. */
export function countInCell(seed: Seed, cell: number): number {
  let n = 0;
  const a = cellAddress(cell);
  eachSystemInCell(seedToInt(seed), cellTable().slabs[a.slab] as Slab, a.sector, a.layer, () => n++);
  return n;
}

export class TooManyCellsError extends Error {}

/** A cell budget stops a runaway query (for example a huge radius at the centre). */
const DEFAULT_MAX_CELLS = 20_000_000;

/**
 * Visits every cell that may touch the ball (center, radius). It is careful (never misses a cell) rather than exact:
 * cells a little outside the ball are visited too, the caller checks real distances.
 */
function eachCellNear(center: Vec3, radius: number, maxCells: number, visit: (slab: Slab, sector: number, layer: number) => void): void {
  const cr = Math.sqrt(center.x * center.x + center.z * center.z);
  const rLo = Math.max(0, cr - radius);
  const rHi = Math.min(DISC_RADIUS, cr + radius);
  if (rLo >= DISC_RADIUS) return;
  const slabs = cellTable().slabs;
  let phi = Math.atan2(center.z, center.x);
  if (phi < 0) phi += 2 * Math.PI;
  let visited = 0;
  for (let si = slabIndexAt(rLo); si <= slabIndexAt(rHi); si++) {
    const slab = slabs[si] as Slab;
    const yLo = Math.max(-slab.ymax, center.y - radius);
    const yHi = Math.min(slab.ymax, center.y + radius);
    if (yLo > yHi) continue;
    const l0 = Math.max(0, Math.floor((yLo + slab.ymax) / slab.dy));
    const l1 = Math.min(slab.layers - 1, Math.floor((yHi + slab.ymax) / slab.dy));
    // Which sectors? Where the ball meets this ring, the angle from the centre's direction is at most `half`.
    let half = Math.PI;
    if (cr > radius) {
      const r0 = Math.max(slab.ra, cr - radius);
      const r1 = Math.min(slab.rb, cr + radius);
      if (r0 > r1) continue;
      const angle = (r: number): number => Math.acos(Math.max(-1, Math.min(1, (r * r + cr * cr - radius * radius) / (2 * r * cr))));
      half = Math.max(angle(r0), angle(r1));
      const tangent = Math.sqrt(cr * cr - radius * radius);
      if (tangent >= r0 && tangent <= r1) half = Math.max(half, Math.asin(Math.min(1, radius / cr)));
      half += 1e-9;
    }
    const total = slab.sectors;
    const first = Math.floor((phi - half) / slab.dTheta) - 1;
    const last = Math.floor((phi + half) / slab.dTheta) + 1;
    const count = last - first + 1 >= total ? total : last - first + 1;
    const start = count === total ? 0 : first;
    const rm = 0.5 * (slab.ra + slab.rb);
    const cellHalf = 0.5 * Math.sqrt((slab.rb - slab.ra) ** 2 + (slab.rb * slab.dTheta) ** 2 + slab.dy * slab.dy) + 1e-6;
    for (let k = 0; k < count; k++) {
      const sector = (((start + k) % total) + total) % total;
      const theta = (sector + 0.5) * slab.dTheta;
      const mx = rm * Math.cos(theta) - center.x;
      const mz = rm * Math.sin(theta) - center.z;
      for (let layer = l0; layer <= l1; layer++) {
        const my = -slab.ymax + (layer + 0.5) * slab.dy - center.y;
        const reach = radius + cellHalf;
        if (mx * mx + my * my + mz * mz > reach * reach) continue;
        if (++visited > maxCells) throw new TooManyCellsError(`query touches more than ${maxCells} cells`);
        visit(slab, sector, layer);
      }
    }
  }
}

export interface QueryOptions {
  /** Stop with TooManyCellsError after visiting this many cells (default 20 million). */
  maxCells?: number;
}

/** All systems within `radius` ly of `center`, unsorted. */
export function systemsWithin(seed: Seed, center: Vec3, radius: number, options: QueryOptions = {}): NearSystem[] {
  const seed32 = seedToInt(seed);
  const out: NearSystem[] = [];
  const limit = radius * radius;
  eachCellNear(center, radius, options.maxCells ?? DEFAULT_MAX_CELLS, (slab, sector, layer) => {
    eachSystemInCell(seed32, slab, sector, layer, (s) => {
      const dx = s.x - center.x;
      const dy = s.y - center.y;
      const dz = s.z - center.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 <= limit) out.push({ id: s.id, x: s.x, y: s.y, z: s.z, distance: Math.sqrt(d2) });
    });
  });
  return out;
}

/**
 * The nearest `count` systems to `center`, nearest first. It asks for all systems within a radius that should hold
 * about that many (from the local density) and widens the radius if there are too few.
 */
export function nearestSystems(seed: Seed, center: Vec3, count: number, options: QueryOptions = {}): NearSystem[] {
  if (count <= 0) return [];
  const density = densityAt(center);
  let radius = density > 0 ? Math.cbrt((3 * count) / (4 * Math.PI * density)) * 1.05 : 100;
  radius = Math.max(radius, 1);
  const reach = 4 * DISC_RADIUS;
  for (;;) {
    const found = systemsWithin(seed, center, radius, options);
    if (found.length >= count || radius > reach) {
      found.sort((a, b) => a.distance - b.distance || a.id - b.id);
      return found.length > count ? found.slice(0, count) : found;
    }
    const grow = found.length === 0 ? 2 : Math.min(2, Math.max(1.15, Math.cbrt(count / found.length) * 1.1));
    radius *= grow;
  }
}

