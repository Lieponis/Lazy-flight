import { describe, expect, it } from "vitest";
import {
  GOODS,
  JOBS_PER_BOARD,
  MAX_JOB_DISTANCE,
  MAX_PLANETS,
  MAX_PRICE_MULTIPLIER,
  MIN_PRICE_MULTIPLIER,
  distance,
  distanceBetweenDocks,
  generateDock,
  generateJobBoard,
  getDock,
  getMarket,
  getPlanet,
  getPlanetsOfSystem,
  getSite,
  getSystem,
  listSystemsNear,
  rngFor,
  type Dock,
  type Job,
} from "../src/universe";

const SEED = 12345;
const ORIGIN = { x: 0, y: 0, z: 0 };

/** A small set of systems used by many tests. */
function sampleSystems(seed: number | string, count = 12) {
  return listSystemsNear(seed, ORIGIN, 40).slice(0, count);
}

function sampleDocks(seed: number | string, systemCount = 8): Dock[] {
  const docks: Dock[] = [];
  for (const system of sampleSystems(seed, systemCount)) {
    for (const planet of getPlanetsOfSystem(seed, system.id)) docks.push(generateDock(seed, planet));
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
    expect(listSystemsNear(SEED, ORIGIN, 30)).toEqual(listSystemsNear(SEED, ORIGIN, 30));
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
    expect(listSystemsNear(12345, ORIGIN, 30)).toEqual(listSystemsNear("12345", ORIGIN, 30));
  });
});

describe("different seeds differ", () => {
  it("gives different systems for different seeds", () => {
    const a = listSystemsNear(1, ORIGIN, 30).map((s) => s.name + s.id);
    const b = listSystemsNear(2, ORIGIN, 30).map((s) => s.name + s.id);
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
  it("every system has 1 to 8 planets", () => {
    for (const system of sampleSystems(SEED, 25)) {
      expect(system.planetCount).toBeGreaterThanOrEqual(1);
      expect(system.planetCount).toBeLessThanOrEqual(MAX_PLANETS);
      expect(getPlanetsOfSystem(SEED, system.id).length).toBe(system.planetCount);
    }
  });

  it("every planet has exactly one dock, either an outpost or a station", () => {
    for (const system of sampleSystems(SEED, 25)) {
      for (const planet of getPlanetsOfSystem(SEED, system.id)) {
        const dock = getDock(SEED, planet.id);
        expect(dock).not.toBe(null);
        if (!dock) continue;
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
    expect(getSystem(SEED, "nonsense")).toBe(null);
    expect(getSite(SEED, "0:0:0:99")).toBe(null);
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
        const dock = generateDock(SEED, planet);
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

  it("every destination exists and is within MAX_JOB_DISTANCE", () => {
    for (const dock of sampleDocks(SEED, 6)) {
      for (const slot of [0, 5, 40]) {
        for (const job of checkBoard(dock, slot)) {
          expect(job.originDockId).toBe(dock.id);
          expect(job.stops.length).toBeGreaterThanOrEqual(1);
          expect(job.stops[job.stops.length - 1]).toBe(job.destinationDockId);
          expect(job.destinationDockId).not.toBe(dock.id);
          let previous = dock.id;
          for (const stop of job.stops) {
            expect(getDock(SEED, stop)).not.toBe(null);
            const fromOrigin = distanceBetweenDocks(SEED, dock.id, stop);
            const leg = distanceBetweenDocks(SEED, previous, stop);
            expect(fromOrigin).not.toBe(null);
            expect(leg).not.toBe(null);
            expect(fromOrigin as number).toBeLessThanOrEqual(MAX_JOB_DISTANCE);
            expect(leg as number).toBeLessThanOrEqual(MAX_JOB_DISTANCE);
            previous = stop;
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
  it("lists systems nearest first and all within the radius", () => {
    const list = listSystemsNear(SEED, { x: 5, y: -3, z: 8 }, 30);
    expect(list.length).toBeGreaterThan(0);
    let last = -1;
    for (const s of list) {
      const d = distance(s.position, { x: 5, y: -3, z: 8 });
      expect(d).toBeLessThanOrEqual(30);
      expect(d).toBeGreaterThanOrEqual(last);
      last = d;
    }
  });

  it("works with negative coordinates (endless in every direction)", () => {
    const list = listSystemsNear(SEED, { x: -500, y: -250, z: -90 }, 30);
    expect(list.length).toBeGreaterThan(0);
    for (const s of list) expect(getSystem(SEED, s.id)).toEqual(s);
  });
});
