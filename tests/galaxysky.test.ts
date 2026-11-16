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
  standInProposal,
  type FieldSample,
} from "../src/render/galaxy/galaxyfield";
import { SkyBuilder, buildSky, exitDistance, layoutFor, nearRadiusFor, type SkyParams, type Vec3 } from "../src/render/galaxy/skyglow";
import {
  directionToRingTexel,
  ringCountsData,
  ringLayout,
  ringsForTexels,
  ringsToRows,
  ringTexelDirection,
  ringTexelSolidAngle,
  sampleRings,
} from "../src/render/galaxy/skysphere";
import { DEFAULT_DOTS, DotsBuilder, buildDots } from "../src/render/galaxy/skydots";
import { GLOW_CURVE, GLOW_LEVELS, SKY_LOOKS, levelOf, shadeGlow, skyToTexels, SPACE_RGB } from "../src/render/galaxy/skylook";
import { removeNearOverlaps } from "../src/render/galaxy/skystars";
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

describe("galaxy prototype: the sky's squares on a sphere (equal-area rings)", () => {
  it("the squares together cover the whole sky (4 pi steradians), and all have about the same size", () => {
    const L = ringLayout(60, true);
    let total = 0;
    let smallest = Infinity;
    let biggest = 0;
    for (let r = 0; r < L.rings; r++) {
      const a = ringTexelSolidAngle(L, r);
      total += a * (L.counts[r] ?? 0);
      smallest = Math.min(smallest, a);
      biggest = Math.max(biggest, a);
    }
    expect(total / (4 * Math.PI)).toBeCloseTo(1, 6);
    // A sky cube has squares about 5 times smaller in the corners than in the middle of a face; the rings stay within about 2 times.
    expect(biggest / smallest).toBeLessThan(2.2);
  });
  it("ring counts are fewer near the poles; a size 'faceSize' has about 6 x faceSize x faceSize squares", () => {
    const L = layoutFor(64);
    expect(L.counts[0]!).toBeLessThan(L.counts[Math.floor(L.rings / 2)]! / 4);
    expect(L.total).toBeGreaterThan(6 * 64 * 64 * 0.98);
    expect(L.total).toBeLessThan(6 * 64 * 64 * 1.02);
    expect(ringLayout(ringsForTexels(10000, true), true).total).toBeGreaterThanOrEqual(10000);
    expect(layoutFor(64)).toBe(layoutFor(64));
  });
  it("a square's middle direction maps back to the same square, and directions are unit length", () => {
    const L = ringLayout(40, true);
    const d: Vec3 = { x: 0, y: 0, z: 0 };
    for (let r = 0; r < L.rings; r++) {
      for (let i = 0; i < (L.counts[r] ?? 0); i += 3) {
        ringTexelDirection(L, r, i, d);
        expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 9);
        expect(directionToRingTexel(L, d.x, d.y, d.z)).toBe((L.offsets[r] ?? 0) + i);
      }
    }
  });
  it("the smooth look-up gives a square's own value in its middle and mixes neighbours between squares", () => {
    const L = ringLayout(40, true);
    const flat = new Uint8Array(L.total * 4);
    for (let t = 0; t < L.total; t++) flat[t * 4] = flat[t * 4 + 3] = (t * 37) % 256;
    const d: Vec3 = { x: 0, y: 0, z: 0 };
    const out = [0, 0, 0, 0];
    ringTexelDirection(L, 17, 9, d);
    sampleRings(L, flat, d.x, d.y, d.z, out);
    expect(out[0]).toBeCloseTo(flat[((L.offsets[17] ?? 0) + 9) * 4]!, 3);
    // Halfway between two squares of a ring: the average of the squares around.
    const n = L.counts[17] ?? 1;
    const lat = -Math.PI / 2 + (17 + 0.5) * (Math.PI / L.rings);
    const lon = (10 / n) * 2 * Math.PI; // the edge between squares 9 and 10
    sampleRings(L, flat, Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon), out);
    const a = flat[((L.offsets[17] ?? 0) + 9) * 4]!;
    const b = flat[((L.offsets[17] ?? 0) + 10) * 4]!;
    expect(out[0]).toBeCloseTo((a + b) / 2, 3);
    // The ring wraps around: just before longitude 0 mixes the last and the first square.
    sampleRings(L, flat, Math.cos(lat), Math.sin(lat), 0, out);
    const last = flat[((L.offsets[17] ?? 0) + n - 1) * 4]!;
    const first = flat[(L.offsets[17] ?? 0) * 4]!;
    expect(out[0]).toBeCloseTo((last + first) / 2, 3);
  });
  it("the texture rows and the ring-count texture hold what the shader needs", () => {
    const L = ringLayout(30, true);
    const flat = new Uint8Array(L.total * 4).map((_, i) => (i * 7) % 251);
    const rows = ringsToRows(flat, L);
    expect(rows.length).toBe(L.maxCount * L.rings * 4);
    const r = 12;
    for (let i = 0; i < (L.counts[r] ?? 0); i += 5) {
      for (let k = 0; k < 4; k++) expect(rows[(r * L.maxCount + i) * 4 + k]).toBe(flat[((L.offsets[r] ?? 0) + i) * 4 + k]);
    }
    const counts = ringCountsData(L);
    for (let q = 0; q < L.rings; q++) expect(counts[q * 4]! + 256 * counts[q * 4 + 1]!).toBe(L.counts[q]);
  });
});

describe("galaxy prototype: the sky glow from where you are", () => {
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
    const { raw, layout } = buildSky(standInField, p, { faceSize: 16, steps: 40, nearRadius: 200 });
    const lightToward = (dir: Vec3): number => {
      const t = directionToRingTexel(layout, dir.x, dir.y, dir.z) * 3;
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
  it("there is no dust near the galaxy centre (Andy's request), and there is dust in the disc farther out", () => {
    const s: FieldSample = { old: 0, young: 0, dust: 0 };
    let nearCentre = 0;
    let farOut = 0;
    for (let i = 0; i < 400; i++) {
      const a = i * 0.7;
      standInField.sample(1400 * Math.cos(a), (i % 9) * 20 - 80, 1400 * Math.sin(a), s);
      nearCentre = Math.max(nearCentre, s.dust);
      standInField.sample(1000 * Math.cos(a), (i % 9) * 10 - 40, 1000 * Math.sin(a), s);
      nearCentre = Math.max(nearCentre, s.dust);
      standInField.sample(14000 * Math.cos(a), (i % 9) * 20 - 80, 14000 * Math.sin(a), s);
      farOut = Math.max(farOut, s.dust);
    }
    expect(nearCentre).toBe(0);
    expect(farOut).toBeGreaterThan(1e-4);
  });
  it("the dust lane is patchy: along the disc plane the dust varies a lot from place to place", () => {
    const s: FieldSample = { old: 0, young: 0, dust: 0 };
    const values: number[] = [];
    for (let i = 0; i < 300; i++) {
      standInField.sample(10000 + i * 90, 0, 6000 + i * 40, s);
      values.push(s.dust);
    }
    const m = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length);
    expect(m).toBeGreaterThan(0);
    expect(sd / m).toBeGreaterThan(0.8);
    expect(Math.min(...values)).toBeLessThan(m * 0.2);
  });
});

describe("galaxy prototype: how the sky looks", () => {
  const raw = new Float32Array([1e-9, 1e-9, 1e-9, 0.01, 0.01, 0.01, 1, 0.8, 0.5, 1e4, 1e4, 1e4]);
  it("brighter light gets a higher level, between 0 and 1", () => {
    const levels = [0, 1, 2, 3].map((t) => levelOf(raw[t * 3]!, raw[t * 3 + 1]!, raw[t * 3 + 2]!, GLOW_CURVE));
    for (let i = 1; i < levels.length; i++) expect(levels[i]!).toBeGreaterThanOrEqual(levels[i - 1]!);
    expect(levels[0]).toBe(0);
    expect(levels[3]).toBe(1);
  });
  it("squares keep the tint (strongest colour 255) and the level in the alpha byte", () => {
    const t = skyToTexels(raw);
    expect(t.length).toBe(16);
    for (let i = 0; i < 4; i++) expect(Math.max(t[i * 4]!, t[i * 4 + 1]!, t[i * 4 + 2]!)).toBe(255);
    // Warm light (more red than blue) stays warm.
    expect(t[2 * 4]!).toBeGreaterThan(t[2 * 4 + 2]!);
    expect(t[3 * 4 + 3]).toBe(255);
  });
  it("the looks: A and B have no glow, C has a faint one; B has more dots than A and C", () => {
    expect(SKY_LOOKS.A.glow).toBe(0);
    expect(SKY_LOOKS.B.glow).toBe(0);
    expect(SKY_LOOKS.C.glow).toBeGreaterThan(0);
    expect(SKY_LOOKS.C.glow).toBeLessThan(0.5);
    // The glow level buttons offer a lower and a higher strength around look C's own.
    expect(GLOW_LEVELS).toContain(SKY_LOOKS.C.glow);
    expect(GLOW_LEVELS[0]!).toBeLessThan(SKY_LOOKS.C.glow);
    expect(GLOW_LEVELS[2]!).toBeGreaterThan(SKY_LOOKS.C.glow);
    expect(SKY_LOOKS.B.dots).toBeGreaterThan(SKY_LOOKS.A.dots);
    expect(SKY_LOOKS.C.dots).toBe(SKY_LOOKS.A.dots);
  });
  it("shading: no glow gives the plain space colour, a faint glow only lifts it a little", () => {
    const out = [0, 0, 0];
    shadeGlow(255, 255, 255, 255, 0, out);
    expect(out).toEqual([SPACE_RGB[0], SPACE_RGB[1], SPACE_RGB[2]]);
    shadeGlow(255, 255, 255, 255, 0.35, out);
    expect(out[0]!).toBeGreaterThan(SPACE_RGB[0] + 40);
    expect(out[0]!).toBeLessThan(140);
  });
});

describe("galaxy prototype: back-drop dots", () => {
  const p = TELEPORTS[1]!.position;
  const params = { count: 4000, nearRadius: 115, seed: 77, squeeze: 0.5 };
  it("same place and seed = the same dots; another seed = other dots; building in chunks changes nothing", () => {
    const a = buildDots(standInField, standInProposal, p, params).stars;
    const b = buildDots(standInField, standInProposal, p, params).stars;
    const c = buildDots(standInField, standInProposal, p, { ...params, seed: 78 }).stars;
    expect(Array.from(a.dirs)).toEqual(Array.from(b.dirs));
    expect(Array.from(c.dirs)).not.toEqual(Array.from(a.dirs));
    const builder = new DotsBuilder(standInField, standInProposal, p, params);
    let t = 0;
    let calls = 0;
    while (!builder.run(0.001, () => (t += 1))) calls++;
    expect(calls).toBeGreaterThan(3);
    expect(builder.progress).toBe(1);
    expect(Array.from(builder.result().dirs)).toEqual(Array.from(a.dirs));
  });
  it("makes the number asked for, as unit directions with colours between 0 and 1", () => {
    const s = buildDots(standInField, standInProposal, p, params).stars;
    expect(s.count).toBe(4000);
    for (let i = 0; i < s.count; i += 37) {
      expect(Math.hypot(s.dirs[i * 3]!, s.dirs[i * 3 + 1]!, s.dirs[i * 3 + 2]!)).toBeCloseTo(1, 4);
      for (let k = 0; k < 3; k++) {
        expect(s.colors[i * 3 + k]!).toBeGreaterThanOrEqual(0);
        expect(s.colors[i * 3 + k]!).toBeLessThanOrEqual(1);
      }
    }
    expect(DEFAULT_DOTS.count).toBe(60000);
  });
  it("from the start place most dots lie near the galaxy's band and bulge: more toward the centre than away from it", () => {
    const s = buildDots(standInField, standInProposal, p, { ...params, count: 8000 }).stars;
    const toCentre = lookDirection("centre", p);
    let near = 0;
    let far = 0;
    let band = 0;
    for (let i = 0; i < s.count; i++) {
      const dot = s.dirs[i * 3]! * toCentre.x + s.dirs[i * 3 + 1]! * toCentre.y + s.dirs[i * 3 + 2]! * toCentre.z;
      if (dot > 0.8) near++;
      else if (dot < -0.8) far++;
      if (Math.abs(s.dirs[i * 3 + 1]!) < 0.2) band++;
    }
    expect(near).toBeGreaterThan(far);
    // The disc is thin, so a fifth of the sky around the horizon (|y| < 0.2) holds clearly more than a fifth of the dots.
    expect(band / s.count).toBeGreaterThan(0.5);
  });
  it("seen edge-on from the rim the dots form a thin band, much thinner than from the start", () => {
    const rim = TELEPORTS[3]!.position;
    const spread = (pos: Vec3): number => {
      const s = buildDots(standInField, standInProposal, pos, { ...params, count: 6000 }).stars;
      let sum = 0;
      for (let i = 0; i < s.count; i++) sum += Math.abs(s.dirs[i * 3 + 1]!);
      return sum / s.count;
    };
    expect(spread(rim)).toBeLessThan(spread(p));
  });
  it("moving a little keeps almost the same stars (their directions shift only a little)", () => {
    const moved = { x: p.x + 30, y: p.y, z: p.z };
    const a = buildDots(standInField, standInProposal, p, params).stars;
    const b = buildDots(standInField, standInProposal, moved, params).stars;
    // Compare the first 300 dots of each: most are the same star seen from 30 ly away, so within a few degrees.
    let same = 0;
    for (let i = 0; i < 300; i++) {
      const dot = a.dirs[i * 3]! * b.dirs[i * 3]! + a.dirs[i * 3 + 1]! * b.dirs[i * 3 + 1]! + a.dirs[i * 3 + 2]! * b.dirs[i * 3 + 2]!;
      if (dot > Math.cos((3 * Math.PI) / 180)) same++;
    }
    expect(same).toBeGreaterThan(240);
  });
  it("a dot that sits in the same small patch of sky as a real star is removed", () => {
    const s = buildDots(standInField, standInProposal, p, params).stars;
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
    const p = parsePreviewParams("?place=rim&look=up&sky=B&face=128&density=30&reach=80&tap=20000&diamonds=10000&glow=0&dots=off&pixels=1&dia=0");
    expect(p).toMatchObject({ place: "rim", look: "up", sky: "B", face: 128, density: 30, reach: 80, tap: 20000, diamonds: 10000, glow: false, dots: false, pixels: true, diamondsOn: false });
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
