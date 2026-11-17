// Agent 2, stage G3: universe version 3 (the spiral galaxy is the real universe).
// Ids, nearest-docks queries, the near cache, jobs by count, the rim and the centre, old save ids, fingerprints.
import { describe, expect, it } from "vitest";
import {
  JOBS_PER_BOARD,
  JOB_DESTINATION_COUNT,
  NearCache,
  START_POINT,
  UNIVERSE_VERSION,
  WORLD_SEED,
  distance,
  distanceBetweenDocks,
  distanceBetweenSystems,
  dockPlanetIndexes,
  docksOf,
  encodeSystemNumber,
  findDockById,
  findPlanetById,
  findSystemById,
  findSystemByName,
  generateDock,
  generateJobBoard,
  getDock,
  getDocks,
  getJobBoard,
  getMarket,
  getPlanet,
  getPlanets,
  getSite,
  getSystem,
  hashString,
  hasDock,
  isLegacyId,
  mulberry32,
  nearestDocks,
  nearestSites,
  nearestSystems,
  parseDockId,
  parsePlanetId,
  parseSystemId,
  planetIdOf,
  sitesWithin,
  startDockOf,
  startSystem,
  systemsWithin,
  type Seed,
  type StarSystem,
  type Vec3,
} from "../src/universe";

const PLACES: Record<string, Vec3> = {
  centre: { x: 0, y: 0, z: 0 },
  start: START_POINT,
  middle: { x: 30000, y: 0, z: 0 },
  rim: { x: 49000, y: 0, z: 0 },
};
const OLD_IDS = ["3:-2:5:0", "0:0:0:0", "-100:20:30:2", "3:-2:5:0/2", "0:0:0:0/0", "12:12:12:1/9"];

function systemsAt(seed: Seed, where: Vec3, count: number): StarSystem[] {
  return nearestSystems(seed, where, count).map((n) => n.system);
}

describe("universe version 3: settings and the start", () => {
  it("is version 3 on the world seed", () => {
    expect(UNIVERSE_VERSION).toBe(3);
    expect(WORLD_SEED).toBe(12345);
  });

  it("the start system is the nearest system to the start point, with its first dock", () => {
    for (const seed of [WORLD_SEED, 1, 777, "lazy"]) {
      const start = startSystem(seed);
      const nearest = nearestSites(seed, START_POINT, 3);
      expect(start.id).toBe(nearest[0]!.id);
      expect(nearest[0]!.distance).toBeLessThan(nearest[1]!.distance); // no tie
      const dock = startDockOf(seed);
      expect(dock.id).toBe(planetIdOf(start.id, dockPlanetIndexes(seed, start)[0] as number));
      expect(startDockOf(seed)).toEqual(dock);
    }
  });

  it("the world's start system has the name the Lead's brief shows", () => {
    const start = startSystem(WORLD_SEED);
    expect(start.code).toBe("JR62R-MT37");
    expect(start.name.endsWith(" JR62R-MT37")).toBe(true);
    expect(distance(start.position, START_POINT)).toBeLessThan(8);
  });
});

describe("ids: round trips without searching", () => {
  it("system ids are plain numbers and parse back (numbers and digit text)", () => {
    for (const where of Object.values(PLACES)) {
      for (const s of systemsAt(WORLD_SEED, where, 30)) {
        expect(Number.isSafeInteger(s.id)).toBe(true);
        expect(parseSystemId(s.id)).toBe(s.id);
        expect(parseSystemId(String(s.id))).toBe(s.id);
        expect(JSON.parse(JSON.stringify(s)).id).toBe(s.id);
        expect(findSystemById(WORLD_SEED, s.id)).toEqual(s);
        expect(getSystem(WORLD_SEED, String(s.id))).toEqual(s);
        expect(getSite(WORLD_SEED, s.id)?.position).toEqual(s.position);
      }
    }
  });

  it("planet ids are '<system number>/<planet number>' and every planet is found again", () => {
    for (const where of Object.values(PLACES)) {
      for (const s of systemsAt(WORLD_SEED, where, 25)) {
        for (const p of getPlanets(WORLD_SEED, s.id)) {
          expect(p.id).toBe(`${s.id}/${p.index}`);
          expect(p.systemId).toBe(s.id);
          expect(parsePlanetId(p.id)).toEqual({ systemId: s.id, planetIndex: p.index });
          expect(findPlanetById(WORLD_SEED, p.id)).toEqual(p);
        }
        expect(findPlanetById(WORLD_SEED, `${s.id}/${s.planetCount}`)).toBeNull();
      }
    }
  });

  it("every dock id is found by findDockById, and only dock planets are", () => {
    let docks = 0;
    for (const where of Object.values(PLACES)) {
      for (const s of systemsAt(WORLD_SEED, where, 120)) {
        const indexes = dockPlanetIndexes(WORLD_SEED, s);
        for (const p of getPlanets(WORLD_SEED, s.id)) {
          const dock = findDockById(WORLD_SEED, p.id);
          if (indexes.includes(p.index)) {
            docks++;
            expect(dock?.id).toBe(p.id);
            expect(dock?.systemId).toBe(s.id);
            expect(hasDock(WORLD_SEED, p.id)).toBe(true);
            expect(parseDockId(p.id)).toEqual(parsePlanetId(p.id));
          } else {
            expect(dock).toBeNull();
            expect(hasDock(WORLD_SEED, p.id)).toBe(false);
          }
        }
      }
    }
    expect(docks).toBeGreaterThan(400);
  });

  it("ids in the wrong shape give null (not a crash)", () => {
    const real = startSystem(WORLD_SEED);
    for (const bad of [undefined, null, "", "x", "1/2/3", `${real.id}/`, `/1`, `${real.id}/a`, `${real.id}/100`, -1, 1.5, NaN, 2 ** 60, {}, []]) {
      expect(parseSystemId(bad)).toBeNull();
      expect(parsePlanetId(bad)).toBeNull();
      expect(findDockById(WORLD_SEED, bad)).toBeNull();
      expect(findPlanetById(WORLD_SEED, bad)).toBeNull();
      expect(hasDock(WORLD_SEED, bad)).toBe(false);
    }
  });
});

describe("old save ids (universe 1 and 2) are recognised as old", () => {
  it("every lookup answers null / false / empty, never throws", () => {
    for (const id of OLD_IDS) {
      expect(isLegacyId(id)).toBe(true);
      expect(parseSystemId(id)).toBeNull();
      expect(parsePlanetId(id)).toBeNull();
      expect(getSystem(WORLD_SEED, id)).toBeNull();
      expect(getSite(WORLD_SEED, id)).toBeNull();
      expect(getPlanet(WORLD_SEED, id)).toBeNull();
      expect(getDock(WORLD_SEED, id)).toBeNull();
      expect(hasDock(WORLD_SEED, id)).toBe(false);
      expect(getJobBoard(WORLD_SEED, id, 0)).toBeNull();
      expect(getDocks(WORLD_SEED, id)).toEqual([]);
      expect(getPlanets(WORLD_SEED, id)).toEqual([]);
      expect(distanceBetweenDocks(WORLD_SEED, id, id)).toBeNull();
      expect(distanceBetweenSystems(WORLD_SEED, id, id)).toBeNull();
      expect(findSystemByName(WORLD_SEED, id)).toBeNull();
    }
  });

  it("new ids are never taken for old ones", () => {
    const s = startSystem(WORLD_SEED);
    expect(isLegacyId(s.id)).toBe(false);
    expect(isLegacyId(`${s.id}/2`)).toBe(false);
    expect(isLegacyId(undefined)).toBe(false);
    expect(isLegacyId("12345")).toBe(false);
  });
});

describe("nearest systems and docks", () => {
  it("nearestDocks is sorted, and equals a slow check (every dock of the nearest systems)", () => {
    for (const [name, where] of Object.entries(PLACES)) {
      const fast = nearestDocks(WORLD_SEED, where, 60);
      expect(fast.length, name).toBe(60);
      for (let i = 1; i < fast.length; i++) expect(fast[i]!.distance).toBeGreaterThanOrEqual(fast[i - 1]!.distance);
      // slow check: all docks of the nearest 200 systems (far more than 60 docks need), sorted by distance
      const slow: { id: string; d: number }[] = [];
      for (const n of nearestSystems(WORLD_SEED, where, 200)) {
        for (const dock of docksOf(WORLD_SEED, n.system)) slow.push({ id: dock.id, d: distance(n.system.position, where) });
      }
      slow.sort((a, b) => a.d - b.d);
      expect(fast.map((d) => d.dockId)).toEqual(slow.slice(0, 60).map((d) => d.id));
      for (const d of fast) {
        expect(findDockById(WORLD_SEED, d.dockId)).not.toBeNull();
        expect(Math.abs(distance(d.position, where) - d.distance)).toBeLessThan(1e-9);
        expect(parsePlanetId(d.dockId)).toEqual({ systemId: d.systemId, planetIndex: d.planetIndex });
      }
    }
  });

  it("nearestSystems equals a slow check (everything within a bigger radius, sorted)", () => {
    for (const where of [PLACES.start!, PLACES.centre!, PLACES.middle!]) {
      const fast = nearestSites(WORLD_SEED, where, 500);
      const radius = fast[fast.length - 1]!.distance * 1.5;
      const slow = sitesWithin(WORLD_SEED, where, radius);
      expect(fast.map((s) => s.id)).toEqual(slow.slice(0, 500).map((s) => s.id));
      expect(new Set(fast.map((s) => s.id)).size).toBe(500);
    }
  });

  it("a short list is the start of a longer list (the nearest N are the first N of the nearest M)", () => {
    for (const where of Object.values(PLACES)) {
      const long = nearestSites(WORLD_SEED, where, 400).map((s) => s.id);
      expect(nearestSites(WORLD_SEED, where, 37).map((s) => s.id)).toEqual(long.slice(0, 37));
      const longDocks = nearestDocks(WORLD_SEED, where, 120).map((d) => d.dockId);
      expect(nearestDocks(WORLD_SEED, where, 25).map((d) => d.dockId)).toEqual(longDocks.slice(0, 25));
    }
  });

  it("systemsWithin gives full systems, each within the radius", () => {
    const list = systemsWithin(WORLD_SEED, START_POINT, 25);
    expect(list.length).toBeGreaterThan(20);
    let last = -1;
    for (const n of list) {
      expect(n.distance).toBeLessThanOrEqual(25);
      expect(n.distance).toBeGreaterThanOrEqual(last);
      last = n.distance;
      expect(n.system).toEqual(getSystem(WORLD_SEED, n.system.id));
    }
  });

  it("count 0 or negative gives an empty list", () => {
    expect(nearestSystems(WORLD_SEED, START_POINT, 0)).toEqual([]);
    expect(nearestDocks(WORLD_SEED, START_POINT, 0)).toEqual([]);
    expect(nearestDocks(WORLD_SEED, START_POINT, -3)).toEqual([]);
  });
});

describe("NearCache (asked once per position, reused)", () => {
  it("gives the same answers as the direct calls", () => {
    const cache = new NearCache(WORLD_SEED);
    for (const where of Object.values(PLACES)) {
      expect(cache.sites(where, 800)).toEqual(nearestSites(WORLD_SEED, where, 800));
      expect(cache.sites(where, 100)).toEqual(nearestSites(WORLD_SEED, where, 100)); // a prefix of the remembered list
      expect(cache.docks(where, 70)).toEqual(nearestDocks(WORLD_SEED, where, 70));
      expect(cache.docks(where, 400)).toEqual(nearestDocks(WORLD_SEED, where, 400)); // asks for more: works out again
      expect(cache.docks(where, 30)).toEqual(nearestDocks(WORLD_SEED, where, 30));
      expect(cache.sites(where, 2000)).toEqual(nearestSites(WORLD_SEED, where, 2000)); // bigger than before
      expect(cache.systems(where, 20).map((n) => n.system.id)).toEqual(nearestSites(WORLD_SEED, where, 20).map((s) => s.id));
    }
  });

  it("asking twice for the same position and count returns the very same list (no new work)", () => {
    const cache = new NearCache(WORLD_SEED);
    const a = cache.sites(START_POINT, 1000);
    const b = cache.sites(START_POINT, 1000);
    expect(b).toBe(a);
    const da = cache.docks(START_POINT, 50);
    expect(cache.docks(START_POINT, 50)).toEqual(da);
  });

  it("remembers only a few positions and can be cleared", () => {
    const cache = new NearCache(WORLD_SEED, 2);
    for (let i = 0; i < 5; i++) {
      const where = { x: START_POINT.x + i * 10, y: 0, z: START_POINT.z };
      expect(cache.sites(where, 50).length).toBe(50);
    }
    cache.clear();
    expect(cache.sites(START_POINT, 50)).toEqual(nearestSites(WORLD_SEED, START_POINT, 50));
  });
});

describe("determinism in any query order", () => {
  it("the same answers whatever was asked before", () => {
    const first = {
      near: nearestDocks(WORLD_SEED, START_POINT, 30),
      sys: systemsAt(WORLD_SEED, PLACES.middle!, 40),
      board: getJobBoard(WORLD_SEED, startDockOf(WORLD_SEED).id, 12),
    };
    // ask a lot of other things, in another order
    systemsAt(WORLD_SEED, PLACES.rim!, 100);
    nearestDocks(WORLD_SEED, PLACES.centre!, 80);
    getMarket(WORLD_SEED, startDockOf(WORLD_SEED), 5);
    systemsAt(WORLD_SEED, PLACES.middle!, 40);
    const board = getJobBoard(WORLD_SEED, startDockOf(WORLD_SEED).id, 12);
    expect(board).toEqual(first.board);
    expect(systemsAt(WORLD_SEED, PLACES.middle!, 40)).toEqual(first.sys);
    expect(nearestDocks(WORLD_SEED, START_POINT, 30)).toEqual(first.near);
  });

  it("a different seed gives a different galaxy (positions and names)", () => {
    const a = nearestSites(1, START_POINT, 40).map((s) => s.id);
    const b = nearestSites(2, START_POINT, 40).map((s) => s.id);
    expect(a).not.toEqual(b);
    expect(systemsAt(1, START_POINT, 20).map((s) => s.name)).not.toEqual(systemsAt(2, START_POINT, 20).map((s) => s.name));
  });
});

describe("job boards: destinations by count", () => {
  for (const [name, where] of Object.entries(PLACES)) {
    it(`${name}: full boards, destinations are among the nearest docks, nothing repeats, trip lengths are real`, () => {
      const docks = nearestDocks(WORLD_SEED, where, 6);
      for (const nd of docks) {
        const origin = findDockById(WORLD_SEED, nd.dockId)!;
        const originSystem = getSystem(WORLD_SEED, origin.systemId)!;
        const candidates = nearestDocks(WORLD_SEED, originSystem.position, JOB_DESTINATION_COUNT + 1)
          .filter((d) => d.dockId !== origin.id)
          .slice(0, JOB_DESTINATION_COUNT);
        expect(candidates.length).toBe(JOB_DESTINATION_COUNT);
        for (let i = 1; i < candidates.length; i++) expect(candidates[i]!.distance).toBeGreaterThanOrEqual(candidates[i - 1]!.distance);
        const allowed = new Set(candidates.map((c) => c.dockId));
        for (const slot of [0, 6, 30]) {
          const board = generateJobBoard(WORLD_SEED, origin, slot);
          expect(board.length).toBe(JOBS_PER_BOARD);
          expect(new Set(board.map((j) => j.id)).size).toBe(board.length);
          for (const job of board) {
            expect(job.reward).toBeGreaterThan(0);
            expect(new Set(job.stops).size).toBe(job.stops.length);
            let from = originSystem.position;
            let total = 0;
            for (const stop of job.stops) {
              expect(allowed.has(stop), `${stop} is not among the nearest docks`).toBe(true);
              expect(getDock(WORLD_SEED, stop)).not.toBeNull();
              const target = getSystem(WORLD_SEED, parseDockId(stop)!.systemId)!;
              total += distance(from, target.position);
              from = target.position;
            }
            expect(Math.abs(total - job.totalDistance)).toBeLessThan(0.1);
            if (job.timeLimitSlots !== null) expect(job.timeLimitSlots).toBeGreaterThanOrEqual(12 + Math.ceil(job.totalDistance / 10));
          }
        }
      }
    });
  }

  it("a longer trip pays more and gets a longer time limit (same kind of job)", () => {
    // Over many boards: for TRADE jobs the reward per unit of cargo grows with the distance.
    const rows: { d: number; perUnit: number }[] = [];
    for (const where of Object.values(PLACES)) {
      for (const nd of nearestDocks(WORLD_SEED, where, 30)) {
        for (const job of getJobBoard(WORLD_SEED, nd.dockId, 0)!) {
          if (job.kind === "TRADE") rows.push({ d: job.totalDistance, perUnit: job.reward / job.amount });
        }
      }
    }
    rows.sort((a, b) => a.d - b.d);
    const half = Math.floor(rows.length / 2);
    const avg = (r: typeof rows) => r.reduce((s, x) => s + x.perUnit, 0) / r.length;
    expect(avg(rows.slice(half))).toBeGreaterThan(avg(rows.slice(0, half)));
  });

  it("the board stays the same inside one refresh period", () => {
    const dock = startDockOf(WORLD_SEED);
    expect(generateJobBoard(WORLD_SEED, dock, 0)).toEqual(generateJobBoard(WORLD_SEED, dock, 5));
    expect(generateJobBoard(WORLD_SEED, dock, 0).map((j) => j.id)).not.toEqual(generateJobBoard(WORLD_SEED, dock, 600).map((j) => j.id));
  });
});

describe("the rim and the centre (nothing crashes, nothing is empty)", () => {
  it("near the rim the nearest system is 50 to 250 light years away, and lists still fill up", () => {
    const where = PLACES.rim!;
    const sites = nearestSites(WORLD_SEED, where, 50);
    expect(sites.length).toBe(50);
    expect(sites[0]!.distance).toBeGreaterThan(30);
    expect(sites[0]!.distance).toBeLessThan(300);
    expect(nearestDocks(WORLD_SEED, where, 100).length).toBe(100);
    expect(sitesWithin(WORLD_SEED, where, 10)).toEqual([]); // a small radius is simply empty
    expect(systemsWithin(WORLD_SEED, where, 10)).toEqual([]);
  });

  it("boards at the rim are full, and far trips are long but finite", () => {
    for (const nd of nearestDocks(WORLD_SEED, PLACES.rim!, 8)) {
      const board = getJobBoard(WORLD_SEED, nd.dockId, 0)!;
      expect(board.length).toBe(JOBS_PER_BOARD);
      for (const job of board) {
        expect(Number.isFinite(job.totalDistance)).toBe(true);
        expect(Number.isFinite(job.reward)).toBe(true);
        expect(job.totalDistance).toBeLessThan(2000);
      }
    }
  });

  it("outside the disc (no systems nearby) the functions still answer with the nearest real ones", () => {
    const outside = { x: 60000, y: 0, z: 0 };
    const sites = nearestSites(WORLD_SEED, outside, 20);
    expect(sites.length).toBe(20);
    expect(sites[0]!.distance).toBeGreaterThan(9000);
    expect(nearestDocks(WORLD_SEED, outside, 10).length).toBe(10);
    // Very far from the galaxy (more than 200,000 light years from every system): an empty list, no crash, no endless loop.
    const far = { x: 1e7, y: 5e6, z: -1e7 };
    expect(nearestSites(WORLD_SEED, far, 3)).toEqual([]);
    expect(nearestDocks(WORLD_SEED, far, 3)).toEqual([]);
  });

  it("the centre is crowded: the 12 nearest docks are within a few light years", () => {
    const [first] = nearestDocks(WORLD_SEED, PLACES.centre!, 1);
    const origin = findDockById(WORLD_SEED, first!.dockId)!;
    const system = getSystem(WORLD_SEED, origin.systemId)!;
    const destinations = nearestDocks(WORLD_SEED, system.position, JOB_DESTINATION_COUNT + 1);
    expect(destinations[destinations.length - 1]!.distance).toBeLessThan(6);
    expect(generateJobBoard(WORLD_SEED, origin, 0).length).toBe(JOBS_PER_BOARD);
  });

  it("random systems anywhere in the galaxy generate planets, docks and a board without trouble", () => {
    const rnd = mulberry32(1234);
    let boards = 0;
    for (let i = 0; i < 60; i++) {
      const id = Math.floor(rnd() * 4.6e10);
      const system = findSystemById(WORLD_SEED, id);
      if (!system) continue;
      for (const dock of getDocks(WORLD_SEED, id)) {
        const board = generateJobBoard(WORLD_SEED, dock, 0);
        expect(board.length).toBe(JOBS_PER_BOARD);
        boards++;
      }
    }
    expect(boards).toBeGreaterThan(10);
  });

  it("system codes of real systems never repeat in a long list", () => {
    const seen = new Set<string>();
    for (const s of systemsAt(WORLD_SEED, PLACES.middle!, 5000)) {
      expect(s.code).toBe(encodeSystemNumber(s.id));
      expect(seen.has(s.code)).toBe(false);
      seen.add(s.code);
    }
  });
});

// ------------------------------------------------------------------------------------------------------------
// The fingerprint: ONE number per seed that changes if ANYTHING the universe produces changes (systems with their
// names, planets, docks, markets, job boards). Names are included. Recorded by Agent 2 in stage G3 (universe version 3).
// If one of these fails, the universe changed: every save and every id would be wrong. Change them on purpose only.
function universeFingerprint(seed: Seed): string {
  const parts: string[] = [];
  for (const { system } of nearestSystems(seed, START_POINT, 60)) {
    parts.push(JSON.stringify(system));
    for (const planet of getPlanets(seed, system.id)) {
      parts.push(JSON.stringify(planet));
      if (!hasDock(seed, planet.id)) continue;
      const dock = generateDock(seed, planet);
      parts.push(JSON.stringify(dock));
      parts.push(JSON.stringify(getMarket(seed, dock, 3)));
      parts.push(JSON.stringify(getJobBoard(seed, dock.id, 3)));
    }
  }
  const text = parts.join("|");
  return `${hashString(text).toString(16)}:${text.length}`;
}

describe("universe v3 fingerprints", () => {
  const RECORDED: Record<string, string> = { "12345": "a8bc7ccf:483603", "777": "feb0754:516159", "4242": "de7480c9:496937" };
  for (const seed of [12345, 777, 4242]) {
    it(`seed ${seed}: same systems, names, planets, docks, markets and jobs as recorded`, () => {
      expect(universeFingerprint(seed)).toBe(RECORDED[String(seed)]);
    });
  }
});
