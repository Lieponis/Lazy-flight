import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_STARFIELD_SEED, starfieldPositions, systemSkySeed } from "../src/render/helpers";

// Stage G5a step 4: every system has its own pattern of background dots (decoration only). The default call must stay exactly what
// every screen drew before, two systems must differ, and one system must always give the same dots.

/** The old starfield function, copied as it was before the seed argument existed. */
function starfieldBefore(count: number, radius: number): Float32Array {
  const out = new Float32Array(count * 3);
  let s = 123456789;
  const next = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const z = next() * 2 - 1;
    const a = next() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    out[i * 3] = Math.cos(a) * r * radius;
    out[i * 3 + 1] = z * radius;
    out[i * 3 + 2] = Math.sin(a) * r * radius;
  }
  return out;
}

const same = (a: Float32Array, b: Float32Array): boolean => a.length === b.length && a.every((v, i) => v === b[i]);
const patternKey = (a: Float32Array): string => Array.from(a.slice(0, 12)).join(",");

describe("the starfield without a seed (what every screen drew before)", () => {
  it("is the number the dots have always used", () => {
    expect(DEFAULT_STARFIELD_SEED).toBe(123456789);
  });

  it("is identical to the old function for the sizes the screens use", () => {
    for (const [count, radius] of [
      [260, 450],
      [400, 600],
      [50, 100],
      [0, 10],
      [1, 1],
    ] as const) {
      expect(same(starfieldPositions(count, radius), starfieldBefore(count, radius))).toBe(true);
      expect(same(starfieldPositions(count, radius, DEFAULT_STARFIELD_SEED), starfieldBefore(count, radius))).toBe(true);
    }
  });

  it("still gives these exact numbers (frozen before the change)", () => {
    const a = starfieldPositions(260, 450);
    expect(Array.from(a.slice(0, 6))).toEqual([262.4826354980469, -257.1387023925781, -259.7740783691406, -249.25978088378906, 21.906036376953125, 374.018310546875]);
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += (a[i] as number) * ((i % 7) + 1);
    expect(Math.abs(sum - 18422.015736341476)).toBeLessThan(0.01);
    expect(Array.from(starfieldPositions(400, 600).slice(0, 3))).toEqual([349.9768371582031, -342.8515930175781, -346.36541748046875]);
  });
});

describe("a pattern for each system", () => {
  it("keeps every dot on the sphere", () => {
    const a = starfieldPositions(260, 450, systemSkySeed(31337));
    for (let i = 0; i < 260; i++) {
      const r = Math.hypot(a[i * 3] as number, a[i * 3 + 1] as number, a[i * 3 + 2] as number);
      expect(Math.abs(r - 450)).toBeLessThan(0.01);
    }
  });

  it("the same system always gives the same dots", () => {
    for (const id of [0, 1, 777, 123456, 4.7e10]) {
      expect(systemSkySeed(id)).toBe(systemSkySeed(id));
      expect(same(starfieldPositions(260, 450, systemSkySeed(id)), starfieldPositions(260, 450, systemSkySeed(id)))).toBe(true);
    }
  });

  it("two systems give different dots (300 systems: all different, and none is the default pattern)", () => {
    const ids: number[] = [];
    for (let i = 1; i <= 250; i++) ids.push(i);
    for (let i = 0; i < 50; i++) ids.push(4_700_000_000 + i * 937_000_001 + i); // the big numbers of the real universe
    const keys = new Set<string>();
    const seeds = new Set<number>();
    const defaultKey = patternKey(starfieldPositions(260, 450));
    for (const id of ids) {
      keys.add(patternKey(starfieldPositions(260, 450, systemSkySeed(id))));
      seeds.add(systemSkySeed(id));
    }
    expect(keys.size).toBe(ids.length);
    expect(seeds.size).toBe(ids.length);
    expect(keys.has(defaultKey)).toBe(false);
  });

  it("two neighbouring system numbers do not share dots (almost no dot sits in the same place)", () => {
    const a = starfieldPositions(260, 450, systemSkySeed(1000));
    const b = starfieldPositions(260, 450, systemSkySeed(1001));
    let equalDots = 0;
    for (let i = 0; i < 260; i++) {
      if (Math.hypot((a[i * 3] as number) - (b[i * 3] as number), (a[i * 3 + 1] as number) - (b[i * 3 + 1] as number), (a[i * 3 + 2] as number) - (b[i * 3 + 2] as number)) < 20) equalDots++;
    }
    expect(equalDots).toBeLessThan(26); // a few by chance (260 dots on a sphere), never a copy
  });

  it("system numbers above 2^32 use their top half too, and a bad number is safe", () => {
    expect(systemSkySeed(4294967296 + 5) === systemSkySeed(5)).toBe(false);
    expect(systemSkySeed(2 * 4294967296 + 5) === systemSkySeed(4294967296 + 5)).toBe(false);
    for (const bad of [-1, Number.NaN, Infinity]) {
      const seed = systemSkySeed(bad);
      expect(Number.isInteger(seed) && seed >= 0 && seed < 4294967296).toBe(true);
    }
    for (const id of [0, 1, 4.7e10]) {
      const seed = systemSkySeed(id);
      expect(Number.isInteger(seed) && seed >= 0 && seed < 4294967296).toBe(true);
    }
  });
});

describe("the screens use a pattern per system", () => {
  const text = (path: string): string => readFileSync(path, "utf8");

  it("system view, docked, flight (a trip and floating) and the models page set the sky of their system", () => {
    expect(text("src/render/systemview.ts").includes("reseedBackdrop(this.backdrop, STARFIELD_COUNT, 450, system.id)")).toBe(true);
    expect(text("src/render/docked.ts").includes("reseedBackdrop(this.backdrop, STARFIELD_COUNT, 450, planet.systemId)")).toBe(true);
    const flight = text("src/render/flight.ts");
    expect(flight.includes("reseedBackdrop(this.backdrop, STARFIELD_COUNT, 450, planet.systemId)")).toBe(true); // floating
    expect(flight.includes("reseedBackdrop(this.backdrop, STARFIELD_COUNT, 450, parseDockId(info.destinationDockId)?.systemId ?? null)")).toBe(true); // a trip
    expect(text("src/models.ts").includes("makeBackdrop(400, 600, S.system)")).toBe(true);
  });

  it("no screen builds its own default dots any more (only the galaxy map keeps its plain backdrop until its sky is ready)", () => {
    for (const file of ["src/render/systemview.ts", "src/render/docked.ts", "src/render/flight.ts", "src/models.ts"]) {
      expect(`${file}: ${text(file).includes("starfieldPositions(")}`).toBe(`${file}: false`);
    }
  });
});
