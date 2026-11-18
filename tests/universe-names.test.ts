// Agent 2: the world seed and globally unique names (stage N1), rebuilt for universe version 3 (stage G3):
// system numbers, 9-symbol codes, pure names near the start.
import { describe, expect, it } from "vitest";
import {
  DISC_RADIUS,
  MAX_DOCK_FULL_NAME_LENGTH,
  MAX_PLANET_NAME_LENGTH,
  MAX_SYSTEM_NAME_LENGTH,
  PURE_NAMES,
  START_POINT,
  WORLD_SEED,
  decodeSystemNumber,
  distance,
  docksOf,
  encodeSystemNumber,
  findDockById,
  findSystemByName,
  getDock,
  getPlanetsOfSystem,
  getSite,
  getSystem,
  hasDock,
  mulberry32,
  nameStats,
  nearestSystems,
  normalizeSystemNumberCode,
  pureNameCount,
  pureNameOf,
  systemIdOfPureName,
  type Seed,
  type StarSystem,
} from "../src/universe";

const ALPHABET = /^[2-9DHJMNPRTV]+-?[2-9DHJMNPRTV]*$/;
/** About the largest system number (the real largest is a little over 4.66e10). */
const ID_SPACE = 4.7e10;

/** The nearest `count` systems to the start point. */
function near(seed: Seed, count: number): StarSystem[] {
  return nearestSystems(seed, START_POINT, count).map((n) => n.system);
}

/** A random system number that really holds a system (about 4 in 10 numbers do). */
function randomRealId(seed: Seed, rnd: () => number): number {
  for (;;) {
    const id = Math.floor(rnd() * ID_SPACE);
    if (getSite(seed, id)) return id;
  }
}

describe("the world seed", () => {
  it("is 12345", () => {
    expect(WORLD_SEED).toBe(12345);
  });
});

describe("system codes (bijection)", () => {
  it("decode(encode(n)) gives the number back, for small, large and the biggest numbers", () => {
    const rnd = mulberry32(2024);
    for (const range of [10, 1e3, 1e5, 1e7, 1e9, 1e11, 2 ** 50]) {
      for (let i = 0; i < 3000; i++) {
        const n = Math.floor(rnd() * range);
        expect(decodeSystemNumber(encodeSystemNumber(n)), String(n)).toBe(n);
      }
    }
    for (const n of [0, 1, 83520, 83521, 83522, 1419856, 4.66e10, 2 ** 53 - 1]) {
      expect(decodeSystemNumber(encodeSystemNumber(n))).toBe(n);
    }
  });

  it("no two numbers share a code (the first 300,000 numbers, and a stretch around every length change)", () => {
    const seen = new Set<string>();
    for (let n = 0; n < 300000; n++) {
      const code = encodeSystemNumber(n);
      expect(seen.has(code)).toBe(false);
      seen.add(code);
    }
    const stretch = new Set<string>();
    for (const edge of [83521, 1419857, 24137569, 410338673, 6975757441]) {
      for (let n = edge - 500; n < edge + 500; n++) stretch.add(encodeSystemNumber(n));
    }
    expect(stretch.size).toBe(5 * 1000);
  });

  it("uses only friendly characters (no vowels, no 0/O/1/I/L look-alikes)", () => {
    for (const n of [0, 5, 123, 99999, 5e6, 3e9, 4.66e10]) {
      const code = encodeSystemNumber(n);
      expect(code).toMatch(ALPHABET);
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  it("is short near the centre and 9 symbols almost everywhere, and never more than 9 in the galaxy", () => {
    const symbols = (n: number) => encodeSystemNumber(n).replace("-", "").length;
    expect(symbols(0)).toBe(4);
    expect(symbols(83520)).toBe(4);
    expect(symbols(83521)).toBe(5);
    expect(symbols(4.66e10)).toBeLessThanOrEqual(9);
    const rnd = mulberry32(5);
    let nine = 0;
    for (let i = 0; i < 2000; i++) {
      const length = symbols(randomRealId(WORLD_SEED, rnd));
      expect(length).toBeLessThanOrEqual(9);
      if (length === 9) nine++;
    }
    expect(nine / 2000).toBeGreaterThan(0.7); // the report says about 85 %
  });

  it("rejects text that is not a code, and accepts any capitals, spaces or a missing hyphen", () => {
    for (const bad of ["", "abcd", "22222222222222222222222222222222222", "O1-23", "4F-9!", "2-3"]) expect(decodeSystemNumber(bad)).toBeNull();
    const code = encodeSystemNumber(28113904412);
    expect(decodeSystemNumber(code.toLowerCase())).toBe(28113904412);
    expect(decodeSystemNumber(" " + code.replace("-", "") + " ")).toBe(28113904412);
    expect(normalizeSystemNumberCode(code.toLowerCase())).toBe(code.replace("-", ""));
  });
});

describe("pure names", () => {
  it("are thousands of curated names with no repeats, digits or commas, and none ending in a Roman number", () => {
    expect(PURE_NAMES.length).toBeGreaterThan(4000);
    expect(new Set(PURE_NAMES.map((n) => n.toLowerCase())).size).toBe(PURE_NAMES.length);
    for (const name of PURE_NAMES) {
      expect(name).not.toMatch(/[0-9,]/);
      expect(name.split(" ").pop()).not.toMatch(/^[IVX]+$/);
    }
  });

  for (const seed of [WORLD_SEED, 777, 4242]) {
    it(`seed ${seed}: every name has at most one owner, and owner and name agree`, () => {
      const owners = new Map<number, string>();
      for (const name of PURE_NAMES) {
        const id = systemIdOfPureName(seed, name);
        if (id === null) continue;
        expect(owners.has(id), `${id} owns two names`).toBe(false);
        owners.set(id, name);
        expect(pureNameOf(seed, id)).toBe(name);
        expect(getSystem(seed, id)).not.toBeNull();
      }
      expect(owners.size).toBe(pureNameCount(seed));
      expect(owners.size).toBeGreaterThan(4000);
    });
  }

  it("only systems near the start can have one (all within 300 light years of the start point)", () => {
    let pure = 0;
    for (const name of PURE_NAMES) {
      const id = systemIdOfPureName(WORLD_SEED, name);
      if (id === null) continue;
      const site = getSite(WORLD_SEED, id)!;
      pure++;
      expect(distance(site.position, START_POINT), name).toBeLessThan(300);
    }
    expect(pure).toBeGreaterThan(4000);
    // far from the start: nobody
    const rnd = mulberry32(31);
    for (let i = 0; i < 500; i++) expect(pureNameOf(WORLD_SEED, randomRealId(WORLD_SEED, rnd))).toBeNull();
    for (const n of near(WORLD_SEED, 50)) expect(n.isPure === (pureNameOf(WORLD_SEED, n.id) !== null)).toBe(true);
  });

  it("are 5 to 8 % of the 5,000 systems nearest to the start", () => {
    const stats = nameStats(WORLD_SEED, START_POINT, 5000, 0);
    const share = stats.pureSystems / stats.systems;
    expect(share).toBeGreaterThan(0.05);
    expect(share).toBeLessThan(0.08);
  });
});

describe("system, planet and dock names", () => {
  it("a system name is either a pure name or word + code, with the right code", () => {
    for (const s of near(WORLD_SEED, 300)) {
      expect(s.code).toBe(encodeSystemNumber(s.id));
      if (s.isPure) {
        expect(s.name).toBe(s.baseName);
        expect(pureNameOf(WORLD_SEED, s.id)).toBe(s.name);
      } else {
        expect(s.name).toBe(`${s.baseName} ${s.code}`);
        expect(pureNameOf(WORLD_SEED, s.id)).toBeNull();
      }
    }
  });

  it("planets are '<system name> <Roman number>', the nickname is optional and never the name", () => {
    const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
    let nicknames = 0;
    for (const s of near(WORLD_SEED, 40)) {
      getPlanetsOfSystem(WORLD_SEED, s.id).forEach((p, i) => {
        expect(p.name).toBe(`${s.name} ${ROMAN[i]}`);
        if (p.nickname !== undefined) {
          nicknames++;
          expect(p.nickname.trim().length).toBeGreaterThan(0);
          expect(p.nickname).not.toBe(p.name);
        }
      });
    }
    expect(nicknames).toBeGreaterThan(0);
  });

  it("docks of one system have different short names, and every full name is '<short>, <planet>'", () => {
    for (const seed of [WORLD_SEED, 1, 99999]) {
      for (const s of near(seed, 60)) {
        const docks = docksOf(seed, s);
        expect(new Set(docks.map((d) => d.name.toLowerCase())).size).toBe(docks.length);
        const planets = getPlanetsOfSystem(seed, s.id);
        for (const d of docks) {
          const planet = planets.find((p) => p.id === d.planetId)!;
          expect(d.fullName).toBe(`${d.name}, ${planet.name}`);
          expect(d.name).toMatch(/ (Outpost|Station)$/);
          expect(getDock(seed, d.id)!.fullName).toBe(d.fullName);
        }
      }
    }
  });

  it("the names of a thing never change between calls", () => {
    const a = near(WORLD_SEED, 30).map((s) => s.name);
    const b = near(WORLD_SEED, 30).map((s) => s.name);
    expect(a).toEqual(b);
  });
});

describe("findSystemByName", () => {
  const some = near(WORLD_SEED, 30);
  const coded = some.find((s) => !s.isPure)!;
  const pure = near(WORLD_SEED, 400).find((s) => s.isPure)!;

  it("finds by full name, by code (with or without the hyphen, any capitals) and by pure name", () => {
    expect(findSystemByName(WORLD_SEED, coded.name)?.id).toBe(coded.id);
    expect(findSystemByName(WORLD_SEED, coded.name.toUpperCase())?.id).toBe(coded.id);
    expect(findSystemByName(WORLD_SEED, coded.code)?.id).toBe(coded.id);
    expect(findSystemByName(WORLD_SEED, coded.code.toLowerCase())?.id).toBe(coded.id);
    expect(findSystemByName(WORLD_SEED, coded.code.replace("-", ""))?.id).toBe(coded.id);
    expect(findSystemByName(WORLD_SEED, `  ${pure.name.toLowerCase()}  `)?.id).toBe(pure.id);
    expect(findSystemByName(WORLD_SEED, pure.code)?.id).toBe(pure.id);
  });

  it("finds nothing for rubbish, for a wrong word part, for a free number, or for an empty box", () => {
    expect(findSystemByName(WORLD_SEED, "")).toBeNull();
    expect(findSystemByName(WORLD_SEED, "Nothing Here")).toBeNull();
    expect(findSystemByName(WORLD_SEED, "Wrongword " + coded.code)).toBeNull();
    let free = 0;
    while (getSite(WORLD_SEED, free)) free++; // the first number that holds no system
    expect(findSystemByName(WORLD_SEED, encodeSystemNumber(free))).toBeNull();
  });

  it("finds far away systems by their code", () => {
    const rnd = mulberry32(9);
    for (let i = 0; i < 40; i++) {
      const id = randomRealId(WORLD_SEED, rnd);
      const sys = getSystem(WORLD_SEED, id)!;
      expect(findSystemByName(WORLD_SEED, sys.name)?.id).toBe(id);
      expect(findSystemByName(WORLD_SEED, sys.code)?.id).toBe(id);
    }
  });
});

describe("everything has a unique name (big scan)", () => {
  for (const seed of [WORLD_SEED, 777, 4242]) {
    it(`seed ${seed}: no two systems, planets or docks share a full name (20,000 systems near the start)`, () => {
      const stats = nameStats(seed, START_POINT, 20000, 700);
      expect(stats.systems).toBe(20000);
      expect(stats.docks).toBeGreaterThan(500);
      expect(stats.collisions).toBe(0);
      expect(stats.badLengths).toBe(0);
    });
  }

  it("a system, a planet and a dock never get the same name either (checked together in one set)", () => {
    const seen = new Set<string>();
    for (const s of near(WORLD_SEED, 500)) {
      for (const n of [s.name, ...getPlanetsOfSystem(WORLD_SEED, s.id).map((p) => p.name), ...docksOf(WORLD_SEED, s).map((d) => d.fullName)]) {
        const key = n.toLowerCase();
        expect(seen.has(key), n).toBe(false);
        seen.add(key);
      }
    }
  });

  it("other seeds also give valid unique names (a quick scan of 12 seeds)", () => {
    for (let seed: Seed = 1; seed <= 12; seed++) {
      const stats = nameStats(seed * 31, START_POINT, 800, 100);
      expect(stats.collisions).toBe(0);
      expect(stats.badLengths).toBe(0);
    }
    for (const seed of ["hello", "Lazy Flight"]) expect(nameStats(seed, START_POINT, 500, 80).collisions).toBe(0);
  });
});

describe("names are never empty and never too long", () => {
  it("near the start", () => {
    const stats = nameStats(WORLD_SEED, START_POINT, 5000, 500);
    expect(stats.longestSystem.length).toBeLessThanOrEqual(MAX_SYSTEM_NAME_LENGTH);
    expect(stats.longestPlanet.length).toBeLessThanOrEqual(MAX_PLANET_NAME_LENGTH);
    expect(stats.longestDock.length).toBeLessThanOrEqual(MAX_DOCK_FULL_NAME_LENGTH);
  });

  it("anywhere in the galaxy (random systems from the centre to the rim), where the codes are longest", () => {
    const rnd = mulberry32(77);
    let worst = 0;
    for (let i = 0; i < 400; i++) {
      const id = randomRealId(WORLD_SEED, rnd);
      const sys = getSystem(WORLD_SEED, id)!;
      expect(sys.name.trim().length).toBeGreaterThan(0);
      expect(sys.name.length).toBeLessThanOrEqual(MAX_SYSTEM_NAME_LENGTH);
      for (const p of getPlanetsOfSystem(WORLD_SEED, id)) {
        expect(p.name.length).toBeLessThanOrEqual(MAX_PLANET_NAME_LENGTH);
        if (hasDock(WORLD_SEED, p.id)) {
          const d = findDockById(WORLD_SEED, p.id)!;
          expect(d.fullName.length).toBeLessThanOrEqual(MAX_DOCK_FULL_NAME_LENGTH);
          worst = Math.max(worst, d.fullName.length);
        }
      }
    }
    expect(worst).toBeGreaterThan(0);
    expect(DISC_RADIUS).toBe(50000);
  });
});
