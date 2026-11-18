import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeMapSource } from "../src/mapsource";
import type { MapPoint, MapSource, MapStarList } from "../src/render/galaxy/mapdata";
import type { Hud } from "../src/render/hud";
import { MAP_NEAR_STARS, MAP_SKY_WARM_DELAY_FRAMES } from "../src/render/settings";
import { StarMapScreen, type StarMapHere } from "../src/render/starmap";
import { StateStore } from "../src/render/state";
import { START_POINT, WORLD_SEED } from "../src/universe";

// The galaxy map builds its backdrop ahead of time (Andy: "make the backdrop on the galaxy map draw as fast as on the system view").
// This runs the real map screen (real three.js objects, the real universe, the full-size sky) without a screen: only built and counted.
// The one thing that must hold: after the background build, opening the map starts NO second build, so the sky is simply there.

const HERE: StarMapHere = { id: 1, name: "Test", starLabel: "Yellow star", position: { x: START_POINT.x, y: START_POINT.y, z: START_POINT.z } };

/** The map only touches `window.location.search` when it is built; the rest of the page is not needed for this test. */
const globals = globalThis as unknown as { window?: unknown };
let hadWindow = false;
let savedWindow: unknown;

beforeAll(() => {
  hadWindow = "window" in globals;
  savedWindow = globals.window;
  globals.window = { location: { search: "" } };
});

afterAll(() => {
  if (hadWindow) globals.window = savedWindow;
  else delete globals.window;
});

interface Probe {
  map: StarMapScreen;
  /** Every question the map asked the source: where from, how many. */
  asked: { centre: MapPoint; count: number }[];
  /** Every answer the source gave, in order. */
  answers: MapStarList[];
}

function makeMap(withSky = true): Probe {
  const real = makeMapSource(WORLD_SEED);
  const asked: Probe["asked"] = [];
  const answers: MapStarList[] = [];
  const source: MapSource = {
    nearest(centre, count) {
      asked.push({ centre: { x: centre.x, y: centre.y, z: centre.z }, count });
      const list = real.nearest(centre, count);
      answers.push(list);
      return list;
    },
    describe: (id) => real.describe(id),
  };
  if (withSky && real.sky) source.sky = real.sky;
  const host = { style: {}, parentElement: null, addEventListener() {}, removeEventListener() {} } as unknown as HTMLElement;
  const map = new StarMapScreen({
    source,
    host,
    hud: {} as Hud,
    state: new StateStore(HERE.id),
    current: HERE,
    onOpenSystem: () => {},
    reachLy: 35,
  });
  return { map, asked, answers };
}

interface MapInside {
  skyBuilt: boolean;
  pendingSky: unknown;
  near: unknown;
  preNear: unknown;
  active: boolean;
  ensureData(): void;
}

function inside(map: StarMapScreen): MapInside {
  return map as unknown as MapInside;
}

describe("the galaxy map's sky is built ahead of time", () => {
  it("waits a little, asks for the stars once, builds the whole sky in the background, and opening the map then starts no new build", () => {
    const { map, asked, answers } = makeMap();
    expect(inside(map).skyBuilt).toBe(false);

    // The first frames after the start are left alone.
    for (let i = 1; i < MAP_SKY_WARM_DELAY_FRAMES; i++) map.warmSky(50);
    expect(asked.length).toBe(0);

    // Then the stars are asked for exactly once, and the sky is built a slice per frame until it is done.
    map.warmSky(50);
    expect(asked.length).toBe(1);
    expect(asked[0]?.count).toBe(MAP_NEAR_STARS);
    let frames = 0;
    while (!inside(map).skyBuilt && frames < 5000) {
      map.warmSky(50);
      frames++;
    }
    expect(inside(map).skyBuilt).toBe(true);
    expect(inside(map).pendingSky).toBe(null);
    expect(asked.length).toBe(1);
    expect(map.stats().sky).not.toBe(null);
    expect(map.stats().sky?.dots ?? 0).toBeGreaterThan(20_000);

    // Opening the map: the same stars come back from the app's kept answer, and the finished sky is already the right one.
    inside(map).ensureData();
    expect(asked.length).toBe(2);
    expect(answers[1]).toBe(answers[0]);
    expect(inside(map).near).not.toBe(null);
    expect(inside(map).preNear).toBe(null);
    expect(inside(map).pendingSky).toBe(null);
    expect(inside(map).skyBuilt).toBe(true);
    expect(map.stats().stars).toBe(MAP_NEAR_STARS);
  });

  it("does nothing while the map itself is shown, and starts over (after the same wait) when the player is somewhere else", () => {
    const { map, asked } = makeMap();
    inside(map).active = true;
    for (let i = 0; i < MAP_SKY_WARM_DELAY_FRAMES + 5; i++) map.warmSky(1);
    expect(asked.length).toBe(0);
    inside(map).active = false;

    for (let i = 1; i < MAP_SKY_WARM_DELAY_FRAMES; i++) map.warmSky(1);
    expect(asked.length).toBe(0);
    map.warmSky(1);
    expect(asked.length).toBe(1);

    // A jump to another system: the old preparation is dropped and the wait begins again.
    const there: StarMapHere = { id: 2, name: "Elsewhere", starLabel: "Red dwarf", position: { x: HERE.position.x + 120, y: 0, z: HERE.position.z - 60 } };
    map.setCurrent(there);
    expect(inside(map).preNear).toBe(null);
    for (let i = 1; i < MAP_SKY_WARM_DELAY_FRAMES; i++) map.warmSky(1);
    expect(asked.length).toBe(1);
    map.warmSky(1);
    expect(asked.length).toBe(2);
    expect(asked[1]?.centre.x).toBeCloseTo(there.position.x, 3);
    expect(asked[1]?.centre.z).toBeCloseTo(there.position.z, 3);
  });

  it("leaves a map without sky functions alone (the plain backdrop stays, the source is never asked in the background)", () => {
    const { map, asked } = makeMap(false);
    for (let i = 0; i < MAP_SKY_WARM_DELAY_FRAMES * 3; i++) map.warmSky(50);
    expect(asked.length).toBe(0);
    expect(inside(map).skyBuilt).toBe(false);
  });
});
