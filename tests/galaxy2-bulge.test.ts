// Agent 2, stage G7: the central bulge. The most important thing here: nothing outside the bulge changed.
import { describe, expect, it } from "vitest";
import {
  BULGE,
  BULGE_OPTIONS,
  START_POINT,
  bulgeCellNumber,
  bulgeDensity,
  bulgeTable,
  cellTable,
  countInCell,
  decodeSystemNumber,
  densityAt,
  discDensityAt,
  encodeSystemNumber,
  expectedBulgeTotal,
  expectedTotal,
  findSystemById,
  galaxyChecksum,
  nearestSystems,
  systemsOfCell,
  systemsWithin,
  TooManyCellsError,
} from "../src/universe/galaxy";
import baseline from "./fixtures/galaxy-before-bulge.json";

const SEED = 12345;

function lcg(start: number): () => number {
  let a = start >>> 0;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

/** The same fingerprint the saved numbers were made with (before the bulge existed). */
function hashList(list: { id: number; x: number; y: number; z: number }[]): string {
  const s = [...list].sort((a, b) => a.id - b.id);
  let h = 0x811c9dc5;
  const feed = (n: number): void => {
    const hi = Math.floor(n / 4294967296);
    const lo = n - hi * 4294967296;
    for (const p of [lo >>> 0, hi >>> 0]) {
      h ^= p;
      h = Math.imul(h, 0x01000193) >>> 0;
      h ^= h >>> 15;
    }
  };
  for (const q of s) {
    feed(q.id);
    feed(Math.round(q.x * 1000) + 5e10);
    feed(Math.round(q.y * 1000) + 5e10);
    feed(Math.round(q.z * 1000) + 5e10);
  }
  return (h >>> 0).toString(16).padStart(8, "0") + ":" + s.length;
}

describe("nothing outside the bulge changed (numbers saved from the commit before this work)", () => {
  const idSpace = cellTable().idSpace;

  it("the saved numbers are from the old galaxy", () => {
    expect(baseline.idSpace).toBe(idSpace);
    expect(baseline.totalCells).toBe(cellTable().totalCells);
    expect(baseline.balls.length).toBe(80);
  });

  it("every old system is still there, at the same place with the same number, even inside the bulge", () => {
    for (const b of baseline.balls) {
      const old = systemsWithin(baseline.seed, b.c, b.R).filter((s) => s.id < idSpace);
      expect(hashList(old)).toBe(b.h);
    }
  });

  it("far from the bulge (more than 8,000 ly from the centre) the result is identical with nothing filtered", () => {
    let checked = 0;
    for (const b of baseline.balls) {
      if (Math.hypot(b.c.x, b.c.z) - b.R < 8000) continue;
      const all = systemsWithin(baseline.seed, b.c, b.R);
      expect(all.every((s) => s.id < idSpace)).toBe(true);
      expect(hashList(all)).toBe(b.h);
      checked++;
    }
    expect(checked).toBeGreaterThan(35);
  });

  it("the start checksum and the start system are unchanged", () => {
    expect(galaxyChecksum(SEED, START_POINT, 2000)).toBe(baseline.startChecksum);
    expect(baseline.startChecksum).toBe("d0019075");
    expect(nearestSystems(SEED, START_POINT, 1)[0]?.id).toBe(44776692551);
  });

  it("the bulge radius is well below 8,000 ly and the bulge numbers all come after the disc numbers", () => {
    for (const shape of Object.values(BULGE_OPTIONS)) {
      expect(shape.radius).toBeLessThan(6000);
      expect(bulgeTable(shape).firstId).toBe(idSpace);
    }
    expect(BULGE.radius).toBeLessThan(6000);
  });
});

describe("the bulge shape", () => {
  it("is densest at the centre, adds to the disc, and is exactly 0 at and beyond its radius", () => {
    const origin = { x: 0, y: 0, z: 0 };
    expect(bulgeDensity(origin)).toBe(BULGE.peak);
    expect(densityAt(origin)).toBeCloseTo(discDensityAt(origin) + BULGE.peak, 12);
    let last = Infinity;
    for (let s = 0; s < BULGE.radius; s += 50) {
      const d = bulgeDensity({ x: s, y: 0, z: 0 });
      expect(d).toBeLessThanOrEqual(last);
      last = d;
    }
    expect(bulgeDensity({ x: BULGE.radius, y: 0, z: 0 })).toBe(0);
    expect(bulgeDensity({ x: 0, y: BULGE.radius * BULGE.flatten, z: 0 })).toBe(0);
    expect(bulgeDensity({ x: BULGE.radius * 0.9, y: BULGE.radius * 0.9, z: BULGE.radius * 0.9 })).toBe(0);
    expect(densityAt({ x: 8000, y: 0, z: 0 })).toBe(discDensityAt({ x: 8000, y: 0, z: 0 }));
  });

  it("reaches well above the thin disc and is a little flattened", () => {
    const up = { x: 0, y: 0.4 * BULGE.radius, z: 0 }; // far above the 1,000 ly the disc reaches
    expect(discDensityAt(up)).toBe(0);
    expect(densityAt(up)).toBeGreaterThan(0);
    const side = bulgeDensity({ x: 0.5 * BULGE.radius * BULGE.flatten, y: 0, z: 0 });
    const high = bulgeDensity({ x: 0, y: 0.5 * BULGE.radius * BULGE.flatten, z: 0 });
    expect(high).toBeLessThan(side); // same distance, less dense going up: the bulge is flattened
  });

  it("the three options have the sizes shown to Andy and the totals stay between 17 and 22 billion", () => {
    expect(BULGE_OPTIONS.A.radius).toBe(2000);
    expect(BULGE_OPTIONS.B.radius).toBe(3500);
    expect(BULGE_OPTIONS.C.radius).toBe(5500);
    const disc = expectedTotal() - expectedBulgeTotal();
    for (const shape of Object.values(BULGE_OPTIONS)) {
      const total = disc + expectedBulgeTotal(shape);
      expect(total).toBeGreaterThan(17e9);
      expect(total).toBeLessThan(22e9);
    }
  });
});

describe("bulge cells", () => {
  const table = bulgeTable();
  const disc = cellTable();

  it("the table is tidy: levels follow each other with no gaps, zones tile 0 to the radius", () => {
    let local = 0;
    let s = 0;
    for (const l of table.levels) {
      expect(l.firstLocal).toBe(local);
      expect(l.sIn).toBe(s);
      local += l.cellCount;
      s = l.sOut;
      expect(l.pBound).toBeGreaterThan(0);
      expect(l.pBound).toBeLessThanOrEqual(1);
    }
    expect(s).toBe(BULGE.radius);
    expect(table.totalCells).toBe(local);
    expect(table.firstCell).toBe(disc.totalCells);
    expect(table.idEnd).toBe(disc.idSpace + local * 8);
    expect(table.idEnd).toBeLessThan(17 ** 9); // codes keep 9 symbols
  });

  it("every system of a bulge cell lies inside that cell's cube and inside its zone, and numbers belong to the cell", () => {
    const rnd = lcg(5);
    let found = 0;
    for (let i = 0; i < 4000; i++) {
      const local = Math.floor(rnd() * table.totalCells);
      const level = [...table.levels].reverse().find((l) => local >= l.firstLocal)!;
      const inLevel = local - level.firstLocal;
      const ix = inLevel % level.across;
      const iz = Math.floor(inLevel / level.across) % level.across;
      const iy = Math.floor(inLevel / (level.across * level.across));
      expect(bulgeCellNumber(level, ix, iy, iz)).toBe(local);
      for (const sys of systemsOfCell(SEED, table.firstCell + local)) {
        found++;
        const e = level.edge;
        const x0 = (ix - level.across / 2) * e;
        const y0 = (iy - level.up / 2) * e;
        const z0 = (iz - level.across / 2) * e;
        expect(sys.x).toBeGreaterThanOrEqual(x0);
        expect(sys.x).toBeLessThan(x0 + e);
        expect(sys.y).toBeGreaterThanOrEqual(y0);
        expect(sys.y).toBeLessThan(y0 + e);
        expect(sys.z).toBeGreaterThanOrEqual(z0);
        expect(sys.z).toBeLessThan(z0 + e);
        const s = Math.hypot(sys.x, sys.z, sys.y / BULGE.flatten);
        expect(s).toBeGreaterThanOrEqual(level.sIn);
        expect(s).toBeLessThan(level.sOut);
        expect(Math.floor(sys.id / 8)).toBe(table.firstCell + local);
        expect(findSystemById(SEED, sys.id)).toEqual(sys);
      }
    }
    expect(found).toBeGreaterThan(100);
  });

  it("systemsWithin finds exactly the systems a slow search over the bulge cells finds (centre, up, side, edge)", () => {
    const spots = [
      { c: { x: 5, y: 2, z: -3 }, r: 12 },
      { c: { x: 0, y: 1800, z: 0 }, r: 30 },
      { c: { x: 1200, y: 600, z: -900 }, r: 40 },
      { c: { x: 3300, y: 100, z: 200 }, r: 120 },
      { c: { x: 0, y: -2500, z: 1000 }, r: 150 },
      { c: { x: 550, y: 0, z: 0 }, r: 40 }, // across a zone border (zone edge at 0.1 x 5,500 = 550 ly)
    ];
    for (const { c, r } of spots) {
      const fast = new Set(systemsWithin(SEED, c, r).filter((s) => s.id >= disc.idSpace).map((s) => s.id));
      const slow = new Set<number>();
      for (const level of table.levels) {
        const e = level.edge;
        const lo = (v: number, half: number): number => Math.max(0, Math.floor((v - r + half * e) / e));
        const hi = (v: number, half: number, n: number): number => Math.min(n - 1, Math.floor((v + r + half * e) / e));
        for (let iy = lo(c.y, level.up / 2); iy <= hi(c.y, level.up / 2, level.up); iy++)
          for (let iz = lo(c.z, level.across / 2); iz <= hi(c.z, level.across / 2, level.across); iz++)
            for (let ix = lo(c.x, level.across / 2); ix <= hi(c.x, level.across / 2, level.across); ix++)
              for (const s of systemsOfCell(SEED, table.firstCell + bulgeCellNumber(level, ix, iy, iz))) if (Math.hypot(s.x - c.x, s.y - c.y, s.z - c.z) <= r) slow.add(s.id);
      }
      expect(fast.size).toBe(slow.size);
      for (const id of slow) expect(fast.has(id)).toBe(true);
    }
  });

  it("no system number is used twice, disc and bulge together, and every bulge system is inside the bulge", () => {
    const found = systemsWithin(SEED, { x: 0, y: 0, z: 0 }, 50);
    const ids = new Set(found.map((s) => s.id));
    expect(ids.size).toBe(found.length);
    const bulgeOnes = found.filter((s) => s.id >= disc.idSpace);
    expect(bulgeOnes.length).toBeGreaterThan(500);
    expect(found.length - bulgeOnes.length).toBeGreaterThan(500);
    for (const s of bulgeOnes) expect(Math.hypot(s.x, s.z, s.y / BULGE.flatten)).toBeLessThan(BULGE.radius);
    const wide = systemsWithin(SEED, { x: 0, y: 2000, z: 0 }, 200);
    expect(new Set(wide.map((s) => s.id)).size).toBe(wide.length);
  });

  it("is deterministic: the same seed gives the same bulge, another seed a different one", () => {
    const a = systemsWithin(SEED, { x: 100, y: 500, z: 100 }, 80);
    const b = systemsWithin(SEED, { x: 100, y: 500, z: 100 }, 80);
    expect(b).toEqual(a);
    const c = systemsWithin(7, { x: 100, y: 500, z: 100 }, 80);
    expect(hashList(c)).not.toBe(hashList(a));
  });

  it("counting random bulge cells agrees with the integral of the bulge density", () => {
    const rnd = lcg(99);
    const n = 150000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const c = countInCell(SEED, table.firstCell + Math.floor(rnd() * table.totalCells));
      sum += c;
      sumSq += c * c;
    }
    const mean = sum / n;
    const sd = Math.sqrt(sumSq / n - mean * mean);
    const estimate = mean * table.totalCells;
    const error = (3 * sd) / Math.sqrt(n) / mean;
    expect(Math.abs(estimate / expectedBulgeTotal() - 1)).toBeLessThan(Math.max(error, 0.02));
  });

  it("system numbers and codes round trip, bulge numbers have 9 symbols, disc codes did not change", () => {
    const rnd = lcg(3);
    for (let i = 0; i < 2000; i++) {
      const id = disc.idSpace + Math.floor(rnd() * (table.idEnd - disc.idSpace));
      const code = encodeSystemNumber(id);
      expect(code.replace("-", "").length).toBe(9);
      expect(decodeSystemNumber(code)).toBe(id);
    }
    expect(encodeSystemNumber(44776692551)).toBe("JR62R-MT37"); // the start system
  });

  it("a runaway query at the dense centre still stops", () => {
    expect(() => systemsWithin(SEED, { x: 0, y: 0, z: 0 }, 5000, { maxCells: 100000 })).toThrow(TooManyCellsError);
    expect(() => systemsWithin(SEED, { x: 0, y: 1500, z: 0 }, 3000, { maxCells: 50000 })).toThrow(TooManyCellsError);
  });

  it("nearestSystems finds the nearest ones in the middle of the bulge, high above the disc, and in the disc", () => {
    for (const c of [{ x: 0, y: 0, z: 0 }, { x: 0, y: 2000, z: 0 }, { x: 1500, y: -1800, z: 500 }]) {
      const near = nearestSystems(SEED, c, 300);
      expect(near.length).toBe(300);
      for (let i = 1; i < near.length; i++) expect((near[i] as { distance: number }).distance).toBeGreaterThanOrEqual((near[i - 1] as { distance: number }).distance);
      const radius = (near[299] as { distance: number }).distance;
      expect(systemsWithin(SEED, c, radius).length).toBeGreaterThanOrEqual(300);
    }
  });
});
