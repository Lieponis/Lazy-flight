import { describe, expect, it } from "vitest";
import { hash32, mulberry, unit, valueNoise } from "../src/render/galaxy/hash";
import {
  GALAXY_RADIUS_LY,
  START_RADIUS_LY,
  TELEPORTS,
  describePlace,
  lookDirection,
  pointAt,
  spacingAtRadius,
  standInField,
  type FieldSample,
} from "../src/render/galaxy/galaxyfield";
import {
  SkyBuilder,
  buildSky,
  directionToFace,
  exitDistance,
  faceDirection,
  nearRadiusFor,
  texelSolidAngle,
  type SkyParams,
  type Vec3,
} from "../src/render/galaxy/skycube";
import { SKY_LOOKS, levelOf, quantise, skyToTexels } from "../src/render/galaxy/skylook";
import { makeFaintStars, removeNearOverlaps } from "../src/render/galaxy/skystars";
import { SKY_CELL_MAX_LY, SKY_CELL_MIN_LY, needsNewSky, skyCellLevel, skyCellOf } from "../src/render/galaxy/skycell";
import { DENSITY_SPACINGS, countWithin, directionsOf, makeNearStars } from "../src/render/galaxy/neardata";
import {
  DEFAULT_PARAMS,
  diamondSize,
  lyText,
  orbitAnglesFor,
  parsePreviewParams,
  pixelBrightness,
} from "../src/render/galaxy/previewmath";
import { orbitCameraPosition } from "../src/render/helpers";

const SMALL: SkyParams = { faceSize: 16, steps: 24, nearRadius: 100 };

function mean(raw: Float32Array): number {
  let s = 0;
  for (let i = 0; i < raw.length; i++) s += raw[i] ?? 0;
  return s / raw.length;
}

describe("galaxy prototype: repeatable numbers", () => {
  it("hash32 and valueNoise give the same answer every time, and noise stays between 0 and 1", () => {
    expect(hash32(1, 2, 3)).toBe(hash32(1, 2, 3));
    expect(hash32(1, 2, 3)).not.toBe(hash32(1, 2, 4));
    for (let i = 0; i < 200; i++) {
      const v = valueNoise(i * 0.37, i * 0.11 - 5, i * 0.07, 3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBe(valueNoise(i * 0.37, i * 0.11 - 5, i * 0.07, 3));
    }
    expect(unit(hash32(9, 9, 9))).toBeLessThan(1);
    const a = mulberry(5);
    const b = mulberry(5);
    expect(a()).toBe(b());
  });
});

describe("galaxy prototype: the stand-in galaxy", () => {
  it("spacing is 2 ly at the centre, 160 ly at the rim, and about 8.6 ly at the start (one third out)", () => {
    expect(spacingAtRadius(0)).toBeCloseTo(2, 5);
    expect(spacingAtRadius(GALAXY_RADIUS_LY)).toBeCloseTo(160, 3);
    expect(spacingAtRadius(START_RADIUS_LY)).toBeGreaterThan(8.3);
    expect(spacingAtRadius(START_RADIUS_LY)).toBeLessThan(8.9);
  });
  it("the field is the same every time and never negative", () => {
    const a: FieldSample = { old: 0, young: 0, dust: 0 };
    const b: FieldSample = { old: 0, young: 0, dust: 0 };
    for (let i = 0; i < 300; i++) {
      const x = ((i * 7919) % 100000) - 50000;
      const y = ((i * 104729) % 6000) - 3000;
      const z = ((i * 1299709) % 100000) - 50000;
      standInField.sample(x, y, z, a);
      standInField.sample(x, y, z, b);
      expect(a).toEqual(b);
      expect(a.old).toBeGreaterThanOrEqual(0);
      expect(a.young).toBeGreaterThanOrEqual(0);
      expect(a.dust).toBeGreaterThanOrEqual(0);
    }
  });
  it("the disc is thin: far above the plane only the bulge is left, and nothing at all far outside the rim", () => {
    const s: FieldSample = { old: 0, young: 0, dust: 0 };
    standInField.sample(20000, 4000, 0, s);
    expect(s.young).toBe(0);
    expect(s.dust).toBe(0);
    standInField.sample(90000, 0, 0, s);
    expect(s.old).toBeLessThan(1e-9);
  });
  it("the four teleport places sit where they say", () => {
    const byId = Object.fromEntries(TELEPORTS.map((t) => [t.id, describePlace(t.position)]));
    expect(byId.centre?.radius).toBeLessThan(1000);
    expect(byId.start?.radius).toBeCloseTo(START_RADIUS_LY, 0);
    expect(byId.middle?.radius ?? 0).toBeGreaterThan(START_RADIUS_LY);
    expect(byId.rim?.radius ?? 0).toBeGreaterThan(GALAXY_RADIUS_LY * 0.9);
    expect(byId.rim?.radius ?? 0).toBeLessThan(GALAXY_RADIUS_LY);
    expect(pointAt(10, 0).x).toBeCloseTo(10, 6);
  });
  it("look directions: toward the centre points inward, toward the rim outward, up is up", () => {
    const p = pointAt(20000, 1.1);
    const c = lookDirection("centre", p);
    const r = lookDirection("rim", p);
    expect(c.x * p.x + c.z * p.z).toBeLessThan(0);
    expect(r.x * p.x + r.z * p.z).toBeGreaterThan(0);
    expect(lookDirection("up", p)).toEqual({ x: 0, y: 1, z: 0 });
    // Standing at the very centre the buttons still give two different directions.
    expect(lookDirection("centre", { x: 0, y: 0, z: 0 })).not.toEqual(lookDirection("rim", { x: 0, y: 0, z: 0 }));
  });
});

describe("galaxy prototype: the sky cube", () => {
  it("faceDirection and directionToFace undo each other on every face", () => {
    const d: Vec3 = { x: 0, y: 0, z: 0 };
    for (let face = 0; face < 6; face++) {
      for (const u of [-0.9, -0.3, 0, 0.5, 0.95]) {
        for (const v of [-0.8, -0.1, 0.2, 0.9]) {
          faceDirection(face, u, v, d);
          const back = directionToFace(d.x, d.y, d.z);
          expect(back.face).toBe(face);
          expect(back.u).toBeCloseTo(u, 9);
          expect(back.v).toBeCloseTo(v, 9);
        }
      }
    }
  });
  it("the texels together cover the whole sky (4 pi steradians)", () => {
    const n = 32;
    let total = 0;
    for (let face = 0; face < 6; face++) {
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) total += texelSolidAngle(n, ((i + 0.5) / n) * 2 - 1, ((j + 0.5) / n) * 2 - 1);
      }
    }
    expect(total / (4 * Math.PI)).toBeGreaterThan(0.99);
    expect(total / (4 * Math.PI)).toBeLessThan(1.01);
  });
  it("a ray leaves the galaxy box through the top or the side, never at zero when inside", () => {
    const p = { x: 1000, y: 0, z: 0 };
    expect(exitDistance(p, 0, 1, 0)).toBeCloseTo(4500, 3);
    expect(exitDistance(p, 1, 0, 0)).toBeGreaterThan(50000);
    expect(exitDistance({ x: 1e6, y: 0, z: 0 }, 1, 0, 0)).toBe(0);
  });
  it("the same place gives the same sky, and building in small chunks gives exactly the same sky as all at once", () => {
    const p = TELEPORTS[1]!.position;
    const whole = buildSky(standInField, p, SMALL).raw;
    const again = buildSky(standInField, p, SMALL).raw;
    expect(Array.from(again)).toEqual(Array.from(whole));
    const builder = new SkyBuilder(standInField, p, SMALL);
    let t = 0;
    let calls = 0;
    while (!builder.run(0.001, () => (t += 1))) calls++;
    expect(calls).toBeGreaterThan(5);
    expect(builder.progress).toBe(1);
    expect(Array.from(builder.raw)).toEqual(Array.from(whole));
  });
  it("different places give different skies", () => {
    const a = buildSky(standInField, TELEPORTS[0]!.position, SMALL).raw;
    const b = buildSky(standInField, TELEPORTS[1]!.position, SMALL).raw;
    const c = buildSky(standInField, TELEPORTS[3]!.position, SMALL).raw;
    expect(Array.from(a)).not.toEqual(Array.from(b));
    // The centre sky is much brighter than the rim sky (the same exposure is used everywhere).
    expect(mean(a)).toBeGreaterThan(mean(b) * 5);
    expect(mean(b)).toBeGreaterThan(mean(c));
  });
  it("from the start place the galaxy centre is brighter than the direction away from it, and than straight up", () => {
    const p = TELEPORTS[1]!.position;
    const { raw } = buildSky(standInField, p, { faceSize: 16, steps: 40, nearRadius: 200 });
    const lightToward = (dir: Vec3): number => {
      const f = directionToFace(dir.x, dir.y, dir.z);
      const i = Math.min(15, Math.floor((f.u * 0.5 + 0.5) * 16));
      const j = Math.min(15, Math.floor((f.v * 0.5 + 0.5) * 16));
      const t = ((f.face * 16 + j) * 16 + i) * 3;
      return 0.3 * (raw[t] ?? 0) + 0.59 * (raw[t + 1] ?? 0) + 0.11 * (raw[t + 2] ?? 0);
    };
    const toCentre = lookDirection("centre", p);
    const toRim = lookDirection("rim", p);
    expect(lightToward(toCentre)).toBeGreaterThan(lightToward(toRim) * 3);
    expect(lightToward(toCentre)).toBeGreaterThan(lightToward({ x: 0, y: 1, z: 0 }) * 3);
  });
  it("near radius: the nearest 10,000 systems at 8.6 ly spacing lie within about 115 ly (Andy's decision)", () => {
    expect(nearRadiusFor(8.6, 10000)).toBeGreaterThan(110);
    expect(nearRadiusFor(8.6, 10000)).toBeLessThan(120);
  });
});

describe("galaxy prototype: how the sky looks", () => {
  const raw = new Float32Array([1e-9, 1e-9, 1e-9, 0.01, 0.01, 0.01, 1, 0.8, 0.5, 1e4, 1e4, 1e4]);
  it("brighter light gets a higher level, between 0 and 1", () => {
    const look = SKY_LOOKS.A;
    const levels = [0, 1, 2, 3].map((t) => levelOf(raw[t * 3]!, raw[t * 3 + 1]!, raw[t * 3 + 2]!, look));
    for (let i = 1; i < levels.length; i++) expect(levels[i]!).toBeGreaterThanOrEqual(levels[i - 1]!);
    expect(levels[0]).toBe(0);
    expect(levels[3]).toBe(1);
  });
  it("texels keep the tint (strongest colour 255) and the level in the alpha byte", () => {
    const t = skyToTexels(raw, SKY_LOOKS.A);
    expect(t.length).toBe(16);
    for (let i = 0; i < 4; i++) expect(Math.max(t[i * 4]!, t[i * 4 + 1]!, t[i * 4 + 2]!)).toBe(255);
    // Warm light (more red than blue) stays warm.
    expect(t[2 * 4]!).toBeGreaterThan(t[2 * 4 + 2]!);
    expect(t[3 * 4 + 3]).toBe(255);
  });
  it("brightness steps: smooth looks keep the level, banded looks round to a step, dotted looks mix steps by screen position", () => {
    expect(quantise(0.43, SKY_LOOKS.A, 3, 3)).toBeCloseTo(0.43, 9);
    const b = quantise(0.43, SKY_LOOKS.B, 3, 3);
    expect(b * SKY_LOOKS.B.steps).toBeCloseTo(Math.round(b * SKY_LOOKS.B.steps), 9);
    // Over a 4x4 block the dotted look averages out to about the true level.
    let total = 0;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) total += quantise(0.43, SKY_LOOKS.C, x, y);
    expect(total / 16).toBeGreaterThan(0.43 - 1 / SKY_LOOKS.C.steps / 2);
    expect(total / 16).toBeLessThan(0.43 + 1 / SKY_LOOKS.C.steps / 2);
    expect(new Set([0, 1, 2, 3].map((x) => quantise(0.5, SKY_LOOKS.C, x, 0))).size).toBeGreaterThan(1);
  });
});

describe("galaxy prototype: faint sky stars", () => {
  const p = TELEPORTS[1]!.position;
  const { raw } = buildSky(standInField, p, { faceSize: 16, steps: 24, nearRadius: 200 });
  const look = SKY_LOOKS.A;
  it("same sky cell and seed = the same stars; another seed = other stars", () => {
    const a = makeFaintStars(raw, 16, look, 3000, 77);
    const b = makeFaintStars(raw, 16, look, 3000, 77);
    const c = makeFaintStars(raw, 16, look, 3000, 78);
    expect(Array.from(a.dirs)).toEqual(Array.from(b.dirs));
    expect(Array.from(c.dirs)).not.toEqual(Array.from(a.dirs));
  });
  it("makes about the number asked for, as unit directions with colours between 0 and 1", () => {
    const s = makeFaintStars(raw, 16, look, 3000, 5);
    expect(s.count).toBeGreaterThan(2000);
    expect(s.count).toBeLessThan(4000);
    for (let i = 0; i < s.count; i += 37) {
      expect(Math.hypot(s.dirs[i * 3]!, s.dirs[i * 3 + 1]!, s.dirs[i * 3 + 2]!)).toBeCloseTo(1, 4);
      for (let k = 0; k < 3; k++) {
        expect(s.colors[i * 3 + k]!).toBeGreaterThanOrEqual(0);
        expect(s.colors[i * 3 + k]!).toBeLessThanOrEqual(1);
      }
    }
  });
  it("there are more stars where the sky glows (toward the galaxy centre, near the band) than far from the band", () => {
    const s = makeFaintStars(raw, 16, look, 6000, 9);
    const toCentre = lookDirection("centre", p);
    let near = 0;
    let far = 0;
    for (let i = 0; i < s.count; i++) {
      const dot = s.dirs[i * 3]! * toCentre.x + s.dirs[i * 3 + 1]! * toCentre.y + s.dirs[i * 3 + 2]! * toCentre.z;
      if (dot > 0.9) near++;
      else if (dot < -0.9) far++;
    }
    expect(near).toBeGreaterThan(far);
  });
  it("a fake star that sits in the same small patch of sky as a real star is removed", () => {
    const s = makeFaintStars(raw, 16, look, 3000, 5);
    const first = [s.dirs[0]!, s.dirs[1]!, s.dirs[2]!];
    const kept = removeNearOverlaps(s, Float32Array.from(first), 0.35);
    expect(kept.count).toBeLessThan(s.count);
    expect(kept.count).toBeGreaterThan(s.count - 20);
    // No real stars: nothing removed.
    expect(removeNearOverlaps(s, new Float32Array(0), 0.35).count).toBe(s.count);
  });
});

describe("galaxy prototype: sky cells (when to build a new sky)", () => {
  it("cells are small near the centre and big far out, between the limits", () => {
    expect(skyCellLevel(100)).toBe(0);
    expect(skyCellLevel(16667)).toBeGreaterThan(skyCellLevel(1000));
    expect(skyCellLevel(48000)).toBeGreaterThanOrEqual(skyCellLevel(16667));
    for (const r of [0, 500, 5000, 20000, 50000, 90000]) {
      const size = skyCellOf(pointAt(r, 0.4)).size;
      expect(size).toBeGreaterThanOrEqual(SKY_CELL_MIN_LY);
      expect(size).toBeLessThanOrEqual(SKY_CELL_MAX_LY);
    }
  });
  it("two places in the same cell share one key and one sky centre; a far place does not", () => {
    const a = TELEPORTS[1]!.position;
    const cell = skyCellOf(a);
    const near = { x: cell.centre.x + 1, y: cell.centre.y, z: cell.centre.z - 1 };
    expect(skyCellOf(near).key).toBe(cell.key);
    expect(skyCellOf(near).centre).toEqual(cell.centre);
    expect(Math.abs(cell.centre.x - a.x)).toBeLessThanOrEqual(cell.size);
    expect(needsNewSky(cell.key, near)).toBe(false);
    expect(needsNewSky(cell.key, TELEPORTS[3]!.position)).toBe(true);
    expect(needsNewSky(null, a)).toBe(true);
  });
  it("a short trip (80 ly) at the start rarely leaves the cell, and a trip across the galaxy always does", () => {
    const a = TELEPORTS[1]!.position;
    expect(skyCellOf(a).size).toBeGreaterThan(300);
    expect(skyCellOf(TELEPORTS[0]!.position).key).not.toBe(skyCellOf(a).key);
  });
});

describe("galaxy prototype: stand-in near stars", () => {
  it("makes the stars asked for, nearest first, inside the radius, the same every time", () => {
    const s = makeNearStars(5000, 8.6, 42);
    const t = makeNearStars(5000, 8.6, 42);
    expect(s.count).toBe(5000);
    expect(Array.from(s.positions.slice(0, 60))).toEqual(Array.from(t.positions.slice(0, 60)));
    for (let i = 1; i < s.count; i++) expect(s.distances[i]!).toBeGreaterThanOrEqual(s.distances[i - 1]!);
    expect(s.radius).toBeLessThanOrEqual(nearRadiusFor(8.6, 5000) + 1e-3);
    expect(Math.hypot(s.positions[300]!, s.positions[301]!, s.positions[302]!)).toBeCloseTo(s.distances[100]!, 3);
    expect(s.ids[7]).toBe(7);
  });
  it("matches Andy's numbers: about 2,800 systems within 75 ly at 8.6 ly spacing, about 87,000 within 55 ly at 2 ly", () => {
    const start = makeNearStars(60000, 8.6, 1);
    const within75 = countWithin(start, 75);
    expect(within75).toBeGreaterThan(2500);
    expect(within75).toBeLessThan(3100);
    // At 2 ly spacing 60,000 stars only reach about 49 ly: the whole near list is inside a 55 ly reach.
    const centre = makeNearStars(60000, 2, 1);
    expect(countWithin(centre, 55)).toBe(60000);
    expect(DENSITY_SPACINGS).toEqual([2, 8.6, 30]);
  });
  it("countWithin agrees with counting one by one", () => {
    const s = makeNearStars(3000, 8.6, 3);
    for (const reach of [0, 10, 33.3, 55, 80, 1000]) {
      let n = 0;
      for (let i = 0; i < s.count; i++) if (s.distances[i]! <= reach) n++;
      expect(countWithin(s, reach)).toBe(n);
    }
  });
  it("star colours come from the game's list and the directions are unit length", () => {
    const s = makeNearStars(500, 8.6, 9);
    const d = directionsOf(s, 100);
    expect(d.length).toBe(300);
    for (let i = 0; i < 100; i++) expect(Math.hypot(d[i * 3]!, d[i * 3 + 1]!, d[i * 3 + 2]!)).toBeCloseTo(1, 4);
    expect(directionsOf(s, 9999).length).toBe(1500);
    for (let i = 0; i < s.colors.length; i++) {
      expect(s.colors[i]!).toBeGreaterThanOrEqual(0);
      expect(s.colors[i]!).toBeLessThanOrEqual(1);
    }
  });
});

describe("galaxy prototype: preview page helpers", () => {
  it("orbitAnglesFor makes the orbit camera look along the direction asked", () => {
    for (const dir of [
      { x: 1, y: 0, z: 0 },
      { x: -0.6, y: 0.2, z: 0.77 },
      { x: 0, y: -0.5, z: -0.86 },
      { x: 0.3, y: 0.9, z: 0.3 },
    ]) {
      const len = Math.hypot(dir.x, dir.y, dir.z);
      const a = orbitAnglesFor(dir);
      const offset = orbitCameraPosition(a.yaw, a.pitch, 1);
      // The camera sits at `offset` and looks at the middle, so it looks along -offset.
      expect(-offset.x).toBeCloseTo(dir.x / len, 6);
      expect(-offset.y).toBeCloseTo(dir.y / len, 6);
      expect(-offset.z).toBeCloseTo(dir.z / len, 6);
    }
  });
  it("reads settings from the address, ignores wrong values, and has sane defaults", () => {
    expect(parsePreviewParams("")).toEqual(DEFAULT_PARAMS);
    const p = parsePreviewParams("?place=rim&look=up&sky=C&face=128&density=30&reach=80&tap=20000&diamonds=10000&glow=0&dots=off&pixels=1&dia=0");
    expect(p).toMatchObject({ place: "rim", look: "up", sky: "C", face: 128, density: 30, reach: 80, tap: 20000, diamonds: 10000, glow: false, dots: false, pixels: true, diamondsOn: false });
    const bad = parsePreviewParams("?place=moon&look=sideways&sky=Z&face=7&density=5&reach=999&tap=3");
    expect(bad).toEqual(DEFAULT_PARAMS);
    expect(parsePreviewParams("?density=auto").density).toBe("auto");
  });
  it("text and sizes", () => {
    expect(lyText(16667)).toBe("16,667 ly");
    expect(diamondSize(3)).toBeLessThan(0.55 + 0.9);
    expect(diamondSize(0.1)).toBeGreaterThan(0);
  });
  it("pixel stars: the closer the brighter, never black, full brightness at the player", () => {
    expect(pixelBrightness(0, 100)).toBe(1);
    expect(pixelBrightness(50, 100)).toBeLessThan(pixelBrightness(10, 100));
    expect(pixelBrightness(100, 100)).toBeGreaterThan(0.1);
    expect(pixelBrightness(500, 100)).toBeCloseTo(pixelBrightness(100, 100), 9);
  });
});
