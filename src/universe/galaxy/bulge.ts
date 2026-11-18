// THE BULGE CELLS (stage G7). The bulge is a second, separate set of systems on top of the disc. It has its own cells and
// its own system numbers, numbered AFTER every disc number (so no disc system, name, code or number ever changes).
//
// In plain words:
//  - The bulge is a flattened ball. It is cut into a few ZONES (nested shells, like the layers of an onion).
//  - Every zone has its own grid of cube-shaped cells ("level"). Crowded zones near the middle get small cubes, the thin
//    outer zones get big cubes. The cube sizes are picked from a short list (params.ts), never by a cube root, so
//    every device builds exactly the same table.
//  - A cell has 8 slots (2 x 2 x 2). A slot MAY hold a system: a hash of (seed, system number) gives its place inside
//    the cell and a coin toss with chance density x volume / slots. A slot only counts if its place lies inside the
//    zone of its level, so every point of the bulge belongs to exactly one zone: no gaps, no overlaps.
//  - System number = (cell number x 8) + slot, with cell numbers continuing after the last disc cell.

import { bulgeDistance, bulgeProfile } from "./density";
import type { Vec3 } from "./density";
import { cellTable } from "./cells";
import { hashNumber, partOf } from "./hash";
import { BULGE, BULGE_EDGES, BULGE_WANTED, BULGE_ZONES, ODD_TWIN, ODD_WANDER, type BulgeShape } from "./params";

export interface BulgeLevel {
  index: number;
  /** The zone: bulge distance from sIn (included) to sOut (excluded). */
  sIn: number;
  sOut: number;
  /** Cube edge (ly), cubes across (sideways) and up (height). */
  edge: number;
  across: number;
  up: number;
  /** Cells of this level and the number of its first cell (counted from the first bulge cell). */
  cellCount: number;
  firstLocal: number;
  /** Largest chance that a slot holds a system. */
  pBound: number;
}

export interface BulgeTable {
  shape: BulgeShape;
  levels: BulgeLevel[];
  /** Slots per cell (always 8). */
  slots: number;
  /** Number of the first bulge cell (= number of disc cells) and how many bulge cells there are. */
  firstCell: number;
  totalCells: number;
  /** First system number of the bulge and one more than the last. */
  firstId: number;
  idEnd: number;
}

const SLOTS = 8;
const G = 2;

const cache = new Map<BulgeShape, BulgeTable>();

/** The bulge cell table for a shape (built once, in well under a millisecond). */
export function bulgeTable(shape: BulgeShape = BULGE): BulgeTable {
  const hit = cache.get(shape);
  if (hit) return hit;
  const disc = cellTable();
  const levels: BulgeLevel[] = [];
  let local = 0;
  for (let k = 0; k + 1 < BULGE_ZONES.length; k++) {
    const sIn = (BULGE_ZONES[k] as number) * shape.radius;
    const sOut = (BULGE_ZONES[k + 1] as number) * shape.radius;
    const dens = shape.peak * bulgeProfile(sIn, shape);
    let edge = BULGE_EDGES[0] as number;
    for (const e of BULGE_EDGES) if (dens * e * e * e <= BULGE_WANTED) edge = e;
    const across = 2 * Math.ceil(sOut / edge);
    const up = 2 * Math.ceil((sOut * shape.flatten) / edge);
    const cellCount = across * across * up;
    levels.push({ index: k, sIn, sOut, edge, across, up, cellCount, firstLocal: local, pBound: Math.min(1, (dens * edge * edge * edge) / SLOTS) });
    local += cellCount;
  }
  const table: BulgeTable = {
    shape,
    levels,
    slots: SLOTS,
    firstCell: disc.totalCells,
    totalCells: local,
    firstId: disc.idSpace,
    idEnd: disc.idSpace + local * SLOTS,
  };
  cache.set(shape, table);
  return table;
}

export interface BulgeSystem {
  id: number;
  x: number;
  y: number;
  z: number;
}

/** Works out one slot of the bulge. `base` is the id of slot 0 of the cell. Returns false if the slot is empty. */
function bulgeSlot(table: BulgeTable, seed32: number, level: BulgeLevel, ix: number, iy: number, iz: number, slot: number, id: number, out: BulgeSystem): boolean {
  const h = hashNumber(seed32, id);
  const chance = partOf(h, 0);
  if (chance >= level.pBound) return false;
  const kind = partOf(h, 1);
  let ux: number;
  let uy: number;
  let uz: number;
  if (kind < ODD_TWIN) {
    const other = (slot + 1) % SLOTS;
    const ho = hashNumber(seed32, id - slot + other);
    const i = other % G;
    const j = Math.floor(other / G) % G;
    const l = Math.floor(other / (G * G));
    ux = (i + 0.2 + 0.6 * partOf(ho, 2)) / G + (partOf(h, 5) - 0.5) * (0.4 / G);
    uy = (j + 0.2 + 0.6 * partOf(ho, 3)) / G + (partOf(h, 6) - 0.5) * (0.4 / G);
    uz = (l + 0.2 + 0.6 * partOf(ho, 4)) / G + (partOf(h, 7) - 0.5) * (0.4 / G);
  } else if (kind < ODD_TWIN + ODD_WANDER) {
    ux = partOf(h, 2);
    uy = partOf(h, 3);
    uz = partOf(h, 4);
  } else {
    const i = slot % G;
    const j = Math.floor(slot / G) % G;
    const l = Math.floor(slot / (G * G));
    ux = (i + partOf(h, 2)) / G;
    uy = (j + partOf(h, 3)) / G;
    uz = (l + partOf(h, 4)) / G;
  }
  if (ux < 0) ux = 0;
  else if (ux > 0.999999) ux = 0.999999;
  if (uy < 0) uy = 0;
  else if (uy > 0.999999) uy = 0.999999;
  if (uz < 0) uz = 0;
  else if (uz > 0.999999) uz = 0.999999;
  const e = level.edge;
  const x = (ix - level.across / 2 + ux) * e;
  const y = (iy - level.up / 2 + uy) * e;
  const z = (iz - level.across / 2 + uz) * e;
  const s = bulgeDistance(x, y, z, table.shape);
  if (s < level.sIn || s >= level.sOut) return false;
  if (chance >= (table.shape.peak * bulgeProfile(s, table.shape) * e * e * e) / SLOTS) return false;
  out.id = id;
  out.x = x;
  out.y = y;
  out.z = z;
  return true;
}

export interface BulgeCellAddress {
  level: BulgeLevel;
  ix: number;
  iy: number;
  iz: number;
}

/** Turns a bulge cell number (counted from the first bulge cell) back into level and cube position. */
export function bulgeCellAddress(table: BulgeTable, local: number): BulgeCellAddress {
  if (!Number.isSafeInteger(local) || local < 0 || local >= table.totalCells) throw new Error(`bad bulge cell ${local}`);
  let level = table.levels[0] as BulgeLevel;
  for (const l of table.levels) if (local >= l.firstLocal) level = l;
  const inLevel = local - level.firstLocal;
  const ix = inLevel % level.across;
  const rest = (inLevel - ix) / level.across;
  const iz = rest % level.across;
  const iy = (rest - iz) / level.across;
  return { level, ix, iy, iz };
}

/** The bulge cell number (counted from the first bulge cell) of a level and cube position. */
export function bulgeCellNumber(level: BulgeLevel, ix: number, iy: number, iz: number): number {
  return level.firstLocal + (iy * level.across + iz) * level.across + ix;
}

const scratch: BulgeSystem = { id: 0, x: 0, y: 0, z: 0 };

/** The bulge system with this number, or null (an empty slot, or the number is not a bulge number). */
export function findBulgeSystemById(seed32: number, id: number, shape: BulgeShape = BULGE): BulgeSystem | null {
  const table = bulgeTable(shape);
  if (!Number.isSafeInteger(id) || id < table.firstId || id >= table.idEnd) return null;
  const slot = id % SLOTS;
  const cell = (id - slot) / SLOTS - table.firstCell;
  const a = bulgeCellAddress(table, cell);
  if (!bulgeSlot(table, seed32, a.level, a.ix, a.iy, a.iz, slot, id, scratch)) return null;
  return { id, x: scratch.x, y: scratch.y, z: scratch.z };
}

/** Calls `visit` for every bulge system of one cell. */
export function eachBulgeSystemInCell(table: BulgeTable, seed32: number, level: BulgeLevel, ix: number, iy: number, iz: number, visit: (s: BulgeSystem) => void): void {
  const base = (table.firstCell + bulgeCellNumber(level, ix, iy, iz)) * SLOTS;
  for (let slot = 0; slot < SLOTS; slot++) if (bulgeSlot(table, seed32, level, ix, iy, iz, slot, base + slot, scratch)) visit(scratch);
}

/** All systems of one bulge cell, by cell number counted from the first bulge cell (for tests and tools). */
export function bulgeSystemsOfCell(seed32: number, local: number, shape: BulgeShape = BULGE): BulgeSystem[] {
  const table = bulgeTable(shape);
  const a = bulgeCellAddress(table, local);
  const out: BulgeSystem[] = [];
  eachBulgeSystemInCell(table, seed32, a.level, a.ix, a.iy, a.iz, (s) => out.push({ id: s.id, x: s.x, y: s.y, z: s.z }));
  return out;
}

/**
 * Visits every bulge cell that may touch the ball (center, radius): careful (never misses one) rather than exact.
 * Returns how many cells were visited. `visit` gets the cell; stops with `onLimit` when `maxCells` is passed.
 */
export function eachBulgeCellNear(table: BulgeTable, center: Vec3, radius: number, maxCells: number, visit: (level: BulgeLevel, ix: number, iy: number, iz: number) => void): number {
  const shape = table.shape;
  const sc = bulgeDistance(center.x, center.y, center.z, shape);
  const reachS = radius / shape.flatten; // the ball, seen in the bulge's own squashed space
  if (sc - reachS >= shape.radius) return 0;
  let visited = 0;
  for (const level of table.levels) {
    if (sc + reachS < level.sIn || sc - reachS >= level.sOut) continue;
    const e = level.edge;
    const half = e * 0.5;
    const hAcross = (level.across / 2) * e;
    const hUp = (level.up / 2) * e;
    const i0 = Math.max(0, Math.floor((center.x - radius + hAcross) / e));
    const i1 = Math.min(level.across - 1, Math.floor((center.x + radius + hAcross) / e));
    const k0 = Math.max(0, Math.floor((center.z - radius + hAcross) / e));
    const k1 = Math.min(level.across - 1, Math.floor((center.z + radius + hAcross) / e));
    const j0 = Math.max(0, Math.floor((center.y - radius + hUp) / e));
    const j1 = Math.min(level.up - 1, Math.floor((center.y + radius + hUp) / e));
    const cellReach = radius + half * 1.7320508075688772 + 1e-6;
    const zoneReach = (half * 1.7320508075688772) / shape.flatten;
    for (let j = j0; j <= j1; j++) {
      const my = (j + 0.5) * e - hUp;
      const dy = my - center.y;
      for (let k = k0; k <= k1; k++) {
        const mz = (k + 0.5) * e - hAcross;
        const dz = mz - center.z;
        for (let i = i0; i <= i1; i++) {
          const mx = (i + 0.5) * e - hAcross;
          const dx = mx - center.x;
          if (dx * dx + dy * dy + dz * dz > cellReach * cellReach) continue;
          const sCell = bulgeDistance(mx, my, mz, shape);
          if (sCell + zoneReach < level.sIn || sCell - zoneReach >= level.sOut) continue;
          if (++visited > maxCells) return visited;
          visit(level, i, j, k);
        }
      }
    }
  }
  return visited;
}
