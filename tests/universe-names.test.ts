// Agent 2, stage N1: the world seed and globally unique names.
import { describe, expect, it } from "vitest";
import {
  MAX_DOCK_FULL_NAME_LENGTH,
  MAX_PLANET_NAME_LENGTH,
  MAX_SYSTEM_NAME_LENGTH,
  PURE_NAMES,
  PURE_NAME_REGION,
  WORLD_SEED,
  decodeSystemCode,
  docksOf,
  encodeSystemCode,
  findSystemByName,
  getDock,
  getPlanetsOfSystem,
  getSite,
  getSystem,
  hasDock,
  listSystemsNear,
  mulberry32,
  nameStats,
  normalizeSystemCode,
  parseSystemId,
  pureNameCount,
  pureNameOf,
  systemCodeOfId,
  systemIdOfPureName,
  systemIdOf,
  type Seed,
} from "../src/universe";

const ORIGIN = { x: 0, y: 0, z: 0 };
const ALPHABET = /^[2-9DHJMNPRTV]+-?[2-9DHJMNPRTV]*$/;

describe("the world seed", () => {
  it("is 12345", () => {
    expect(WORLD_SEED).toBe(12345);
  });
});

describe("system codes (bijection)", () => {
  it("decode(encode(id)) gives the id back, for near, far and negative coordinates", () => {
    const rnd = mulberry32(2024);
    const ranges = [10, 100, 1000, 100000, 1e9, 2 ** 40];
    for (const range of ranges) {
      for (let i = 0; i < 4000; i++) {
        const c = () => Math.floor((rnd() * 2 - 1) * range);
        const sx = c(), sy = c(), sz = c(), index = Math.floor(rnd() * 3);
        const code = encodeSystemCode(sx, sy, sz, index);
        expect(code, `${sx}:${sy}:${sz}:${index}`).not.toBeNull();
        expect(decodeSystemCode(code!)).toBe(systemIdOf(sx, sy, sz, index));
      }
    }
  });

  it("no two addresses share a code (every address in a cube of 41 x 41 x 41 sectors)", () => {
    const seen = new Set<string>();
    for (let x = -20; x <= 20; x++)
      for (let y = -20; y <= 20; y++)
        for (let z = -20; z <= 20; z++)
          for (let i = 0; i < 3; i++) {
            const code = encodeSystemCode(x, y, z, i)!;
            expect(seen.has(code)).toBe(false);
            seen.add(code);
          }
    expect(seen.size).toBe(41 * 41 * 41 * 3);
  });

  it("uses only friendly characters (no vowels, no 0/O/1/I/L look-alikes)", () => {
    for (const id of ["0:0:0:0", "5:-3:9:2", "-100:200:-300:1", "123456789:-987654321:5:0"]) {
      const code = systemCodeOfId(id)!;
      expect(code).toMatch(ALPHABET);
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  it("is short near the origin and grows slowly with distance", () => {
    const symbols = (sector: number) => encodeSystemCode(sector, -sector, sector, 2)!.replace("-", "").length;
    expect(symbols(1)).toBeLessThanOrEqual(4);
    expect(symbols(10)).toBeLessThanOrEqual(5); // about 100 light years
    expect(symbols(60)).toBeLessThanOrEqual(6); // about 600 light years
    expect(symbols(100)).toBeLessThanOrEqual(7); // about 1,000 light years
  });

  it("rejects text that is not a code, and accepts any capitals, spaces or a missing hyphen", () => {
    for (const bad of ["", "abcd", "22222222222222222222222222222222222", "O1-23", "4F-9!"]) expect(decodeSystemCode(bad)).toBeNull();
    const code = systemCodeOfId("3:-2:5:1")!;
    expect(decodeSystemCode(code.toLowerCase())).toBe("3:-2:5:1");
    expect(decodeSystemCode(" " + code.replace("-", "") + " ")).toBe("3:-2:5:1");
    expect(normalizeSystemCode(code.toLowerCase())).toBe(code.replace("-", ""));
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
      const owners = new Map<string, string>();
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

  it("only systems inside the pure-name region can have one", () => {
    const r = PURE_NAME_REGION;
    const far = systemIdOf(r + 5, 0, 0, 0);
    expect(pureNameOf(WORLD_SEED, far)).toBeNull();
    for (const s of listSystemsNear(WORLD_SEED, ORIGIN, 400)) {
      if (s.isPure) {
        const p = parseSystemId(s.id)!;
        expect(Math.max(Math.abs(p.sx), Math.abs(p.sy), Math.abs(p.sz))).toBeLessThanOrEqual(r);
      }
    }
  });

  it("are 5 to 10 % of the systems near the origin", () => {
    const stats = nameStats(WORLD_SEED, ORIGIN, 150, 0);
    const share = stats.pureSystems / stats.systems;
    expect(share).toBeGreaterThan(0.05);
    expect(share).toBeLessThan(0.1);
  });
});

describe("system, planet and dock names", () => {
  it("a system name is either a pure name or word + code, with the right code", () => {
    for (const s of listSystemsNear(WORLD_SEED, ORIGIN, 60)) {
      expect(s.code).toBe(systemCodeOfId(s.id));
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
    for (const s of listSystemsNear(WORLD_SEED, ORIGIN, 25)) {
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
      for (const s of listSystemsNear(seed, ORIGIN, 40)) {
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
    const a = listSystemsNear(WORLD_SEED, ORIGIN, 30).map((s) => s.name);
    const b = listSystemsNear(WORLD_SEED, ORIGIN, 30).map((s) => s.name);
    expect(a).toEqual(b);
  });
});

describe("findSystemByName", () => {
  const some = listSystemsNear(WORLD_SEED, ORIGIN, 30);
  const coded = some.find((s) => !s.isPure)!;
  const pure = listSystemsNear(WORLD_SEED, ORIGIN, 80).find((s) => s.isPure)!;

  it("finds by full name, by code (with or without the hyphen, any capitals) and by pure name", () => {
    expect(findSystemByName(WORLD_SEED, coded.name)?.id).toBe(coded.id);
    expect(findSystemByName(WORLD_SEED, coded.name.toUpperCase())?.id).toBe(coded.id);
    expect(findSystemByName(WORLD_SEED, coded.code)?.id).toBe(coded.id);
    expect(findSystemByName(WORLD_SEED, coded.code.toLowerCase())?.id).toBe(coded.id);
    expect(findSystemByName(WORLD_SEED, coded.code.replace("-", ""))?.id).toBe(coded.id);
    expect(findSystemByName(WORLD_SEED, `  ${pure.name.toLowerCase()}  `)?.id).toBe(pure.id);
    expect(findSystemByName(WORLD_SEED, pure.code)?.id).toBe(pure.id);
  });

  it("finds nothing for rubbish, for a wrong word part, or for an empty box", () => {
    expect(findSystemByName(WORLD_SEED, "")).toBeNull();
    expect(findSystemByName(WORLD_SEED, "Nothing Here")).toBeNull();
    expect(findSystemByName(WORLD_SEED, "Wrongword " + coded.code)).toBeNull();
  });

  it("finds far away systems by their code (negative and huge coordinates)", () => {
    for (const [x, y, z] of [[-7000, 12, 5000], [123456, -987654, 55]]) {
      const site = getSitesIn(x!, y!, z!);
      if (site === null) continue;
      const sys = getSystem(WORLD_SEED, site)!;
      expect(findSystemByName(WORLD_SEED, sys.name)?.id).toBe(site);
    }
  });
});

/** The id of a system in that sector, or null if the sector happens to hold none. */
function getSitesIn(sx: number, sy: number, sz: number): string | null {
  for (let i = 0; i < 3; i++) if (getSite(WORLD_SEED, systemIdOf(sx, sy, sz, i))) return systemIdOf(sx, sy, sz, i);
  return null;
}

describe("everything has a unique name (big scan)", () => {
  for (const seed of [WORLD_SEED, 777, 4242]) {
    it(`seed ${seed}: no two systems, planets or docks share a full name`, () => {
      const stats = nameStats(seed, ORIGIN, 150, 80);
      expect(stats.systems).toBeGreaterThan(10000);
      expect(stats.docks).toBeGreaterThan(500);
      expect(stats.collisions).toBe(0);
      expect(stats.badLengths).toBe(0);
    });
  }

  it("a system, a planet and a dock never get the same name either (checked together in one set)", () => {
    const seen = new Set<string>();
    for (const s of listSystemsNear(WORLD_SEED, ORIGIN, 60)) {
      for (const n of [s.name, ...getPlanetsOfSystem(WORLD_SEED, s.id).map((p) => p.name), ...docksOf(WORLD_SEED, s).map((d) => d.fullName)]) {
        const key = n.toLowerCase();
        expect(seen.has(key), n).toBe(false);
        seen.add(key);
      }
    }
  });

  it("other seeds also give valid unique names (a quick scan of 12 seeds)", () => {
    for (let seed: Seed = 1; seed <= 12; seed++) {
      const stats = nameStats(seed * 31, ORIGIN, 45, 45);
      expect(stats.collisions).toBe(0);
      expect(stats.badLengths).toBe(0);
    }
    for (const seed of ["hello", "Lazy Flight"]) expect(nameStats(seed, ORIGIN, 40, 40).collisions).toBe(0);
  });
});

describe("names are never empty and never too long", () => {
  it("near the origin", () => {
    const stats = nameStats(WORLD_SEED, ORIGIN, 150, 80);
    expect(stats.longestSystem.length).toBeLessThanOrEqual(MAX_SYSTEM_NAME_LENGTH);
    expect(stats.longestPlanet.length).toBeLessThanOrEqual(MAX_PLANET_NAME_LENGTH);
    expect(stats.longestDock.length).toBeLessThanOrEqual(MAX_DOCK_FULL_NAME_LENGTH);
  });

  it("far away (up to a billion light years), where the codes are longest", () => {
    const rnd = mulberry32(77);
    let worst = 0;
    for (const range of [1e3, 1e6, 1e8, 1e8]) {
      for (let i = 0; i < 60; i++) {
        const c = () => Math.floor((rnd() * 2 - 1) * range);
        const sx = c(), sy = c(), sz = c();
        const id = getSitesIn(sx, sy, sz);
        if (id === null) continue;
        const sys = getSystem(WORLD_SEED, id)!;
        expect(sys.name.trim().length).toBeGreaterThan(0);
        expect(sys.name.length).toBeLessThanOrEqual(MAX_SYSTEM_NAME_LENGTH);
        for (const p of getPlanetsOfSystem(WORLD_SEED, id)) {
          expect(p.name.length).toBeLessThanOrEqual(MAX_PLANET_NAME_LENGTH);
          if (hasDock(WORLD_SEED, p.id)) {
            const d = getDock(WORLD_SEED, p.id)!;
            expect(d.fullName.length).toBeLessThanOrEqual(MAX_DOCK_FULL_NAME_LENGTH);
            worst = Math.max(worst, d.fullName.length);
          }
        }
      }
    }
    expect(worst).toBeGreaterThan(0);
  });
});
