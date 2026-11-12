// Agent 7f (E1): rare Earth-like planets, render only. Andy chose looks A (classic) and C (tropical), fewer clouds.
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { getPlanetsOfSystem, listSystemsNear, type Planet, type Seed } from "../src/universe";
import { EARTH_CHANCE, EARTH_PALETTES, EARTH_STYLES_IN_GAME, chooseLook, earthStyleOf, hasCloud, isEarthLike, surfaceColour } from "../src/render/planetlook";
import { RING_SEGMENTS, makePlanetMesh } from "../src/render/systemview";

const SEEDS: Seed[] = [12345, 777, 4242, 1, 99999, 31337, 2026, 55];
const planetsOf = (seed: Seed, radius = 30): Planet[] => listSystemsNear(seed, { x: 0, y: 0, z: 0 }, radius).flatMap((s) => getPlanetsOfSystem(seed, s.id));
const ALL = SEEDS.flatMap((s) => planetsOf(s));

describe("Earth-like planets: how many", () => {
  it("about 2 to 3 % of thousands of planets", () => {
    expect(ALL.length).toBeGreaterThan(4000);
    const share = ALL.filter((p) => chooseLook(p).earth).length / ALL.length;
    expect(share).toBeGreaterThanOrEqual(0.02);
    expect(share).toBeLessThanOrEqual(0.03);
  });

  it("only rocky, ocean and jungle planets (never gas giants, lava, ice, desert or barren)", () => {
    expect(Object.keys(EARTH_CHANCE).sort()).toEqual(["JUNGLE", "OCEAN", "ROCKY"]);
    for (const p of ALL) if (chooseLook(p).earth) expect(["ROCKY", "OCEAN", "JUNGLE"]).toContain(p.type);
  });

  it("the other looks keep their shares (rings 5-10 %, surprising colours about 1 in 3)", () => {
    const looks = ALL.map((p) => chooseLook(p));
    const rings = looks.filter((l) => l.rings).length / looks.length;
    const exotic = looks.filter((l) => l.exotic).length / looks.length;
    expect(rings).toBeGreaterThan(0.05);
    expect(rings).toBeLessThan(0.1);
    expect(Math.abs(exotic - 0.33)).toBeLessThan(0.03);
  });
});

describe("Earth-like planets: the look", () => {
  const earths = ALL.filter((p) => isEarthLike(p));

  it("same planet id, same look, every time", () => {
    for (const p of earths) expect(chooseLook({ ...p })).toEqual(chooseLook(p));
  });

  it("both of Andy's looks appear (A classic and C tropical), never B", () => {
    expect(EARTH_STYLES_IN_GAME).toEqual(["A", "C"]);
    const styles = earths.map((p) => chooseLook(p).earth);
    const a = styles.filter((s) => s === "A").length;
    const c = styles.filter((s) => s === "C").length;
    expect(a + c).toBe(earths.length);
    expect(a).toBeGreaterThan(earths.length * 0.3);
    expect(c).toBeGreaterThan(earths.length * 0.3);
    for (const p of earths) expect(chooseLook(p).earth).toBe(earthStyleOf(p));
  });

  it("no rings, no surprising colours, no craters, always clouds", () => {
    for (const p of earths) {
      const l = chooseLook(p);
      expect(l.rings).toBeNull();
      expect(l.exotic).toBe(false);
      expect(l.craters).toEqual([]);
      expect(l.clouds).toBe(true);
    }
  });

  it("blue sea, green land, some white cloud (reads as a little Earth)", () => {
    for (const p of earths.slice(0, 40)) {
      const l = chooseLook(p);
      const pal = EARTH_PALETTES[l.earth!];
      let sea = 0;
      let land = 0;
      let cloud = 0;
      const n = 400;
      for (let i = 0; i < n; i++) {
        // spread points over the sphere (golden spiral)
        const y = 1 - (2 * (i + 0.5)) / n;
        const r = Math.sqrt(1 - y * y);
        const a = i * 2.399963;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const c = surfaceColour(p.type, l, x, y, z);
        if (c === pal.sea || c === pal.shallow) sea++;
        if (c === pal.land || c === pal.high) land++;
        if (hasCloud(l, x, y, z)) cloud++;
      }
      expect(sea).toBeGreaterThan(n * 0.15);
      expect(land).toBeGreaterThan(n * 0.02);
      expect(cloud).toBeLessThan(n * 0.6); // Andy: fewer clouds
    }
  });
});

describe("Earth-like planets: drawing", () => {
  const toStar = new THREE.Vector3(1, 0.3, 0.4).normalize();
  const tris = (o: THREE.Object3D): number => {
    let t = 0;
    o.traverse((m) => {
      const g = (m as THREE.Mesh).geometry;
      if (g) t += (g.index ? g.index.count : g.getAttribute("position").count) / 3;
    });
    return t;
  };
  const earths = ALL.filter((p) => isEarthLike(p)).slice(0, 60);

  it("stay inside the 7c budget (planet + clouds; never rings)", () => {
    let worst = 0;
    for (const p of earths) worst = Math.max(worst, tris(makePlanetMesh(p, 1, toStar, 2)));
    expect(worst).toBeLessThanOrEqual(320 + 320 + 5 * 2 * RING_SEGMENTS);
    expect(worst).toBeLessThanOrEqual(180 + 180); // detail 2 planet + at most its cloud shell
  });

  it("docked views still switch clouds off under an outpost", () => {
    const m = makePlanetMesh(earths[0]!, 1, toStar, 2, { rings: false, clouds: false });
    expect(m.children).toHaveLength(0);
    const full = makePlanetMesh(earths[0]!, 1, toStar, 2);
    expect(full.children.some((c) => c.name === "clouds")).toBe(true);
    expect(full.children.some((c) => c.name === "rings")).toBe(false);
  });
});
