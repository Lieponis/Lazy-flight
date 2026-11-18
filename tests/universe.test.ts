import { describe, expect, it } from "vitest";
import {
  GOODS,
  JOBS_PER_BOARD,
  JOB_DESTINATION_COUNT,
  MAX_PLANETS,
  MAX_PRICE_MULTIPLIER,
  MIN_PRICE_MULTIPLIER,
  START_POINT,
  distance,
  distanceBetweenDocks,
  generateJobBoard,
  getDock,
  getDocks,
  getMarket,
  getPlanet,
  getPlanetsOfSystem,
  getSite,
  getSystem,
  nearestDocks,
  nearestSystems,
  rngFor,
  type StarSystem,
  type Dock,
  type Job,
} from "../src/universe";

const SEED = 12345;

/** A small set of systems used by many tests: the nearest ones to the start point. */
function sampleSystems(seed: number | string, count = 12): StarSystem[] {
  return nearestSystems(seed, START_POINT, count).map((n) => n.system);
}

function sampleDocks(seed: number | string, systemCount = 8): Dock[] {
  const docks: Dock[] = [];
  for (const system of sampleSystems(seed, systemCount)) {
    docks.push(...getDocks(seed, system.id)); // only planets that have a dock
  }
  return docks;
}

describe("random numbers", () => {
  it("gives the same numbers for the same inputs", () => {
    const a = rngFor(SEED, "x", 1);
    const b = rngFor(SEED, "x", 1);
    for (let i = 0; i < 20; i++) expect(a.next()).toBe(b.next());
  });

  it("gives different numbers for different inputs", () => {
    expect(rngFor(SEED, "x", 1).next()).not.toBe(rngFor(SEED, "x", 2).next());
    expect(rngFor(1, "x").next()).not.toBe(rngFor(2, "x").next());
  });
});

describe("determinism (same seed = same universe)", () => {
  it("lists the same systems twice", () => {
    expect(nearestSystems(SEED, START_POINT, 30)).toEqual(nearestSystems(SEED, START_POINT, 30));
  });

  it("gives the same planets, docks, prices and jobs twice", () => {
    const first = sampleDocks(SEED, 4);
    const second = sampleDocks(SEED, 4);
    expect(first).toEqual(second);
    const dock = first[0] as Dock;
    expect(getMarket(SEED, dock, 77)).toEqual(getMarket(SEED, dock, 77));
    expect(generateJobBoard(SEED, dock, 77)).toEqual(generateJobBoard(SEED, dock, 77));
  });

  it("treats the seed 12345 and the text '12345' as the same seed", () => {
    expect(nearestSystems(12345, START_POINT, 30)).toEqual(nearestSystems("12345", START_POINT, 30));
  });
});

describe("different seeds differ", () => {
  it("gives different systems for different seeds", () => {
    const a = nearestSystems(1, START_POINT, 30).map((n) => n.system.name + n.system.id);
    const b = nearestSystems(2, START_POINT, 30).map((n) => n.system.name + n.system.id);
    expect(a).not.toEqual(b);
  });

  it("gives different names for different seeds", () => {
    const a = sampleSystems(111).map((s) => s.name);
    const b = sampleSystems(222).map((s) => s.name);
    expect(a).not.toEqual(b);
  });
});

describe("order independence", () => {
  it("system A is the same whether or not system B was generated first", () => {
    const systems = sampleSystems(SEED, 6);
    const a = systems[0];
    const b = systems[1];
    if (!a || !b) throw new Error("not enough systems for the test");
    const aFirst = getSystem(SEED, a.id);
    getSystem(SEED, b.id);
    getPlanetsOfSystem(SEED, b.id);
    const aAfter = getSystem(SEED, a.id);
    expect(aAfter).toEqual(aFirst);

    // Generate everything in reverse order and compare with forward order.
    const forward = systems.map((s) => getPlanetsOfSystem(SEED, s.id));
    const backward = [...systems].reverse().map((s) => getPlanetsOfSystem(SEED, s.id)).reverse();
    expect(backward).toEqual(forward);
  });

  it("a job board does not change because other boards were made first", () => {
    const docks = sampleDocks(SEED, 3);
    const target = docks[docks.length - 1] as Dock;
    const alone = generateJobBoard(SEED, target, 30);
    for (const d of docks) generateJobBoard(SEED, d, 30);
    expect(generateJobBoard(SEED, target, 30)).toEqual(alone);
  });
});

describe("systems, planets and docks", () => {
  it("every system has 1 to 10 planets", () => {
    for (const system of sampleSystems(SEED, 25)) {
      expect(system.planetCount).toBeGreaterThanOrEqual(1);
      expect(system.planetCount).toBeLessThanOrEqual(MAX_PLANETS);
      expect(getPlanetsOfSystem(SEED, system.id).length).toBe(system.planetCount);
    }
  });

  it("every dock is an outpost or a station on one of its system's planets (the dock rule itself is in universe-v2.test.ts)", () => {
    for (const system of sampleSystems(SEED, 25)) {
      const docks = getDocks(SEED, system.id);
      expect(docks.length).toBeGreaterThanOrEqual(1);
      for (const dock of docks) {
        const planet = getPlanet(SEED, dock.id);
        expect(planet).not.toBe(null);
        if (!planet) continue;
        expect(dock.id).toBe(planet.id);
        expect(["OUTPOST", "STATION"]).toContain(dock.kind);
        if (planet.type === "GAS") expect(dock.kind).toBe("STATION");
        if (dock.kind === "OUTPOST") {
          expect(dock.outpostPrice).not.toBe(null);
          expect(dock.perks).not.toBe(null);
        } else {
          expect(dock.outpostPrice).toBe(null);
          expect(dock.perks).toBe(null);
        }
      }
    }
  });

  it("docks produce 3 goods and want 3 other goods", () => {
    for (const dock of sampleDocks(SEED, 8)) {
      expect(dock.produces.length).toBe(3);
      expect(dock.wants.length).toBe(3);
      for (const g of dock.produces) expect(dock.wants).not.toContain(g);
    }
  });

  it("asking for something that does not exist gives null", () => {
    const real = sampleSystems(SEED, 1)[0] as StarSystem;
    expect(getSystem(SEED, "nonsense")).toBe(null);
    expect(getSite(SEED, "0:0:0:99")).toBe(null);
    expect(getSite(SEED, -5)).toBe(null);
    expect(getSite(SEED, 1.5)).toBe(null);
    expect(getPlanet(SEED, `${real.id}/99`)).toBe(null);
    expect(getPlanet(SEED, "0:0:0:0/99")).toBe(null);
    expect(getDock(SEED, "not-an-id")).toBe(null);
  });

  it("planet colors are valid hex colors", () => {
    for (const system of sampleSystems(SEED, 10)) {
      expect(system.star.color).toMatch(/^#[0-9a-f]{6}$/);
      for (const planet of getPlanetsOfSystem(SEED, system.id)) {
        expect(planet.colors.primary).toMatch(/^#[0-9a-f]{6}$/);
        expect(planet.colors.secondary).toMatch(/^#[0-9a-f]{6}$/);
        expect(planet.colors.accent).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
});

describe("names", () => {
  it("are never empty", () => {
    for (const system of sampleSystems(SEED, 30)) {
      expect(system.name.trim().length).toBeGreaterThan(0);
      for (const planet of getPlanetsOfSystem(SEED, system.id)) {
        expect(planet.name.trim().length).toBeGreaterThan(0);
      }
      for (const dock of getDocks(SEED, system.id)) {
        expect(dock.name.trim().length).toBeGreaterThan(0);
      }
    }
    for (const good of GOODS) expect(good.name.trim().length).toBeGreaterThan(0);
  });

  it("job texts are never empty and have no leftover {placeholders}", () => {
    for (const dock of sampleDocks(SEED, 4)) {
      for (const job of generateJobBoard(SEED, dock, 5)) {
        expect(job.itemName.trim().length).toBeGreaterThan(0);
        expect(job.blurb.trim().length).toBeGreaterThan(0);
        expect(job.blurb).not.toMatch(/[{}]/);
      }
    }
  });
});

describe("economy", () => {
  it("has about 16 goods with unique ids", () => {
    expect(GOODS.length).toBe(16);
    expect(new Set(GOODS.map((g) => g.id)).size).toBe(GOODS.length);
  });

  it("prices stay inside the limits for every good, dock and many time slots", () => {
    for (const dock of sampleDocks(SEED, 6)) {
      for (let slot = 0; slot < 400; slot += 7) {
        for (const entry of getMarket(SEED, dock, slot)) {
          expect(Number.isInteger(entry.price)).toBe(true);
          expect(entry.price).toBeGreaterThanOrEqual(1);
          expect(entry.price).toBeGreaterThanOrEqual(Math.floor(entry.good.basePrice * MIN_PRICE_MULTIPLIER));
          expect(entry.price).toBeLessThanOrEqual(Math.ceil(entry.good.basePrice * MAX_PRICE_MULTIPLIER));
        }
      }
    }
  });

  it("prices drift slowly (no big jumps from one hour to the next)", () => {
    const dock = sampleDocks(SEED, 3)[0] as Dock;
    for (let slot = 0; slot < 200; slot++) {
      const now = getMarket(SEED, dock, slot);
      const next = getMarket(SEED, dock, slot + 1);
      now.forEach((entry, i) => {
        const after = (next[i] as (typeof now)[number]).price;
        // Allow 1 credit of rounding (a price of 7 moving to 8 is not a real jump).
        expect(Math.abs(after - entry.price)).toBeLessThanOrEqual(Math.max(1, entry.price * 0.1));
      });
    }
  });

  it("produced goods are cheaper than wanted goods at the same dock (compared to base price)", () => {
    for (const dock of sampleDocks(SEED, 6)) {
      const market = getMarket(SEED, dock, 10);
      const ratio = (e: (typeof market)[number]) => e.price / e.good.basePrice;
      for (const made of market.filter((e) => e.role === "PRODUCES")) {
        for (const wanted of market.filter((e) => e.role === "WANTS")) {
          expect(ratio(made)).toBeLessThan(ratio(wanted));
        }
      }
    }
  });

  it("prices change over time", () => {
    const dock = sampleDocks(SEED, 3)[0] as Dock;
    const early = getMarket(SEED, dock, 0).map((e) => e.price);
    const later = getMarket(SEED, dock, 60).map((e) => e.price);
    expect(early).not.toEqual(later);
  });
});

describe("jobs", () => {
  const checkBoard = (dock: Dock, slot: number): Job[] => {
    const board = generateJobBoard(SEED, dock, slot);
    expect(board.length).toBeGreaterThan(0);
    expect(board.length).toBeLessThanOrEqual(JOBS_PER_BOARD);
    return board;
  };

  it("makes about 6 jobs per board with unique ids", () => {
    for (const dock of sampleDocks(SEED, 4)) {
      const board = checkBoard(dock, 3);
      expect(new Set(board.map((j) => j.id)).size).toBe(board.length);
      expect(board.length).toBe(JOBS_PER_BOARD);
    }
  });

  it("every destination exists and is one of the nearest docks (by count, no distance limit)", () => {
    for (const dock of sampleDocks(SEED, 6)) {
      const system = getSystem(SEED, dock.systemId) as StarSystem;
      const near = nearestDocks(SEED, system.position, JOB_DESTINATION_COUNT + 1)
        .filter((d) => d.dockId !== dock.id)
        .slice(0, JOB_DESTINATION_COUNT)
        .map((d) => d.dockId);
      expect(near.length).toBe(JOB_DESTINATION_COUNT);
      for (const slot of [0, 5, 40]) {
        for (const job of checkBoard(dock, slot)) {
          expect(job.originDockId).toBe(dock.id);
          expect(job.stops.length).toBeGreaterThanOrEqual(1);
          expect(job.stops[job.stops.length - 1]).toBe(job.destinationDockId);
          expect(job.destinationDockId).not.toBe(dock.id);
          expect(new Set(job.stops).size).toBe(job.stops.length); // no stop twice
          for (const stop of job.stops) {
            expect(getDock(SEED, stop)).not.toBe(null);
            expect(near).toContain(stop);
            expect(distanceBetweenDocks(SEED, dock.id, stop)).not.toBe(null);
          }
        }
      }
    }
  });

  it("jobs have a sensible shape (load type, hold, reward, amount)", () => {
    for (const dock of sampleDocks(SEED, 6)) {
      for (const job of checkBoard(dock, 9)) {
        expect(job.reward).toBeGreaterThan(0);
        expect(job.amount).toBeGreaterThan(0);
        expect(job.special).toBe(null);
        expect(["TRADE", "PASSENGER", "TOUR"]).toContain(job.kind);
        if (job.loadType === "GOODS") {
          expect(job.requiredHold).toBe("CARGO_BAY");
          expect(job.kind).toBe("TRADE");
          expect(GOODS.some((g) => g.id === job.item)).toBe(true);
          expect(job.unitPriceAtDestination).not.toBe(null);
        } else {
          expect(job.requiredHold).toBe("PASSENGER_CABIN");
          expect(dock.hasPassengerTerminal).toBe(true);
          for (const stop of job.stops) expect((getDock(SEED, stop) as Dock).hasPassengerTerminal).toBe(true);
        }
        if (job.timeLimitSlots !== null) expect(job.timeLimitSlots).toBeGreaterThan(0);
      }
    }
  });

  it("tours have 2 to 3 stops and normal jobs have 1", () => {
    let toursSeen = 0;
    for (const dock of sampleDocks(SEED, 30)) {
      for (const slot of [0, 6, 12, 18]) {
        for (const job of generateJobBoard(SEED, dock, slot)) {
          if (job.kind === "TOUR") {
            toursSeen++;
            expect(job.stops.length).toBeGreaterThanOrEqual(2);
            expect(job.stops.length).toBeLessThanOrEqual(3);
          } else {
            expect(job.stops.length).toBe(1);
          }
        }
      }
    }
    expect(toursSeen).toBeGreaterThan(0);
  });

  it("the board is the same inside one refresh period and different later", () => {
    const dock = sampleDocks(SEED, 3)[1] as Dock;
    expect(generateJobBoard(SEED, dock, 0)).toEqual(generateJobBoard(SEED, dock, 1));
    expect(generateJobBoard(SEED, dock, 0).map((j) => j.id)).not.toEqual(
      generateJobBoard(SEED, dock, 600).map((j) => j.id),
    );
  });

  it("totalDistance matches the real distances", () => {
    const dock = sampleDocks(SEED, 3)[0] as Dock;
    for (const job of generateJobBoard(SEED, dock, 2)) {
      let sum = 0;
      let previous = dock.id;
      for (const stop of job.stops) {
        sum += distanceBetweenDocks(SEED, previous, stop) as number;
        previous = stop;
      }
      expect(Math.abs(sum - job.totalDistance)).toBeLessThan(0.1);
    }
  });
});

describe("galaxy", () => {
  it("lists systems nearest first with their real distances", () => {
    const here = { x: START_POINT.x + 5, y: -3, z: START_POINT.z + 8 };
    const list = nearestSystems(SEED, here, 300);
    expect(list.length).toBe(300);
    let last = -1;
    for (const n of list) {
      const d = distance(n.system.position, here);
      expect(Math.abs(d - n.distance)).toBeLessThan(1e-9);
      expect(d).toBeGreaterThanOrEqual(last);
      last = d;
    }
  });

  it("works on every side of the centre (negative coordinates, the centre itself)", () => {
    for (const where of [{ x: -5000, y: -250, z: -90 }, { x: 0, y: 0, z: 0 }, { x: 4000, y: 10, z: -3000 }]) {
      const list = nearestSystems(SEED, where, 40);
      expect(list.length).toBe(40);
      for (const n of list) expect(getSystem(SEED, n.system.id)).toEqual(n.system);
    }
  });
});
