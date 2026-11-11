import { describe, expect, it } from "vitest";
import {
  MAX_DOCKS_PER_SYSTEM,
  MAX_JOB_DISTANCE,
  MAX_PLANETS,
  MIN_PLANETS,
  UNIVERSE_VERSION,
  dockPlanetIndexes,
  docksOf,
  distanceBetweenDocks,
  generateJobBoard,
  getDock,
  getDocksOfSystem,
  getJobBoard,
  getPlanet,
  getPlanetsOfSystem,
  getSystem,
  hasDock,
  listSystemsNear,
  maxDocksFor,
  parseDockId,
  summarizeSurveys,
  surveySeed,
  type Dock,
  type StarSystem,
} from "../src/universe";

// Universe version 2: systems have 1 to 10 planets, and only some planets have a dock (1 to 3 per system).

const ORIGIN = { x: 0, y: 0, z: 0 };
const SEEDS = [1, 2, 3, 7, 42, 99, 12345, 2024, 777777, "lazy", "freight", "space cheese"];

/** Systems near the origin for one seed. */
function systemsOf(seed: number | string, radius = 40): StarSystem[] {
  return listSystemsNear(seed, ORIGIN, radius);
}

describe("universe version 2: settings", () => {
  it("is version 2 with 1 to 10 planets per system and at most 3 docks", () => {
    expect(UNIVERSE_VERSION).toBe(2);
    expect(MIN_PLANETS).toBe(1);
    expect(MAX_PLANETS).toBe(10);
    expect(MAX_DOCKS_PER_SYSTEM).toBe(3);
  });

  it("maxDocksFor follows round(planets / 3.3), from 1 to 3", () => {
    const expected = [1, 1, 1, 1, 2, 2, 2, 2, 3, 3]; // for 1..10 planets
    expected.forEach((max, i) => expect(maxDocksFor(i + 1)).toBe(max));
    expect(maxDocksFor(0)).toBe(1);
    expect(maxDocksFor(25)).toBe(3);
  });
});

describe("systems with up to 10 planets", () => {
  it("planet counts cover every number from 1 to 10 and never leave that range", () => {
    const seen = new Set<number>();
    for (const seed of SEEDS) {
      for (const system of systemsOf(seed)) {
        expect(system.planetCount).toBeGreaterThanOrEqual(1);
        expect(system.planetCount).toBeLessThanOrEqual(10);
        seen.add(system.planetCount);
      }
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("planets work for every count from 1 to 10 (unique ids, growing orbits, valid colors, names)", () => {
    const checked = new Set<number>();
    for (const seed of SEEDS) {
      for (const system of systemsOf(seed)) {
        if (checked.has(system.planetCount) && system.planetCount < 9) continue;
        checked.add(system.planetCount);
        const planets = getPlanetsOfSystem(seed, system.id);
        expect(planets.length).toBe(system.planetCount);
        expect(new Set(planets.map((p) => p.id)).size).toBe(planets.length);
        planets.forEach((planet, i) => {
          expect(planet.index).toBe(i);
          expect(planet.id).toBe(`${system.id}/${i}`);
          expect(planet.name.trim().length).toBeGreaterThan(0);
          expect(planet.colors.primary).toMatch(/^#[0-9a-f]{6}$/);
          expect(planet.radius).toBeGreaterThan(0);
          if (i > 0) expect(planet.orbitRadius).toBeGreaterThan((planets[i - 1] as (typeof planets)[number]).orbitRadius);
        });
      }
    }
    expect(checked.size).toBe(10);
  });
});

describe("how many docks a system has", () => {
  it("is always between 1 and maxDocksFor(planets), for every planet count from 1 to 10", () => {
    const seenByCount = new Map<number, Set<number>>();
    for (const seed of SEEDS) {
      for (const system of systemsOf(seed)) {
        const docks = docksOf(seed, system);
        const max = maxDocksFor(system.planetCount);
        expect(docks.length).toBeGreaterThanOrEqual(1);
        expect(docks.length).toBeLessThanOrEqual(max);
        expect(docks.length).toBeLessThanOrEqual(system.planetCount);
        const set = seenByCount.get(system.planetCount) ?? new Set<number>();
        set.add(docks.length);
        seenByCount.set(system.planetCount, set);
      }
    }
    // Every planet count from 1 to 10 was tested, and the whole allowed range of dock numbers really happens.
    for (let planets = 1; planets <= 10; planets++) {
      const seen = seenByCount.get(planets);
      expect(seen).not.toBe(undefined);
      const max = maxDocksFor(planets);
      for (let n = 1; n <= max; n++) expect(seen?.has(n)).toBe(true);
    }
  });

  it("small systems (1 to 4 planets) always have exactly 1 dock", () => {
    for (const seed of SEEDS) {
      for (const system of systemsOf(seed)) {
        if (system.planetCount <= 4) expect(docksOf(seed, system).length).toBe(1);
      }
    }
  });

  it("many planets do not mean a dock on every planet", () => {
    let planetsWithoutDock = 0;
    for (const seed of SEEDS) {
      for (const system of systemsOf(seed)) {
        planetsWithoutDock += system.planetCount - docksOf(seed, system).length;
      }
    }
    expect(planetsWithoutDock).toBeGreaterThan(0);
  });
});

describe("docks sit on planets and have valid ids", () => {
  it("dock ids are unique, valid, equal to their planet's id and found again by getDock", () => {
    for (const seed of SEEDS) {
      const allIds = new Set<string>();
      for (const system of systemsOf(seed, 30)) {
        const docks = docksOf(seed, system);
        const indexes = dockPlanetIndexes(seed, system);
        expect(indexes.length).toBe(docks.length);
        expect([...indexes].sort((a, b) => a - b)).toEqual(indexes); // smallest first
        expect(new Set(indexes).size).toBe(indexes.length);
        docks.forEach((dock, i) => {
          const planetIndex = indexes[i] as number;
          expect(planetIndex).toBeGreaterThanOrEqual(0);
          expect(planetIndex).toBeLessThan(system.planetCount);
          expect(dock.id).toBe(`${system.id}/${planetIndex}`);
          expect(dock.planetId).toBe(dock.id);
          expect(dock.systemId).toBe(system.id);
          expect(parseDockId(dock.id)).toEqual({ systemId: system.id, planetIndex });
          expect(hasDock(seed, dock.id)).toBe(true);
          expect(getDock(seed, dock.id)).toEqual(dock);
          expect(allIds.has(dock.id)).toBe(false);
          allIds.add(dock.id);
        });
        expect(getDocksOfSystem(seed, system.id)).toEqual(docks);
      }
    }
  });

  it("gas giants only ever have stations", () => {
    let gasDocks = 0;
    for (const seed of SEEDS) {
      for (const system of systemsOf(seed)) {
        for (const dock of docksOf(seed, system)) {
          const planet = getPlanet(seed, dock.id);
          if (planet?.type === "GAS") {
            gasDocks++;
            expect(dock.kind).toBe("STATION");
            expect(dock.outpostPrice).toBe(null);
          }
        }
      }
    }
    expect(gasDocks).toBeGreaterThan(0); // the test really met some gas giants
  });

  it("outposts have a price and perks, stations have neither", () => {
    let outposts = 0;
    let stations = 0;
    for (const system of systemsOf(12345)) {
      for (const dock of docksOf(12345, system)) {
        if (dock.kind === "OUTPOST") {
          outposts++;
          expect(dock.outpostPrice).toBeGreaterThan(0);
          expect(dock.perks).not.toBe(null);
        } else {
          stations++;
          expect(dock.outpostPrice).toBe(null);
          expect(dock.perks).toBe(null);
        }
      }
    }
    expect(outposts).toBeGreaterThan(0);
    expect(stations).toBeGreaterThan(0);
  });

  it("getDock gives null for a planet that has no dock, and for ids that do not exist", () => {
    let withoutDock = 0;
    for (const seed of SEEDS) {
      for (const system of systemsOf(seed, 30)) {
        const dockIndexes = new Set(dockPlanetIndexes(seed, system));
        for (const planet of getPlanetsOfSystem(seed, system.id)) {
          if (dockIndexes.has(planet.index)) continue;
          withoutDock++;
          expect(getDock(seed, planet.id)).toBe(null);
          expect(hasDock(seed, planet.id)).toBe(false);
          expect(getPlanet(seed, planet.id)).not.toBe(null); // the planet itself still exists
          expect(getJobBoard(seed, planet.id, 0)).toBe(null);
        }
      }
    }
    expect(withoutDock).toBeGreaterThan(0);
    expect(getDock(12345, "nonsense")).toBe(null);
    expect(getDock(12345, "0:0:0:0/99")).toBe(null);
    expect(getDock(12345, "0:0:0:99/0")).toBe(null);
    expect(hasDock(12345, "")).toBe(false);
    expect(getDocksOfSystem(12345, "nonsense")).toEqual([]);
  });

  it("distance between docks is null when either one is not a dock", () => {
    const system = systemsOf(12345).find((s) => s.planetCount >= 6) as StarSystem;
    const docks = docksOf(12345, system);
    const dockIndexes = new Set(dockPlanetIndexes(12345, system));
    const plainPlanet = getPlanetsOfSystem(12345, system.id).find((p) => !dockIndexes.has(p.index));
    expect(plainPlanet).not.toBe(undefined);
    const first = docks[0] as Dock;
    expect(distanceBetweenDocks(12345, first.id, first.id)).toBe(0);
    expect(distanceBetweenDocks(12345, first.id, (plainPlanet as { id: string }).id)).toBe(null);
    expect((distanceBetweenDocks(12345, (plainPlanet as { id: string }).id, first.id))).toBe(null);
  });
});

describe("determinism and order independence of docks", () => {
  it("the same seed gives the same docks, in any order, on every call", () => {
    for (const seed of SEEDS.slice(0, 6)) {
      const systems = systemsOf(seed, 30);
      const forward = systems.map((s) => docksOf(seed, s));
      const backward = [...systems].reverse().map((s) => docksOf(seed, s)).reverse();
      const again = systems.map((s) => docksOf(seed, s));
      expect(backward).toEqual(forward);
      expect(again).toEqual(forward);
    }
  });

  it("different seeds give different dock layouts", () => {
    const layout = (seed: number) =>
      systemsOf(seed, 25).map((s) => `${s.id}:${dockPlanetIndexes(seed, s).join(",")}`);
    expect(layout(1)).not.toEqual(layout(2));
    expect(layout(1)).not.toEqual(layout(3));
  });

  it("a system's docks do not depend on whether other systems were made first", () => {
    const systems = systemsOf(12345, 30);
    const target = systems[systems.length - 1] as StarSystem;
    const alone = docksOf(12345, target);
    for (const s of systems) docksOf(12345, s);
    expect(docksOf(12345, getSystem(12345, target.id) as StarSystem)).toEqual(alone);
  });
});

describe("jobs only start and end at docks", () => {
  it("every origin, stop and destination of every job is a real dock", () => {
    let jobsChecked = 0;
    for (const seed of [1, 12345, 42]) {
      for (const system of systemsOf(seed, 14)) {
        for (const dock of docksOf(seed, system)) {
          for (const slot of [0, 6]) {
            const board = generateJobBoard(seed, dock, slot);
            expect(board.length).toBeGreaterThan(0);
            for (const job of board) {
              jobsChecked++;
              expect(job.originDockId).toBe(dock.id);
              expect(hasDock(seed, job.originDockId)).toBe(true);
              expect(hasDock(seed, job.destinationDockId)).toBe(true);
              expect(job.destinationDockId).not.toBe(dock.id);
              expect(job.stops[job.stops.length - 1]).toBe(job.destinationDockId);
              let previous = dock.id;
              for (const stop of job.stops) {
                expect(getDock(seed, stop)).not.toBe(null);
                const leg = distanceBetweenDocks(seed, previous, stop) as number;
                expect(leg).toBeLessThanOrEqual(MAX_JOB_DISTANCE);
                previous = stop;
              }
            }
          }
        }
      }
    }
    expect(jobsChecked).toBeGreaterThan(200);
  });

  it("a system with only one dock still gets full boards, all to other systems", () => {
    let singleDockSystems = 0;
    for (const seed of [1, 12345]) {
      for (const system of systemsOf(seed, 20)) {
        const docks = docksOf(seed, system);
        if (docks.length !== 1) continue;
        singleDockSystems++;
        const board = generateJobBoard(seed, docks[0] as Dock, 0);
        expect(board.length).toBeGreaterThanOrEqual(3);
        for (const job of board) {
          for (const stop of job.stops) expect(parseDockId(stop)?.systemId).not.toBe(system.id);
        }
      }
    }
    expect(singleDockSystems).toBeGreaterThan(5);
  });

  it("boards stay full (6 jobs, never fewer than 3) in 20 seeds", () => {
    const surveys = [];
    for (let seed = 1; seed <= 20; seed++) surveys.push(surveySeed(seed, { sampleRadius: 12 }));
    const summary = summarizeSurveys(surveys);
    expect(summary.boards).toBeGreaterThan(100);
    expect(summary.thinBoards).toBe(0);
    expect(summary.emptyBoards).toBe(0);
    expect(summary.jobsMin).toBeGreaterThanOrEqual(3);
    expect(summary.reachableMin).toBeGreaterThanOrEqual(10);
  });
});

describe("survey numbers add up", () => {
  it("counts match the real universe", () => {
    const survey = surveySeed(12345, { sampleRadius: 10 });
    let systems = 0;
    let docks = 0;
    for (const system of listSystemsNear(12345, ORIGIN, 35)) {
      systems++;
      docks += docksOf(12345, system).length;
    }
    expect(survey.systems).toBe(systems);
    expect(survey.docks).toBe(docks);
    expect(survey.outposts + survey.stations).toBe(docks);
    expect(survey.planetsPerSystem.reduce((a, b) => a + b, 0)).toBe(systems);
    expect(survey.docksPerSystem.reduce((a, b) => a + b, 0)).toBe(systems);
    expect(survey.docksPerSystem[0]).toBe(0); // no system without a dock
  });
});
