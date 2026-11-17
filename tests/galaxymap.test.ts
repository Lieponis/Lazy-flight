import { describe, expect, it } from "vitest";
import { DEFAULT_SPACING_LY, ZOOM_BALL_FACTOR, nearStarsFromList, nearestLineText, starsWithin, type MapStarList } from "../src/render/galaxy/mapdata";
import { MAX_ZOOM_SHARE, zoomOutLimit } from "../src/render/galaxy/previewmath";
import { makeMapSource } from "../src/mapsource";
import { WORLD_SEED, START_POINT, getSystem, spacingAt, startSystem } from "../src/universe";

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

  it("stars inside the reach at the start (a 55 ly ship sees about 1,300 diamonds, well under the 5,000 cap)", () => {
    const near = nearStarsFromList(listAt("start"));
    const inReach = starsWithin(near.distances, near.count, 55);
    expect(inReach).toBeGreaterThan(1000);
    expect(inReach).toBeLessThan(2000);
  });
});
