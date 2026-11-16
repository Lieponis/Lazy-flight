// Agent 2, stage G1: the galaxy prototype (spiral disc, about 18 billion systems, nothing stored).
import { describe, expect, it } from "vitest";
import {
  ARM_COUNT,
  DISC_RADIUS,
  START_POINT,
  cellAddress,
  cellNumber,
  cellTable,
  countInCell,
  decodeSystemNumber,
  densityAt,
  encodeSystemNumber,
  expDet,
  expectedCountIn,
  expectedTotal,
  findSystemById,
  galaxyChecksum,
  lnDet,
  nearestSystems,
  sincosDet,
  SC,
  spacingAt,
  systemsOfCell,
  systemsWithin,
  thicknessAt,
  TooManyCellsError,
  armFactor,
  type Slab,
} from "../src/galaxy2";

const SEED = 12345;

/** A small repeatable random generator for the tests (not the one being tested). */
function lcg(start: number): () => number {
  let a = start >>> 0;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

describe("exact-repeat maths", () => {
  it("agrees with Math.exp, Math.log, Math.sin and Math.cos", () => {
    for (let x = -20; x <= 20; x += 0.37) expect(Math.abs(expDet(x) / Math.exp(x) - 1)).toBeLessThan(1e-12);
    for (let x = 0.001; x < 1e6; x *= 1.7) expect(Math.abs(lnDet(x) - Math.log(x))).toBeLessThan(1e-12);
    for (let a = -300; a <= 300; a += 0.731) {
      sincosDet(a);
      expect(Math.abs(SC.sin - Math.sin(a))).toBeLessThan(1e-11);
      expect(Math.abs(SC.cos - Math.cos(a))).toBeLessThan(1e-11);
    }
  });
});

describe("the density", () => {
  it("spacing runs from about 1.8 ly at the centre to 160 ly at the rim, and the disc thins out", () => {
    expect(spacingAt(0)).toBeCloseTo(1.8, 6);
    expect(spacingAt(DISC_RADIUS)).toBeCloseTo(160, 4);
    expect(spacingAt(16667)).toBeGreaterThan(7.5);
    expect(spacingAt(16667)).toBeLessThan(9);
    for (let r = 0; r < DISC_RADIUS; r += 777) expect(spacingAt(r + 100)).toBeGreaterThan(spacingAt(r));
    expect(thicknessAt(0)).toBe(2000);
    expect(thicknessAt(DISC_RADIUS)).toBe(500);
  });

  it("is 0 outside the disc and above or below it", () => {
    expect(densityAt({ x: 50001, y: 0, z: 0 })).toBe(0);
    expect(densityAt({ x: 0, y: 1001, z: 0 })).toBe(0);
    expect(densityAt({ x: 40000, y: 300, z: 0 })).toBe(0);
    expect(densityAt({ x: 0, y: 0, z: 0 })).toBeGreaterThan(0);
  });

  it("the arms average out to exactly 1 and are strong enough to see", () => {
    for (const r of [8000, 16667, 30000]) {
      let sum = 0;
      let min = Infinity;
      let max = -Infinity;
      const n = 720;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 2 * Math.PI;
        const f = armFactor(r, Math.cos(a), Math.sin(a));
        sum += f;
        min = Math.min(min, f);
        max = Math.max(max, f);
      }
      expect(sum / n).toBeCloseTo(1, 6);
      expect(max / min).toBeGreaterThan(5);
    }
    expect(ARM_COUNT).toBeGreaterThanOrEqual(2);
  });

  it("the start point is 16,667 ly from the centre, on the edge of an arm, where spacing is 7.5 to 8.5 ly", () => {
    const r = Math.hypot(START_POINT.x, START_POINT.z);
    expect(Math.abs(r - DISC_RADIUS / 3)).toBeLessThan(1e-6);
    expect(armFactor(r, START_POINT.x / r, START_POINT.z / r)).toBeCloseTo(1, 6);
    const spacing = Math.cbrt(1 / densityAt(START_POINT));
    expect(spacing).toBeGreaterThan(7.5);
    expect(spacing).toBeLessThan(8.5);
    // the arm centre is denser, close to the start
    let best = 0;
    for (let i = 0; i < 360; i++) best = Math.max(best, densityAt({ x: r * Math.cos((i / 360) * 2 * Math.PI), y: 0, z: r * Math.sin((i / 360) * 2 * Math.PI) }));
    expect(best).toBeGreaterThan(1.7 * densityAt(START_POINT));
  });

  it("the total is between 15 and 25 billion", () => {
    expect(expectedTotal()).toBeGreaterThan(15e9);
    expect(expectedTotal()).toBeLessThan(25e9);
  });

  it("expectedCountIn adds up to the same as the total for a box around the whole disc", () => {
    const box = expectedCountIn({ x: -50000, y: -1000, z: -50000 }, { x: 50000, y: 1000, z: 50000 }, 200);
    expect(Math.abs(box / expectedTotal() - 1)).toBeLessThan(0.05);
  });
});

describe("the cells", () => {
  const table = cellTable();

  it("rings tile the disc: first starts at the centre, each starts where the last ended, the last ends at the rim", () => {
    expect(table.slabs[0]!.ra).toBe(0);
    expect(table.slabs[table.slabs.length - 1]!.rb).toBe(DISC_RADIUS);
    for (let i = 1; i < table.slabs.length; i++) expect(table.slabs[i]!.ra).toBe(table.slabs[i - 1]!.rb);
    for (const s of table.slabs) {
      expect(s.rb).toBeGreaterThan(s.ra);
      expect(s.g).toBeLessThanOrEqual(2);
      expect(s.pBound).toBeLessThanOrEqual(1);
    }
  });

  it("cell numbers are dense and turn back into the same ring, sector and layer", () => {
    expect(table.slabs[0]!.firstCell).toBe(0);
    const rnd = lcg(5);
    for (let i = 0; i < 20000; i++) {
      const cell = Math.floor(rnd() * table.totalCells);
      const a = cellAddress(cell);
      const slab = table.slabs[a.slab] as Slab;
      expect(a.sector).toBeGreaterThanOrEqual(0);
      expect(a.sector).toBeLessThan(slab.sectors);
      expect(a.layer).toBeLessThan(slab.layers);
      expect(cellNumber(slab, a.sector, a.layer)).toBe(cell);
    }
    // Ring edges: the last cell of one ring and the first of the next.
    for (let i = 1; i < table.slabs.length; i += 37) {
      const first = table.slabs[i]!.firstCell;
      expect(cellAddress(first)).toEqual({ slab: i, sector: 0, layer: 0 });
      expect(cellAddress(first - 1).slab).toBe(i - 1);
    }
  });

  it("every system lies inside its own cell (also at ring, sector and layer edges)", () => {
    const rnd = lcg(11);
    let checked = 0;
    const cells: number[] = [];
    for (let i = 0; i < 4000; i++) cells.push(Math.floor(rnd() * table.totalCells));
    for (let i = 0; i < table.slabs.length; i += 41) {
      const s = table.slabs[i]!;
      for (const [sector, layer] of [[0, 0], [s.sectors - 1, s.layers - 1], [0, s.layers - 1], [s.sectors - 1, 0]] as const) cells.push(cellNumber(s, sector, layer));
    }
    for (const cell of cells) {
      const a = cellAddress(cell);
      const slab = table.slabs[a.slab] as Slab;
      for (const s of systemsOfCell(SEED, cell)) {
        checked++;
        const r = Math.hypot(s.x, s.z);
        expect(r).toBeGreaterThanOrEqual(slab.ra - 1e-6);
        expect(r).toBeLessThanOrEqual(slab.rb + 1e-6);
        let theta = Math.atan2(s.z, s.x);
        if (theta < 0) theta += 2 * Math.PI;
        const lo = a.sector * slab.dTheta;
        const hi = (a.sector + 1) * slab.dTheta;
        const inside = (theta >= lo - 1e-9 && theta <= hi + 1e-9) || (a.sector === 0 && theta > 2 * Math.PI - 1e-9);
        expect(inside).toBe(true);
        expect(s.y).toBeGreaterThanOrEqual(-slab.ymax + a.layer * slab.dy - 1e-6);
        expect(s.y).toBeLessThanOrEqual(-slab.ymax + (a.layer + 1) * slab.dy + 1e-6);
      }
    }
    expect(checked).toBeGreaterThan(5000);
  });
});

describe("ids", () => {
  it("system numbers are unique and findSystemById gives back the same system (random cells, all rings)", () => {
    const table = cellTable();
    const rnd = lcg(21);
    const seen = new Set<number>();
    let n = 0;
    for (let i = 0; i < 6000; i++) {
      const cell = Math.floor(rnd() * table.totalCells);
      for (const s of systemsOfCell(SEED, cell)) {
        n++;
        expect(seen.has(s.id)).toBe(false);
        seen.add(s.id);
        expect(Math.floor(s.id / table.slots)).toBe(cell);
        const again = findSystemById(SEED, s.id)!;
        expect(again).toEqual(s);
      }
    }
    expect(n).toBeGreaterThan(8000);
  });

  it("numbers that are not systems give null (free slot, out of range, bad number)", () => {
    const table = cellTable();
    expect(findSystemById(SEED, -1)).toBeNull();
    expect(findSystemById(SEED, 1.5)).toBeNull();
    expect(findSystemById(SEED, table.idSpace)).toBeNull();
    let empty = 0;
    for (let id = 1_000_000; id < 1_000_400; id++) if (!findSystemById(SEED, id)) empty++;
    expect(empty).toBeGreaterThan(0);
    expect(empty).toBeLessThan(400);
  });

  it("codes: decode(encode(id)) over a large sample, unique, 4 to 9 symbols, never confusing characters", () => {
    const table = cellTable();
    const rnd = lcg(33);
    const codes = new Set<string>();
    const ids: number[] = [0, 1, 83520, 83521, table.idSpace - 1];
    for (let i = 0; i < 60000; i++) ids.push(Math.floor(rnd() * table.idSpace));
    for (let i = 0; i < 20000; i++) ids.push(i); // a run of neighbours, centre
    for (const id of ids) {
      const code = encodeSystemNumber(id);
      expect(decodeSystemNumber(code)).toBe(id);
      expect(code).toMatch(/^[2-9DHJMNPRTV]+-[2-9DHJMNPRTV]+$/);
      const symbols = code.replace("-", "").length;
      expect(symbols).toBeGreaterThanOrEqual(4);
      expect(symbols).toBeLessThanOrEqual(9);
      codes.add(code);
    }
    expect(codes.size).toBe(new Set(ids).size);
    expect(decodeSystemNumber("not a code")).toBeNull();
    expect(decodeSystemNumber("O1-23")).toBeNull();
    expect(decodeSystemNumber(encodeSystemNumber(12345).toLowerCase().replace("-", " "))).toBe(12345);
  });

  it("codes are short near the centre and longer towards the rim", () => {
    const len = (c: { x: number; y: number; z: number }) => encodeSystemNumber(nearestSystems(SEED, c, 1)[0]!.id).replace("-", "").length;
    expect(len({ x: 0, y: 0, z: 0 })).toBeLessThanOrEqual(5);
    expect(len({ x: 1000, y: 0, z: 0 })).toBeLessThanOrEqual(8);
    expect(len(START_POINT)).toBe(9);
    expect(len({ x: 49900, y: 0, z: 0 })).toBe(9);
  });
});

describe("determinism", () => {
  const spot = { x: START_POINT.x + 5, y: 3, z: START_POINT.z - 5 };

  it("same seed, same systems, run twice and in a different order", () => {
    const a = systemsWithin(SEED, spot, 40).map((s) => s.id).sort((p, q) => p - q);
    const rim = nearestSystems(SEED, { x: 48000, y: 0, z: 100 }, 50);
    const b = systemsWithin(SEED, spot, 40).map((s) => s.id).sort((p, q) => p - q);
    const rim2 = nearestSystems(SEED, { x: 48000, y: 0, z: 100 }, 50);
    expect(b).toEqual(a);
    expect(rim2).toEqual(rim);
    expect(a.length).toBeGreaterThan(100);
  });

  it("a different seed gives a different galaxy with the same structure", () => {
    const a = systemsWithin(SEED, spot, 30).length;
    const other = systemsWithin(999, spot, 30);
    expect(other.map((s) => s.id)).not.toEqual(systemsWithin(SEED, spot, 30).map((s) => s.id));
    expect(Math.abs(other.length / a - 1)).toBeLessThan(0.35);
  });

  it("any region can be generated alone: a cell does not need its neighbours", () => {
    const cell = cellNumber(cellTable().slabs[3000]!, 5, 7);
    expect(systemsOfCell(SEED, cell)).toEqual(systemsOfCell(SEED, cell));
  });
});

describe("queries", () => {
  it("systemsWithin finds exactly the systems a slow search over all cells finds (centre, start, rim, wrap-around, plane edge)", () => {
    const table = cellTable();
    const spots = [
      { x: 3, y: 1, z: -2 },
      START_POINT,
      { x: 49800, y: 0, z: 10 },
      { x: 40000, y: 100, z: 0.0001 }, // on the angle 0 line (wrap-around)
      { x: 10000, y: 480, z: 0 }, // near the top of the disc
    ];
    for (const c of spots) {
      const radius = Math.hypot(c.x, c.z) < 100 ? 6 : Math.hypot(c.x, c.z) < 20000 ? 30 : 300;
      const fast = new Set(systemsWithin(SEED, c, radius).map((s) => s.id));
      // slow: look at every cell of every ring in the radius range; skip only cells whose own box is clearly too far
      const slow = new Set<number>();
      const cr = Math.hypot(c.x, c.z);
      for (const slab of table.slabs) {
        if (slab.rb < cr - radius - 1 || slab.ra > cr + radius + 1) continue;
        const rm = 0.5 * (slab.ra + slab.rb);
        const reach = radius + slab.rb - slab.ra + slab.rb * slab.dTheta + slab.dy;
        for (let a = 0; a < slab.sectors; a++) {
          const theta = (a + 0.5) * slab.dTheta;
          const dx = rm * Math.cos(theta) - c.x;
          const dz = rm * Math.sin(theta) - c.z;
          if (Math.abs(dx) > reach || Math.abs(dz) > reach) continue;
          for (let l = 0; l < slab.layers; l++) {
            if (Math.abs(-slab.ymax + (l + 0.5) * slab.dy - c.y) > reach) continue;
            for (const s of systemsOfCell(SEED, cellNumber(slab, a, l))) if (Math.hypot(s.x - c.x, s.y - c.y, s.z - c.z) <= radius) slow.add(s.id);
          }
        }
      }
      expect(fast.size).toBe(slow.size);
      expect([...fast].sort((p, q) => p - q)).toEqual([...slow].sort((p, q) => p - q));
    }
  });

  it("two overlapping queries from different centres agree on the overlap; none lists a system twice", () => {
    const a = systemsWithin(SEED, START_POINT, 60);
    const centreB = { x: START_POINT.x + 40, y: 0, z: START_POINT.z };
    const b = systemsWithin(SEED, centreB, 60);
    expect(new Set(a.map((s) => s.id)).size).toBe(a.length);
    expect(new Set(b.map((s) => s.id)).size).toBe(b.length);
    const inA = new Set(a.map((s) => s.id));
    const inB = new Set(b.map((s) => s.id));
    let overlap = 0;
    for (const s of a) {
      const inside = Math.hypot(s.x - centreB.x, s.y - centreB.y, s.z - centreB.z) <= 60;
      expect(inB.has(s.id)).toBe(inside);
      if (inside) overlap++;
    }
    for (const s of b) expect(inA.has(s.id)).toBe(Math.hypot(s.x - START_POINT.x, s.y - START_POINT.y, s.z - START_POINT.z) <= 60);
    expect(overlap).toBeGreaterThan(500);
  });

  it("nearestSystems: the right count, sorted, and the same as the nearest of a bigger radius", () => {
    for (const c of [{ x: 0, y: 0, z: 0 }, START_POINT, { x: 30000, y: 0, z: 0 }, { x: 49000, y: 0, z: 0 }]) {
      const near = nearestSystems(SEED, c, 500);
      expect(near.length).toBe(500);
      for (let i = 1; i < near.length; i++) expect(near[i]!.distance).toBeGreaterThanOrEqual(near[i - 1]!.distance);
      const widest = near[near.length - 1]!.distance;
      const all = systemsWithin(SEED, c, widest * 1.3).sort((p, q) => p.distance - q.distance);
      expect(all.slice(0, 500).map((s) => s.id)).toEqual(near.map((s) => s.id));
    }
  });

  it("nearestSystems works for 10,000 and 60,000", () => {
    expect(nearestSystems(SEED, START_POINT, 10000).length).toBe(10000);
    expect(nearestSystems(SEED, { x: 0, y: 0, z: 0 }, 60000).length).toBe(60000);
  });

  it("a runaway query stops with an error instead of running for ever", () => {
    expect(() => systemsWithin(SEED, { x: 0, y: 0, z: 0 }, 5000, { maxCells: 100000 })).toThrow(TooManyCellsError);
  });
});

describe("the same galaxy on every device", () => {
  // Recorded from this first version. If one of these changes, the galaxy changed (ids, names and saves would break).
  // The page galaxy-debug.html prints the first one: open it on a phone or another browser and compare.
  it("checksums of the nearest systems are fixed", () => {
    expect(galaxyChecksum(SEED, START_POINT, 2000)).toBe("d0019075");
    expect(galaxyChecksum(SEED, { x: 0, y: 0, z: 0 }, 500)).toBe("c01eb9ac");
    expect(galaxyChecksum(SEED, { x: 49000, y: 0, z: 0 }, 500)).toBe("c679dfa8");
    expect(galaxyChecksum(7, START_POINT, 500)).toBe("6c8471cf");
  });
});

describe("the total", () => {
  it("counting many random cells agrees with the integral of the density", () => {
    const table = cellTable();
    const rnd = lcg(77);
    const n = 60000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const c = countInCell(SEED, Math.floor(rnd() * table.totalCells));
      sum += c;
      sumSq += c * c;
    }
    const mean = sum / n;
    const sd = Math.sqrt(sumSq / n - mean * mean);
    const estimate = mean * table.totalCells;
    const error = (3 * sd) / Math.sqrt(n) / mean; // 3 standard errors
    expect(Math.abs(estimate / expectedTotal() - 1)).toBeLessThan(Math.max(error, 0.01));
  });

  it("each region has about as many systems as the density says", () => {
    for (const [c, radius] of [[START_POINT, 60], [{ x: 20000, y: 0, z: 20000 }, 300], [{ x: 0, y: 0, z: 0 }, 12]] as const) {
      const real = systemsWithin(SEED, c, radius).length;
      const expected = expectedCountIn({ x: c.x - radius, y: c.y - radius, z: c.z - radius }, { x: c.x + radius, y: c.y + radius, z: c.z + radius }, 40) * (Math.PI / 6);
      expect(Math.abs(real / expected - 1)).toBeLessThan(0.15);
    }
  });
});
