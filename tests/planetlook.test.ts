// Agent 7c: new planet looks (option B). Looks are chosen in the render layer from the planet id;
// src/universe output must stay exactly as it was (the Lead's hard rule), proven by the fingerprint test.
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  generateDock,
  getJobBoard,
  getMarket,
  getPlanetsOfSystem,
  listSystemsNear,
  type Planet,
  type PlanetType,
  type Seed,
} from "../src/universe";
import { EXOTIC_CHANCE, RING_CHANCE, RING_COLOURS, chooseLook, fbm3, hashString, noise3, surfaceColour } from "../src/render/planetlook";
import { RING_SEGMENTS, makePlanetMesh } from "../src/render/systemview";

const TYPES: PlanetType[] = ["ROCKY", "DESERT", "OCEAN", "ICE", "LAVA", "GAS", "JUNGLE", "BARREN"];

function planetsOf(seed: Seed, radius = 35): Planet[] {
  return listSystemsNear(seed, { x: 0, y: 0, z: 0 }, radius).flatMap((s) => getPlanetsOfSystem(seed, s.id));
}

/** One number that changes if anything the universe produces changes (systems, planets, docks, markets, job boards). */
function universeFingerprint(seed: Seed): string {
  const parts: string[] = [];
  for (const s of listSystemsNear(seed, { x: 0, y: 0, z: 0 }, 12)) {
    parts.push(JSON.stringify(s));
    for (const p of getPlanetsOfSystem(seed, s.id)) {
      parts.push(JSON.stringify(p));
      const dock = generateDock(seed, p);
      parts.push(JSON.stringify(dock));
      parts.push(JSON.stringify(getMarket(seed, dock, 3)));
      parts.push(JSON.stringify(getJobBoard(seed, dock.id, 3)));
    }
  }
  const text = parts.join("|");
  return `${hashString(text).toString(16)}:${text.length}`;
}

describe("src/universe output is unchanged (Lead's hard rule)", () => {
  // Recorded on main before Agent 7c's work (commit c404404). If this fails, the universe changed: saves would break.
  const RECORDED: Record<string, string> = { "12345": "543ab6f8:148823", "777": "5872a645:196801", "4242": "b4648b38:61798" };
  for (const seed of [12345, 777, 4242]) {
    it(`seed ${seed}: same systems, planets, docks, markets and jobs`, () => {
      expect(universeFingerprint(seed)).toBe(RECORDED[String(seed)]);
    });
  }
});

describe("a planet's look", () => {
  const planets = planetsOf(12345);

  it("same planet id gives the same look, every time", () => {
    for (const p of planets.slice(0, 50)) expect(chooseLook({ ...p })).toEqual(chooseLook(p));
  });

  it("looks are spread: about 8 % rings, about 1 in 3 surprising colours, over many seeds", () => {
    const all = [12345, 777, 4242, 1, 99999].flatMap((s) => planetsOf(s, 25));
    expect(all.length).toBeGreaterThan(1000);
    const looks = all.map((p) => chooseLook(p));
    const rings = looks.filter((l) => l.rings).length / looks.length;
    const exotic = looks.filter((l) => l.exotic).length / looks.length;
    expect(rings).toBeGreaterThan(0.05); // Andy: 5 to 10 %
    expect(rings).toBeLessThan(0.1);
    expect(Math.abs(exotic - EXOTIC_CHANCE)).toBeLessThan(0.05);
    expect(RING_CHANCE).toBeGreaterThanOrEqual(0.05);
    // every type gets rings somewhere (random which planets, Andy)
    const ringedTypes = new Set(all.filter((_p, i) => looks[i]!.rings).map((p) => p.type));
    expect(ringedTypes.size).toBeGreaterThanOrEqual(6);
  });

  it("rings: 2 to 5 bands, outward, different widths, rock colours", () => {
    const ringed = planetsOf(12345).map((p) => chooseLook(p)).filter((l) => l.rings);
    const widths = new Set<number>();
    for (const l of ringed) {
      const bands = l.rings!;
      expect(bands.length).toBeGreaterThanOrEqual(2);
      expect(bands.length).toBeLessThanOrEqual(5);
      expect(bands[0]!.inner).toBeGreaterThanOrEqual(1.25);
      for (let i = 0; i < bands.length; i++) {
        expect(bands[i]!.outer).toBeGreaterThan(bands[i]!.inner);
        if (i > 0) expect(bands[i]!.inner).toBeGreaterThanOrEqual(bands[i - 1]!.outer - 1e-9);
        expect(RING_COLOURS).toContainEqual(bands[i]!.colour);
      }
      widths.add(Math.round((bands[bands.length - 1]!.outer - bands[0]!.inner) * 10));
    }
    expect(widths.size).toBeGreaterThan(4); // a variety of widths
  });

  it("colours stay valid (0..1) for every type and both colour sets", () => {
    for (const p of planets.slice(0, 300)) {
      const look = chooseLook(p);
      for (const [x, y, z] of [[0, 1, 0], [1, 0, 0], [0, 0, -1], [0.6, -0.8, 0]] as const) {
        for (const v of surfaceColour(p.type, look, x, y, z)) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("noise is smooth and repeatable", () => {
    expect(noise3(0.3, 0.7, 1.1, 5)).toBe(noise3(0.3, 0.7, 1.1, 5));
    expect(Math.abs(fbm3(0.5, 0.5, 0.5, 9) - fbm3(0.501, 0.5, 0.5, 9))).toBeLessThan(0.01);
    for (let i = 0; i < 100; i++) {
      const v = fbm3(i * 0.37, i * 0.11, i * 0.73, 3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("drawing (phone budget)", () => {
  const toStar = new THREE.Vector3(1, 0.3, 0.4).normalize();
  const tris = (o: THREE.Object3D): number => {
    let n = 0;
    o.traverse((m) => {
      const g = (m as THREE.Mesh).geometry;
      if (g) n += (g.index ? g.index.count : g.getAttribute("position").count) / 3;
    });
    return n;
  };

  it("every planet type still draws, with colours", () => {
    const planets = planetsOf(12345);
    for (const type of TYPES) {
      const p = planets.find((x) => x.type === type);
      expect(p, type).toBeDefined();
      const mesh = makePlanetMesh(p!, 1, toStar, type === "GAS" ? 3 : 2);
      expect(mesh.geometry.getAttribute("color").count).toBe(mesh.geometry.getAttribute("position").count);
    }
  });

  it("a planet with everything (clouds + 5 ring bands) stays small", () => {
    const planets = planetsOf(12345);
    let worst = 0;
    for (const p of planets.slice(0, 400)) worst = Math.max(worst, tris(makePlanetMesh(p, 1, toStar, p.type === "GAS" ? 3 : 2)));
    // planet 320 + clouds up to 320 + 5 bands x 2 x RING_SEGMENTS
    expect(worst).toBeLessThanOrEqual(320 + 320 + 5 * 2 * RING_SEGMENTS);
  });

  it("docked views can switch rings and clouds off (they would cut through the dock)", () => {
    const p = planetsOf(12345).find((x) => chooseLook(x).rings && chooseLook(x).clouds) ?? planetsOf(12345).find((x) => chooseLook(x).rings)!;
    const plain = makePlanetMesh(p, 1, toStar, 2, { rings: false, clouds: false });
    expect(plain.children).toHaveLength(0);
    const full = makePlanetMesh(p, 1, toStar, 2);
    expect(full.children.some((c) => c.name === "rings")).toBe(true);
  });
});
