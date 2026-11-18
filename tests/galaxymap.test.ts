import { describe, expect, it } from "vitest";
import { DEFAULT_SPACING_LY, ZOOM_BALL_FACTOR, nearStarsFromList, nearestLineText, starsWithin, type MapStarList } from "../src/render/galaxy/mapdata";
import { DIAMOND_MAX_SPACING_SHARE, DIAMOND_MIN_SIZE, MAX_ZOOM_SHARE, diamondSize, zoomOutLimit } from "../src/render/galaxy/previewmath";
import { mapStatsText, type MapStatsInput } from "../src/render/mapstats";
import { makeMapSource } from "../src/mapsource";
import { WORLD_SEED, START_POINT, getSystem, spacingAt, startSystem, DISC_RADIUS, armFactor, densityAt } from "../src/universe";
import { ARM_FADE_FROM, ARM_FADE_TO, ARM_STRENGTH } from "../src/universe/galaxy/params";
import { GALAXY_RADIUS_LY, type FieldSample } from "../src/render/galaxy/galaxyfield";
import { skyCellOf } from "../src/render/galaxy/skycell";
import { thicknessAt } from "../src/universe";
import {
  UNIVERSE_ARM_FADE_FROM,
  UNIVERSE_ARM_FADE_TO,
  UNIVERSE_ARM_STRENGTH,
  armAmplitudeAt,
  armBrightness,
  universeField,
} from "../src/render/galaxy/universefield";

// Stage G5a: the real galaxy map's star data. The pure helpers (no Three.js), then the real universe through the app's glue file
// (src/mapsource.ts) at the four places Andy checks: the dense centre, the start, the middle and the rim.

function tinyList(distances: number[], spacingLy = 8): MapStarList {
  const n = distances.length;
  const list: MapStarList = {
    count: n,
    ids: new Float64Array(n),
    positions: new Float32Array(n * 3),
    distances: Float32Array.from(distances),
    colors: new Float32Array(n * 3).fill(1),
    radii: new Float32Array(n).fill(1),
    spacingLy,
  };
  for (let i = 0; i < n; i++) {
    list.ids[i] = 40_000_000_000 + i; // bigger than a 32-bit number
    list.positions[i * 3] = distances[i] ?? 0;
  }
  return list;
}

describe("near stars from the app's list", () => {
  it("takes the bubble radius from the farthest star and keeps the lists as they are", () => {
    const list = tinyList([0, 1.5, 3, 9.5]);
    const near = nearStarsFromList(list);
    expect(near.count).toBe(4);
    expect(near.radius).toBe(9.5);
    expect(near.ballCount).toBe(4);
    expect(near.distances === list.distances).toBe(true);
    expect(near.positions === list.positions).toBe(true);
    expect(near.ids[3]).toBe(40_000_000_003); // a system number above 2^32 survives
  });
  it("sets the 'near' zoom-out limit from the local spacing: spacing x cbrt(3000 / 4 pi), as the preview did", () => {
    expect(ZOOM_BALL_FACTOR).toBeCloseTo(6.2035, 3);
    const near = nearStarsFromList(tinyList([0, 5], 133.7));
    expect(near.zoomNearLy).toBeCloseTo(133.7 * ZOOM_BALL_FACTOR, 6);
    expect(Math.round(near.zoomNearLy)).toBe(829); // the rim limit Andy approved
  });
  it("falls back to a sane spacing when the app gives none, and copes with an empty list", () => {
    expect(nearStarsFromList(tinyList([0, 5], 0)).zoomNearLy).toBeCloseTo(DEFAULT_SPACING_LY * ZOOM_BALL_FACTOR, 6);
    expect(nearStarsFromList(tinyList([0, 5], NaN)).zoomNearLy).toBeCloseTo(DEFAULT_SPACING_LY * ZOOM_BALL_FACTOR, 6);
    const empty = nearStarsFromList(tinyList([]));
    expect(empty.count).toBe(0);
    expect(empty.radius).toBe(1);
  });
  it("never claims more stars than the lists hold", () => {
    const list = tinyList([0, 1, 2]);
    list.count = 99;
    expect(nearStarsFromList(list).count).toBe(3);
  });
  it("the zoom-out limit is the smaller of the local-spacing distance and 90 % of the bubble", () => {
    const wide = nearStarsFromList(tinyList([0, 100, 200, 5000], 133.7));
    expect(zoomOutLimit("near", wide.distances, wide.count, wide.radius, wide.zoomNearLy)).toBeCloseTo(133.7 * ZOOM_BALL_FACTOR, 4);
    const small = nearStarsFromList(tinyList([0, 1, 2, 30], 133.7)); // a bubble smaller than the spacing limit
    expect(zoomOutLimit("near", small.distances, small.count, small.radius, small.zoomNearLy)).toBeCloseTo(MAX_ZOOM_SHARE * 30, 4);
  });
});

describe("how many stars the ship can reach", () => {
  const distances = [0, 1, 1, 2.5, 4, 4, 4, 9, 20, 55, 55.5, 300];
  it("counts the stars at or inside the reach (the list is sorted nearest first)", () => {
    expect(starsWithin(distances, distances.length, 0)).toBe(0);
    expect(starsWithin(distances, distances.length, 0.5)).toBe(1);
    expect(starsWithin(distances, distances.length, 4)).toBe(7);
    expect(starsWithin(distances, distances.length, 55)).toBe(10);
    expect(starsWithin(distances, distances.length, 100000)).toBe(distances.length);
  });
  it("gives 0 for a reach that is not a positive number, and never counts past the list", () => {
    for (const bad of [-1, NaN]) expect(starsWithin(distances, distances.length, bad)).toBe(0);
    expect(starsWithin(distances, 5, 100000)).toBe(5);
    expect(starsWithin([], 0, 50)).toBe(0);
  });
  it("agrees with counting one by one", () => {
    const many: number[] = [];
    let d = 0;
    for (let i = 0; i < 5000; i++) {
      d += (i % 7) * 0.013;
      many.push(d);
    }
    for (const reach of [0.3, 5, 17.77, 100, many[many.length - 1] as number]) {
      expect(starsWithin(many, many.length, reach)).toBe(many.filter((x) => x <= reach).length);
    }
  });
});

describe("the '5 nearest' line", () => {
  it("lists the distances in light years, one decimal under 10 and whole numbers above", () => {
    expect(nearestLineText([1.24, 3.5, 9.96, 10.4, 133.7])).toBe("5 nearest: 1.2, 3.5, 10.0, 10, 134 ly");
  });
  it("is empty when there are no neighbours", () => {
    expect(nearestLineText([])).toBe("");
  });
});

// ---------------------------------------------------------------- the real universe, through the glue file
const SEED = WORLD_SEED;
const COUNT = 60_000;
const source = makeMapSource(SEED);
const pointAt = (r: number, angle: number) => ({ x: r * Math.cos(angle), y: 0, z: r * Math.sin(angle) });
const PLACES = {
  centre: { x: 0, y: 0, z: 0 },
  start: START_POINT,
  middle: pointAt(30_000, 4.0),
  rim: pointAt(48_000, 5.2),
};
type PlaceId = keyof typeof PLACES;
const lists = new Map<PlaceId, MapStarList>();
function listAt(place: PlaceId): MapStarList {
  let list = lists.get(place);
  if (!list) {
    list = source.nearest(PLACES[place], COUNT);
    lists.set(place, list);
  }
  return list;
}

describe("the real map data (universe v3, world seed)", () => {
  for (const place of ["centre", "start", "middle", "rim"] as PlaceId[]) {
    it(`${place}: 60,000 stars, nearest first, all numbers sane`, () => {
      const list = listAt(place);
      expect(list.count).toBe(COUNT);
      expect(list.ids).toHaveLength(COUNT);
      expect(list.positions).toHaveLength(COUNT * 3);
      let sorted = true;
      let finite = true;
      let colourOk = true;
      for (let i = 0; i < COUNT; i++) {
        if (i > 0 && (list.distances[i] as number) < (list.distances[i - 1] as number)) sorted = false;
        if (!Number.isFinite(list.distances[i] as number) || !Number.isFinite(list.positions[i * 3] as number)) finite = false;
        for (let c = 0; c < 3; c++) {
          const v = list.colors[i * 3 + c] as number;
          if (!(v >= 0 && v <= 1)) colourOk = false;
        }
      }
      expect(sorted).toBe(true);
      expect(finite).toBe(true);
      expect(colourOk).toBe(true);
      expect(new Set(list.ids).size).toBe(COUNT); // every system once
      // The positions are relative to the point asked from: their length is the distance.
      for (const i of [0, 1, 100, 5000, 30_000, COUNT - 1]) {
        const len = Math.hypot(list.positions[i * 3] as number, list.positions[i * 3 + 1] as number, list.positions[i * 3 + 2] as number);
        expect(Math.abs(len - (list.distances[i] as number))).toBeLessThan(1e-3 * Math.max(1, list.distances[i] as number));
      }
      expect(list.spacingLy).toBe(spacingAt(Math.hypot(PLACES[place].x, PLACES[place].z)));
    });
  }

  it("asked from a system's own position, the first star is that system (distance 0, at 0, 0, 0)", () => {
    const here = startSystem(SEED);
    const list = source.nearest(here.position, 100);
    expect(list.ids[0]).toBe(here.id);
    expect(list.distances[0]).toBe(0);
    expect([list.positions[0], list.positions[1], list.positions[2]]).toEqual([0, 0, 0]);
  });

  it("star sizes are the game's six size classes and the colours match the star type", () => {
    const list = listAt("start");
    const classes = new Set(Array.from(list.radii.subarray(0, 2000)));
    for (const r of classes) expect([0.5, 0.8, 1, 1.3, 1.8, 3]).toContain(Math.round(r * 10) / 10); // (stored as 32-bit numbers: 1.8 is 1.7999999...)
    const i = 7;
    const system = getSystem(SEED, list.ids[i] as number);
    expect(system === null).toBe(false);
    const hex = parseInt((system?.star.color ?? "#000000").slice(1), 16);
    expect(Math.round((list.colors[i * 3] as number) * 255)).toBe((hex >> 16) & 255);
    expect(Math.round((list.colors[i * 3 + 1] as number) * 255)).toBe((hex >> 8) & 255);
    expect(Math.round((list.colors[i * 3 + 2] as number) * 255)).toBe(hex & 255);
    expect(list.radii[i]).toBeCloseTo(system?.star.radius ?? -1, 5);
  });

  it("is the same every time; the same question twice is answered from the remembered list, the third place pushes the oldest out", () => {
    const first = listAt("start");
    const other = makeMapSource(SEED).nearest(PLACES.start, COUNT);
    expect(Array.from(other.ids.subarray(0, 500))).toEqual(Array.from(first.ids.subarray(0, 500)));
    expect(other.distances[COUNT - 1]).toBe(first.distances[COUNT - 1]);
    expect(listAt("rim").ids[0]).not.toBe(first.ids[0]);

    const fresh = makeMapSource(SEED);
    const a = fresh.nearest(PLACES.start, 200);
    expect(fresh.nearest(PLACES.start, 200) === a).toBe(true); // remembered: no second lookup
    fresh.nearest(PLACES.rim, 200);
    fresh.nearest(PLACES.middle, 200); // two answers are kept: the start is forgotten now ...
    const again = fresh.nearest(PLACES.start, 200);
    expect(again === a).toBe(false);
    expect(Array.from(again.ids)).toEqual(Array.from(a.ids)); // ... and worked out again with the same result
  });

  it("names a tapped star like the universe does, and says nothing about a number that is no system", () => {
    const id = listAt("start").ids[3] as number;
    const info = source.describe(id);
    expect(info?.name).toBe(getSystem(SEED, id)?.name);
    expect(info?.starLabel).toBe(getSystem(SEED, id)?.star.label);
    expect(source.describe(-5)).toBeNull();
    expect(source.describe(NaN)).toBeNull();
  });

  it("the zoom-out limits at the four places (the rim limit is the 829 ly Andy approved)", () => {
    const limit = (place: PlaceId): number => {
      const near = nearStarsFromList(listAt(place));
      return zoomOutLimit("near", near.distances, near.count, near.radius, near.zoomNearLy);
    };
    expect(limit("centre")).toBeGreaterThan(10);
    expect(limit("centre")).toBeLessThan(13);
    expect(limit("start")).toBeGreaterThan(45);
    expect(limit("start")).toBeLessThan(55);
    expect(limit("middle")).toBeGreaterThan(150);
    expect(limit("middle")).toBeLessThan(180);
    expect(Math.round(limit("rim"))).toBe(829);
  });

  it("works at the dense centre without drawing more than the caps, and the rim is a thin flat disc", () => {
    const centre = nearStarsFromList(listAt("centre"));
    expect(centre.radius).toBeLessThan(100); // 60,000 stars fit inside 100 ly
    expect(starsWithin(centre.distances, centre.count, 55)).toBe(COUNT); // everything is in reach: the diamond CAP decides, not the reach
    const rim = listAt("rim");
    let sideways = 0;
    let up = 0;
    for (let i = 0; i < rim.count; i++) {
      const x = rim.positions[i * 3] as number;
      const y = rim.positions[i * 3 + 1] as number;
      const z = rim.positions[i * 3 + 2] as number;
      sideways += x * x + z * z;
      up += y * y;
    }
    const sigmaSideways = Math.sqrt(sideways / rim.count / 2);
    const sigmaUp = Math.sqrt(up / rim.count);
    expect(sigmaUp).toBeLessThan(0.2 * sigmaSideways); // flat: the stars spread many times wider than tall
    expect(listAt("rim").distances[0]).toBeGreaterThan(40); // far from the nearest star at the rim: no crowd
  });

  it("the diamonds shrink at the dense centre so they do not cover each other, and stay (nearly) as they were at the start, middle and rim", () => {
    const sizeAt = (place: PlaceId, radius = 1): number => {
      const near = nearStarsFromList(listAt(place));
      expect(near.spacingLy).toBe(spacingAt(Math.hypot(PLACES[place].x, PLACES[place].z)));
      return diamondSize(radius, near.spacingLy);
    };
    // Without a gap handed over, the size is the plain one (nothing changed for the G2 preview).
    for (const r of [0.5, 1, 2, 3]) {
      expect(diamondSize(r)).toBe(diamondSize(r, undefined));
      expect(diamondSize(r)).toBe(diamondSize(r, NaN));
      expect(diamondSize(r)).toBe(diamondSize(r, 0));
      expect(diamondSize(r)).toBe(diamondSize(r, -3));
    }
    // The centre: the gap is under 2 ly, so a diamond is a tenth of that (about 0.18 ly), a good three times smaller than before.
    const centreGap = spacingAt(Math.hypot(PLACES.centre.x, PLACES.centre.z));
    expect(centreGap).toBeLessThan(2.5);
    expect(sizeAt("centre")).toBeCloseTo(DIAMOND_MAX_SPACING_SHARE * centreGap, 6);
    expect(sizeAt("centre")).toBeLessThan(diamondSize(1) / 2.5);
    expect(sizeAt("centre", 3)).toBeLessThan(diamondSize(3) / 4);
    // The start (gap about 8 ly): the normal diamonds are exactly as before; only the very biggest stars' diamonds are a touch smaller (under 10%).
    expect(sizeAt("start", 1)).toBe(diamondSize(1));
    expect(sizeAt("start", 2)).toBe(diamondSize(2));
    expect(sizeAt("start", 3)).toBeGreaterThan(0.9 * diamondSize(3));
    // The middle and the rim (gaps in the tens of ly): nothing changes.
    for (const place of ["middle", "rim"] as const) {
      expect(sizeAt(place, 1)).toBe(diamondSize(1));
      expect(sizeAt(place, 3)).toBe(diamondSize(3));
    }
  });

  it("the ?mapstats=1 block shows the diamond width (so a screenshot proves which build it came from), and still works without it", () => {
    const base: MapStatsInput = { stars: 60000, diamonds: 5000, tappable: 10000, radiusLy: 45, zoomLimitLy: 12, lookupMs: 100, sky: null, skyProgress: null, frameMs: 16.6, jsMs: 0, drawCalls: 5, triangles: 40012 };
    expect(mapStatsText({ ...base, diamondLy: 0.1803 })).toContain("diamonds 5,000  diamond 0.18 ly wide  tappable 10,000");
    expect(mapStatsText(base).includes("ly wide")).toBe(false);
    expect(mapStatsText(base)).toContain("diamonds 5,000  tappable 10,000");
  });

  it("a diamond never gets smaller than the minimum, never bigger than the plain size, and never grows when the stars get closer", () => {
    for (const gap of [0.001, 0.2, 0.5, 0.8, 1, 1.9, 3, 5, 8, 20, 134, 1e9]) {
      for (const r of [0.5, 1, 3]) {
        const d = diamondSize(r, gap);
        expect(Number.isFinite(d)).toBe(true);
        expect(d).toBeGreaterThanOrEqual(DIAMOND_MIN_SIZE);
        expect(d).toBeLessThanOrEqual(diamondSize(r) + 1e-12);
      }
    }
    // Sizes go up (or stay) as the gap goes up.
    const gaps = [0.2, 0.5, 1, 1.9, 3, 5, 8, 20];
    const sizes = gaps.map((g) => diamondSize(1, g));
    for (let i = 1; i < sizes.length; i++) expect(sizes[i] as number).toBeGreaterThanOrEqual(sizes[i - 1] as number);
    // The minimum is a real, visible size (not zero).
    expect(DIAMOND_MIN_SIZE).toBeGreaterThan(0.05);
    expect(DIAMOND_MIN_SIZE).toBeLessThan(0.2);
  });

  it("stars inside the reach at the start (a 55 ly ship sees about 1,300 diamonds, well under the 5,000 cap)", () => {
    const near = nearStarsFromList(listAt("start"));
    const inReach = starsWithin(near.distances, near.count, 55);
    expect(inReach).toBeGreaterThan(1000);
    expect(inReach).toBeLessThan(2000);
  });
});

// Stage G5a step 3: the sky is built from the real universe's galaxy shape, handed over as plain functions (src/mapsource.ts).
// The render layer keeps three numbers of the arm shape as its own copies (it may not import the universe), so these checks fail
// loudly if the universe ever changes them.
describe("the sky's galaxy field (real universe through plain functions)", () => {
  const sky = makeMapSource(WORLD_SEED).sky;
  const sample = (x: number, y: number, z: number): FieldSample => {
    const out: FieldSample = { old: 0, young: 0, dust: 0 };
    if (!sky) throw new Error("the map source gave no sky functions");
    universeField(sky).sample(x, y, z, out);
    return out;
  };

  it("keeps its copies of the universe's arm numbers and disc radius in step with the universe", () => {
    expect(UNIVERSE_ARM_STRENGTH).toBe(ARM_STRENGTH);
    expect(UNIVERSE_ARM_FADE_FROM).toBe(ARM_FADE_FROM);
    expect(UNIVERSE_ARM_FADE_TO).toBe(ARM_FADE_TO);
    expect(GALAXY_RADIUS_LY).toBe(DISC_RADIUS);
  });

  it("the arm strength it assumes at each distance is what the real arm factor reaches (peak 1 + amplitude, average 1)", () => {
    for (const r of [0, 1000, 1500, 2500, 3250, 4500, 5000, 12000, 30000, 49000]) {
      let peak = -Infinity;
      let sum = 0;
      const steps = 1440;
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const f = armFactor(r, Math.cos(a), Math.sin(a));
        sum += f;
        if (f > peak) peak = f;
      }
      const amp = armAmplitudeAt(r);
      expect(Math.abs(peak - 1 - amp)).toBeLessThan(2e-4 + amp * 2e-3);
      expect(Math.abs(sum / steps - 1)).toBeLessThan(1e-3);
    }
  });

  it("the arm brightness runs from 1 on the crest of an arm to nearly 0 between arms, and is flat in the round bulge", () => {
    const fns = sky;
    if (!fns) throw new Error("no sky functions");
    let hi = 0;
    let lo = 1;
    for (let i = 0; i < 720; i++) {
      const a = (i / 720) * Math.PI * 2;
      const b = armBrightness(fns, 20000, Math.cos(a), Math.sin(a), 0);
      if (b > hi) hi = b;
      if (b < lo) lo = b;
    }
    expect(hi).toBeGreaterThan(0.99);
    expect(hi).toBeLessThan(1.0001);
    expect(lo).toBeLessThan(0.02);
    expect(armBrightness(fns, 500, 1, 0, 0)).toBe(0.5); // inside the bulge there are no arms
  });

  it("is the universe's density where the universe has systems, and the plain function can be called over and over", () => {
    if (!sky) throw new Error("no sky functions");
    const points = [
      { x: -16559, y: 0, z: 1892 },
      { x: 3000, y: 120, z: -4000 },
      { x: 0, y: 0, z: 0 },
      { x: 30000, y: -50, z: 20000 },
    ];
    for (let round = 0; round < 2; round++) {
      for (const p of points) {
        expect(sky.density(p.x, p.y, p.z)).toBe(densityAt({ x: p.x, y: p.y, z: p.z }));
      }
    }
    expect(sky.density(60000, 0, 0)).toBe(0); // outside the disc
    expect(sky.spacing(16000)).toBe(spacingAt(16000));
  });

  it("gives finite, non-negative light that is the same every time, over the whole disc and beyond", () => {
    for (const [x, y, z] of [
      [-16559, 0, 1892],
      [0, 0, 0],
      [0, 0, 40],
      [49000, 10, 0],
      [52000, 0, 0],
      [-60000, 5, 5000],
      [0, 3000, 0],
      [8000, -400, -30000],
    ] as const) {
      const a = sample(x, y, z);
      const b = sample(x, y, z);
      expect(a).toEqual(b);
      for (const v of [a.old, a.young, a.dust]) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v >= 0).toBe(true);
      }
    }
  });

  it("the glow is thickest in the plane of the disc and gone far above it", () => {
    const here = sample(-16559, 0, 1892);
    expect(here.old).toBeGreaterThan(0);
    const high = sample(-16559, 4000, 1892);
    expect(high.old).toBe(0);
    expect(high.young).toBe(0);
  });

  it("past the rim the light fades out smoothly instead of stopping at once, and is gone far beyond", () => {
    const inside = sample(0, 0, 49000).old;
    const justOutside = sample(0, 0, 51500).old;
    const farOutside = sample(0, 0, 90000).old;
    expect(inside).toBeGreaterThan(0);
    expect(justOutside).toBeGreaterThan(0); // the soft edge: Andy asked for a glow that spills past the rim
    expect(farOutside < 1e-9 * inside + 1e-30).toBe(true);
  });

  it("puts the young blue light in the arms and none in the round bulge", () => {
    expect(sample(300, 0, 200).young).toBe(0); // inside 1,500 ly: no arms
    let best = 0;
    for (let i = 0; i < 360; i++) {
      const a = (i / 360) * Math.PI * 2;
      const v = sample(20000 * Math.cos(a), 0, 20000 * Math.sin(a)).young;
      if (v > best) best = v;
    }
    expect(best).toBeGreaterThan(0);
  });
});

// The real universe is a thin disc (500 to 2,000 ly thick). A sky cell is a cube on a grid, which would build the sky from up to half
// a cell above or below the plane (480 ly at the start, 1,920 ly at the rim): a different sky. So the map asks for cells as tall as a
// third of the disc, centred on the plane.
describe("sky cells in a thin disc", () => {
  const third = (r: number): number => thicknessAt(r) / 3;
  const places: [string, number, number][] = [
    ["centre", 400, 0.3],
    ["start", 16700, 3.0],
    ["middle", 30000, 4.0],
    ["rim", 48000, 5.2],
  ];
  const at = (r: number, a: number, y: number) => ({ x: r * Math.cos(a), y, z: r * Math.sin(a) });

  it("a player in the middle of the disc gets a sky built from the plane itself (centre height 0), at all four places", () => {
    for (const [, r, a] of places) {
      expect(skyCellOf(at(r, a, 0), third).centre.y).toBe(0);
      expect(skyCellOf(at(r, a, 3), third).centre.y).toBe(0);
      expect(skyCellOf(at(r, a, -3), third).centre.y).toBe(0);
    }
  });

  it("the cell is a third of the disc tall (or as wide as it is, if that is smaller), and at the centre it is the full 60 ly cube", () => {
    for (const [, r, a] of places) {
      const c = skyCellOf(at(r, a, 0), third);
      const height = Math.min(c.size, third(r));
      const next = skyCellOf(at(r, a, height * 0.6), third); // just past the edge of the middle cell: the next one up
      expect(Math.abs(next.centre.y - height) < 1e-6).toBe(true);
      expect(next.key === c.key).toBe(false);
    }
    expect(skyCellOf(at(400, 0.3, 0), third).size).toBe(60);
    expect(skyCellOf(at(400, 0.3, 59), third).key === skyCellOf(at(400, 0.3, 0), third).key).toBe(false); // 60 ly cells at the centre: 59 up is the next cell
  });

  it("one cell gives one key, one centre and one dot seed, wherever you stand in it (including either side of the plane)", () => {
    for (const [, r, a] of places) {
      const h = third(r);
      const base = skyCellOf(at(r, a, 0), third);
      for (const y of [-0.45 * h, -1, 1, 0.45 * h]) {
        if (y === 0) continue;
        const c = skyCellOf(at(r, a, Math.max(-0.45 * Math.min(h, base.size), Math.min(0.45 * Math.min(h, base.size), y))), third);
        expect(c.key).toBe(base.key);
        expect(c.starSeed).toBe(base.starSeed);
        expect(c.centre).toEqual(base.centre);
      }
    }
  });

  it("a place well above the plane is another cell (so a ship far off the disc would get its own sky)", () => {
    const here = skyCellOf(at(16700, 3.0, 0), third);
    const high = skyCellOf(at(16700, 3.0, 2000), third);
    expect(high.key === here.key).toBe(false);
  });

  it("without a vertical size nothing changed: the cube cells of the first prototype", () => {
    const p = at(16700, 3.0, 100);
    const c = skyCellOf(p);
    expect(c.centre.y).toBe((Math.floor(100 / c.size) + 0.5) * c.size);
  });
});
