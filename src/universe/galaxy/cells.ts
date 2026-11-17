// THE CELLS. Every point of the disc belongs to exactly one cell. Nothing is stored: the table below is worked out
// from the numbers in params.ts in a few milliseconds.
//
// The scheme in plain words ("polar cells"):
//  - The disc is cut into thin RINGS ("slabs") around the centre. A ring is as wide as a cell, and a cell is about
//    CELL_SCALE times the local spacing, so rings are thin in the crowded centre and wide at the rim (about 3,900 rings).
//  - Each ring is cut into equal SECTORS (like pizza slices), so a cell is roughly a cube; and into equal LAYERS
//    from the bottom to the top of the disc at that ring.
//  - So a cell = (ring, sector, layer). Cells tile the whole disc: no gaps, no overlaps, no double counting.
//  - A cell has a small fixed number of "slots" (a g x g x g lattice, g from 1 to 3). Each slot MAY hold one system:
//    a hash of (seed, system number) gives the slot's position inside the cell and a coin toss with probability
//    density x volume / slots. So the expected number of systems in any region equals the integral of the density,
//    and the number of systems in a cell never needs to be counted first.
//  - System number = (cell number x SLOTS) + slot. Cell numbers run ring after ring, centre first, so numbers (and
//    therefore codes) are short near the centre and longer towards the rim. The number turns back into ring, sector,
//    layer and slot by a binary search over 3,900 numbers (no search over cells).

import { armAmplitude, spacingAt, thicknessAt } from "./density";
import { TWO_PI } from "./detmath";
import { CELL_SCALE, DISC_RADIUS } from "./params";

export interface Slab {
  index: number;
  /** Inner and outer radius of the ring (ly). */
  ra: number;
  rb: number;
  /** Number of sectors and layers. */
  sectors: number;
  layers: number;
  /** Half of the height of the ring's cells (the ring reaches from -ymax to +ymax). */
  ymax: number;
  /** Angle of one sector (radians) and height of one layer (ly). */
  dTheta: number;
  dy: number;
  /** Volume of one cell (cubic ly). */
  volume: number;
  /** Slot lattice size g, slots per cell g^3, and the largest chance that a slot holds a system (at most 1). */
  g: number;
  slotCount: number;
  pBound: number;
  /** Number of the first cell of the ring (cells are numbered ring after ring). */
  firstCell: number;
}

export interface CellTable {
  slabs: Slab[];
  /** Slots reserved per cell in system numbers (largest g^3 of any ring). */
  slots: number;
  totalCells: number;
  /** One more than the largest possible system number. */
  idSpace: number;
}

/** Largest slot lattice per cell: 2 x 2 x 2 = 8 slots. */
const MAX_G = 2;

let table: CellTable | null = null;
let rbList: Float64Array;
let firstCellList: Float64Array;

function build(): CellTable {
  const slabs: Slab[] = [];
  let ra = 0;
  let cells = 0;
  let maxG = 1;
  while (ra < DISC_RADIUS) {
    // Make the ring a little narrower until its cells need at most 2 x 2 x 2 slots (keeps system numbers short).
    let shrink = 1;
    for (;;) {
      const edge = CELL_SCALE * shrink * spacingAt(ra);
      let rb = ra + edge;
      if (DISC_RADIUS - rb < 0.5 * edge) rb = DISC_RADIUS;
      const rm = 0.5 * (ra + rb);
      const sectors = Math.max(1, Math.round((TWO_PI * rm) / edge));
      const ymax = 0.5 * thicknessAt(ra);
      const layers = Math.max(1, Math.round((2 * ymax) / edge));
      const dTheta = TWO_PI / sectors;
      const dy = (2 * ymax) / layers;
      const volume = 0.5 * dTheta * (rb * rb - ra * ra) * dy;
      // The densest possible spot of the ring: closest to the centre, middle of an arm, middle of the thickness.
      const s = spacingAt(ra);
      const wanted = ((1 + armAmplitude(rb)) / (s * s * s)) * volume;
      let g = 1;
      while (g * g * g < wanted) g++;
      if (g > MAX_G) {
        shrink *= 0.9;
        if (shrink < 0.05) throw new Error(`galaxy2: ring ${slabs.length} cannot be built`);
        continue;
      }
      maxG = Math.max(maxG, g);
      const slotCount = g * g * g;
      slabs.push({ index: slabs.length, ra, rb, sectors, layers, ymax, dTheta, dy, volume, g, slotCount, pBound: wanted / slotCount, firstCell: cells });
      cells += sectors * layers;
      ra = rb;
      break;
    }
  }
  rbList = new Float64Array(slabs.map((s) => s.rb));
  firstCellList = new Float64Array(slabs.map((s) => s.firstCell));
  const slots = maxG * maxG * maxG;
  return { slabs, slots, totalCells: cells, idSpace: cells * slots };
}

/** The cell table (built the first time it is asked for). */
export function cellTable(): CellTable {
  if (!table) table = build();
  return table;
}

/** The ring that contains distance r from the centre (r from 0 up to the disc radius; beyond it: the last ring). */
export function slabIndexAt(r: number): number {
  const t = cellTable();
  let lo = 0;
  let hi = t.slabs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (r < (rbList[mid] as number)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** The ring that contains a cell number (binary search). */
export function slabOfCell(cell: number): number {
  const t = cellTable();
  let lo = 0;
  let hi = t.slabs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((firstCellList[mid] as number) <= cell) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export interface CellAddress {
  slab: number;
  sector: number;
  layer: number;
}

export function cellNumber(slab: Slab, sector: number, layer: number): number {
  return slab.firstCell + sector * slab.layers + layer;
}

export function cellAddress(cell: number): CellAddress {
  const slab = cellTable().slabs[slabOfCell(cell)] as Slab;
  const local = cell - slab.firstCell;
  const sector = Math.floor(local / slab.layers);
  return { slab: slab.index, sector, layer: local - sector * slab.layers };
}
