import { describe, expect, it } from "vitest";
import { localSpacing, makeMapSource } from "../src/mapsource";
import { nearStarsFromList } from "../src/render/galaxy/mapdata";
import { StarGrid } from "../src/render/galaxy/starpick";
import { systemSkySeed } from "../src/render/helpers";
import { WORLD_SEED, densityAt, spacingAt, thicknessAt } from "../src/universe";
import { bulgeTable, cellTable } from "../src/universe/galaxy";

// G7b: the real map at the galaxy centre, with the central bulge (Agent 2, stage G7). Bulge systems have their own system numbers
// (above every disc number, from 46.6 billion up to 82.7 billion, still whole numbers a computer holds exactly) and cube cells.
// Everything below goes through the same glue file the game uses (src/mapsource.ts), with the real universe.

const source = makeMapSource(WORLD_SEED);
const polar = (r: number, angle: number) => ({ x: r * Math.cos(angle), y: 0, z: r * Math.sin(angle) });
const MAPAT_CENTRE = polar(400, 0.3); // what ?mapat=centre looks from
const FIRST_BULGE_ID = cellTable().idSpace; // every disc system number is below this

describe("the map at the centre (?mapat=centre), where bulge systems are about half of the nearest 60,000", () => {
  const list = source.nearest(MAPAT_CENTRE, 60_000);
  const near = nearStarsFromList(list);

  it("returns 60,000 stars, whole numbers a computer holds exactly, none twice, with bulge numbers among them", () => {
    expect(list.count).toBe(60_000);
    const seen = new Set<number>();
    let bulge = 0;
    for (let i = 0; i < list.count; i++) {
      const id = list.ids[i] ?? -1;
      expect(Number.isSafeInteger(id)).toBe(true);
      expect(seen.has(id)).toBe(false);
      seen.add(id);
      if (id >= FIRST_BULGE_ID) {
        bulge++;
        expect(id).toBeLessThan(bulgeTable().idEnd);
      }
    }
    expect(bulge).toBeGreaterThan(10_000);
    expect(bulge).toBeLessThan(list.count);
  });

  it("keeps every distance equal to its position (relative to the point asked from), nearest first", () => {
    for (let i = 0; i < list.count; i += 37) {
      const d = Math.hypot(list.positions[i * 3] ?? 0, list.positions[i * 3 + 1] ?? 0, list.positions[i * 3 + 2] ?? 0);
      expect(Math.abs(d - (list.distances[i] ?? 0))).toBeLessThan(0.02 + d * 1e-4);
      if (i > 0) expect(list.distances[i] ?? 0).toBeGreaterThanOrEqual(list.distances[i - 1] ?? 0);
    }
  });

  it("gives every sampled bulge star a name and a star type, and each its own pattern of background dots", () => {
    const seeds = new Set<number>();
    let checked = 0;
    for (let i = 0; i < list.count && checked < 40; i += 331) {
      const id = list.ids[i] ?? 0;
      const info = source.describe(id);
      expect(info).not.toBe(null);
      expect((info?.name ?? "").length).toBeGreaterThan(3);
      expect((info?.starLabel ?? "").length).toBeGreaterThan(3);
      if (id >= FIRST_BULGE_ID) {
        seeds.add(systemSkySeed(id));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(10);
    expect(seeds.size).toBe(checked);
  });

  it("builds the map's star set and the tap grid as usual (a dense ball, a few tens of light years across)", () => {
    expect(near.count).toBe(60_000);
    expect(near.radius).toBeGreaterThan(20);
    expect(near.radius).toBeLessThan(60);
    const grid = new StarGrid(near.positions, 10_000);
    expect(grid.count).toBe(10_000);
  });

  it("still asks for the disc's star gap here, as before (inside the disc's own thickness)", () => {
    expect(list.spacingLy).toBe(spacingAt(Math.hypot(MAPAT_CENTRE.x, MAPAT_CENTRE.z)));
  });
});

describe("the map's star gap away from the disc plane (bulge systems lie up to about 5,000 ly above and below it)", () => {
  const above = { x: 300, y: 2000, z: 100 };

  it("is the disc's number everywhere inside the disc's thickness (nothing changes for the disc)", () => {
    for (const [r, a] of [[0, 0], [400, 0.3], [3000, 2], [16_700, 2.1], [30_000, 4], [48_000, 5.2]] as const) {
      const p = polar(r, a);
      expect(localSpacing(p)).toBe(spacingAt(r));
      const edge = { ...p, y: thicknessAt(r) / 2 };
      expect(localSpacing(edge)).toBe(spacingAt(r));
    }
  });

  it("grows with the height above the plane, where the bulge is thin (2,000 ly up the real gap is about 4 to 5 ly, not the disc's 1.9)", () => {
    const base = spacingAt(Math.hypot(above.x, above.z));
    const s1000 = localSpacing({ ...above, y: 1000 });
    const s2000 = localSpacing(above);
    const s3000 = localSpacing({ ...above, y: 3000 });
    expect(s1000).toBeGreaterThanOrEqual(base);
    expect(s2000).toBeGreaterThan(s1000);
    expect(s3000).toBeGreaterThan(s2000);
    expect(s2000).toBeGreaterThan(3.5);
    expect(s2000).toBeLessThan(7);
    expect(s2000).toBeCloseTo(Math.cbrt(1 / densityAt(above)), 6);
  });

  it("is what the map list carries, so the zoom-out limit follows the real gap", () => {
    const list = source.nearest(above, 60_000);
    expect(list.spacingLy).toBe(localSpacing(above));
    const near = nearStarsFromList(list);
    expect(near.zoomNearLy).toBeGreaterThan(20);
  });
});
