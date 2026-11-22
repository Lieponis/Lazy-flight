// Brief 3o, fix 1: an outpost's pad never stands on an ice cap, on any planet type (render only; the same planet always gives the same spot).
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { START_POINT, getPlanetsOfSystem, nearestSystems, type Planet, type Seed } from "../src/universe";
import { CAP_COLOUR, OUTPOST_MAX_LAT, chooseLook, coastSpot, isEarthLike, outpostSpot, surfaceColour, type Vec3Like } from "../src/render/planetlook";
import { makePlanetMesh } from "../src/render/systemview";

const SEEDS: Seed[] = [12345, 777, 4242, 1, 99999, 31337, 2026, 55];
const planetsOf = (seed: Seed, count = 150): Planet[] => nearestSystems(seed, START_POINT, count).flatMap(({ system }) => getPlanetsOfSystem(seed, system.id));
const ALL = SEEDS.flatMap((s) => planetsOf(s));

const isCap = (c: readonly number[]): boolean => c[0] === CAP_COLOUR[0] && c[1] === CAP_COLOUR[1] && c[2] === CAP_COLOUR[2];

/** Points on two rings (a half and a whole `radius`, in radians) around the unit vector d: enough to look over a patch of ground. */
function patch(d: Vec3Like, radius: number): Vec3Like[] {
  const out: Vec3Like[] = [];
  const t = Math.abs(d.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  let ux = t.y * d.z - t.z * d.y;
  let uy = t.z * d.x - t.x * d.z;
  let uz = t.x * d.y - t.y * d.x;
  const ul = Math.hypot(ux, uy, uz) || 1;
  ux /= ul;
  uy /= ul;
  uz /= ul;
  const wx = d.y * uz - d.z * uy;
  const wy = d.z * ux - d.x * uz;
  const wz = d.x * uy - d.y * ux;
  for (const a of [radius * 0.5, radius]) {
    for (let j = 0; j < 12; j++) {
      const k = (j * Math.PI) / 6;
      const c = Math.cos(a);
      const s = Math.sin(a);
      out.push({
        x: d.x * c + s * (ux * Math.cos(k) + wx * Math.sin(k)),
        y: d.y * c + s * (uy * Math.cos(k) + wy * Math.sin(k)),
        z: d.z * c + s * (uz * Math.cos(k) + wz * Math.sin(k)),
      });
    }
  }
  return out;
}

describe("the pad of an outpost never stands on an ice cap (any planet type)", () => {
  it("there are thousands of planets of every type to look at", () => {
    expect(ALL.length).toBeGreaterThan(4000);
    for (const type of ["ROCKY", "DESERT", "OCEAN", "ICE", "LAVA", "GAS", "JUNGLE", "BARREN"]) expect(ALL.filter((p) => p.type === type).length).toBeGreaterThan(50);
  });

  it("every planet gets a spot: a unit direction, mid latitude, and not an ice cap under it or around it", () => {
    let worstLat = 0;
    for (const p of ALL) {
      const look = chooseLook(p);
      const d = outpostSpot(p.type, look);
      expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 6);
      // Earth-likes may rarely use the older, wider coast band; everything else is inside the mid-latitude band.
      if (!look.earth) expect(Math.abs(d.y)).toBeLessThanOrEqual(OUTPOST_MAX_LAT + 1e-9);
      worstLat = Math.max(worstLat, Math.abs(d.y));
      expect(isCap(surfaceColour(p.type, look, d.x, d.y, d.z))).toBe(false);
      if (look.caps > 0) expect(Math.abs(d.y)).toBeLessThan(look.caps - 0.1);
    }
    expect(worstLat).toBeLessThan(0.78);
  });

  it("the whole patch of ground around the pad (about 17 degrees, 45 units on the docked ground) has no cap in it", () => {
    for (const p of ALL.slice(0, 2500)) {
      const look = chooseLook(p);
      const d = outpostSpot(p.type, look);
      if (look.earth && Math.abs(d.y) > OUTPOST_MAX_LAT) continue; // the rare wide coast
      for (const v of patch(d, 0.3)) expect(isCap(surfaceColour(p.type, look, v.x, v.y, v.z))).toBe(false);
    }
  });

  it("the same planet always gives the same spot, and different planets get different spots", () => {
    const some = ALL.slice(0, 300);
    for (const p of some) expect(outpostSpot(p.type, chooseLook(p))).toEqual(outpostSpot(p.type, chooseLook(p)));
    const keys = new Set(some.map((p) => {
      const d = outpostSpot(p.type, chooseLook(p));
      return `${d.x.toFixed(2)},${d.y.toFixed(2)},${d.z.toFixed(2)}`;
    }));
    expect(keys.size).toBeGreaterThan(150);
  });

  it("on planets with land and sea the pad stands on land (ocean worlds: the land colour; the rest: their own two ground colours)", () => {
    let ocean = 0;
    let onLand = 0;
    let plain = 0;
    let others = 0;
    for (const p of ALL) {
      const look = chooseLook(p);
      if (look.earth || p.type === "GAS") continue;
      const d = outpostSpot(p.type, look);
      const c = surfaceColour(p.type, look, d.x, d.y, d.z);
      if (p.type === "OCEAN") {
        ocean++;
        if (c === look.secondary) onLand++;
      } else {
        others++;
        if (c === look.primary || c === look.secondary) plain++;
      }
    }
    expect(onLand / ocean).toBeGreaterThan(0.95);
    expect(plain / others).toBeGreaterThan(0.99);
  });

  it("an Earth-like keeps its coast (land with sea close by), now inside the mid-latitude band whenever there is one", () => {
    const earths = ALL.filter((p) => isEarthLike(p));
    let inBand = 0;
    for (const p of earths) {
      const look = chooseLook(p);
      const d = outpostSpot(p.type, look);
      const coast = coastSpot(p.type, look);
      expect(coast === null).toBe(false);
      if (Math.abs(d.y) <= OUTPOST_MAX_LAT) inBand++;
    }
    expect(inBand / earths.length).toBeGreaterThan(0.9);
  });

  it("the outpost ground ball shows that spot at its top, not the pole (the icy planets too)", () => {
    const toStar = new THREE.Vector3(0.3, 1, 0.2).normalize();
    let checked = 0;
    for (const p of ALL.filter((q) => q.type === "ICE").slice(0, 25)) {
      const look = chooseLook(p);
      if (look.caps === 0) continue;
      const mesh = makePlanetMesh(p, 150, toStar, 12, { rings: false, clouds: false, outpostGround: true });
      const pos = mesh.geometry.getAttribute("position");
      const col = mesh.geometry.getAttribute("color");
      let best = -1;
      let bestY = -Infinity;
      for (let f = 0; f + 2 < pos.count; f += 3) {
        const y = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3;
        if (y > bestY) {
          bestY = y;
          best = f;
        }
      }
      // a cap face is bright white-blue in every channel; the face under the pad must not be one (compare with the same colour on a cap)
      const r = col.getX(best);
      const g = col.getY(best);
      const b = col.getZ(best);
      const capLinear = new THREE.Color().setRGB(CAP_COLOUR[0], CAP_COLOUR[1], CAP_COLOUR[2], THREE.SRGBColorSpace);
      const lit = Math.max(r, g, b);
      const isWhite = lit > 0 && r / lit > capLinear.r / Math.max(capLinear.r, capLinear.g, capLinear.b) - 0.02 && g / lit > capLinear.g / Math.max(capLinear.r, capLinear.g, capLinear.b) - 0.02 && b / lit > 0.99 && Math.min(r, g, b) / lit > 0.85;
      expect(isWhite).toBe(false);
      checked++;
    }
    expect(checked).toBeGreaterThan(5);
  });
});
