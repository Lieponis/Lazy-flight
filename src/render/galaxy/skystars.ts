// FAINT SINGLE STARS IN THE SKY (prototype G2). Pure maths, no Three.js.
//
// Plain words: the glow in the sky cube is the light of countless stars too far away to see one by one. To make the sky
// feel real we also draw a limited number of faint single dots. They are NOT real systems and cannot be selected.
//
// Where they sit: more dots where the glow is brighter (the Milky Way band and the bulge). That part comes straight from
// the galaxy's density (the same sum that made the glow). WHICH exact spot each dot gets is hash noise: a repeatable
// scramble seeded by the sky cell the player stands in, so the same place always shows the same dots and another place
// shows others.

import { hash32, unit } from "./hash";
import { levelOf, type SkyLook } from "./skylook";
import { faceDirection, texelSolidAngle, type Vec3 } from "./skycube";

export interface FaintStars {
  count: number;
  /** Unit direction of each star (x, y, z), as seen from the player. */
  dirs: Float32Array;
  /** Colour and brightness of each star (red, green, blue, each 0..1). */
  colors: Float32Array;
}

const WARM = [1.0, 0.86, 0.7] as const;
const WHITE = [0.95, 0.97, 1.0] as const;
const BLUE = [0.7, 0.82, 1.0] as const;

/**
 * Places up to `maxStars` faint stars.
 * `seedKey` is a whole number that identifies the sky cell (same cell, same stars).
 */
export function makeFaintStars(raw: Float32Array, faceSize: number, look: SkyLook, maxStars: number, seedKey: number): FaintStars {
  const texels = raw.length / 3;
  const weight = new Float64Array(texels);
  const dir: Vec3 = { x: 0, y: 0, z: 0 };
  let total = 0;
  for (let t = 0; t < texels; t++) {
    const i = t % faceSize;
    const j = Math.floor(t / faceSize) % faceSize;
    const u = ((i + 0.5) / faceSize) * 2 - 1;
    const v = ((j + 0.5) / faceSize) * 2 - 1;
    const level = levelOf(raw[t * 3] ?? 0, raw[t * 3 + 1] ?? 0, raw[t * 3 + 2] ?? 0, look);
    const w = texelSolidAngle(faceSize, u, v) * Math.pow(Math.max(level, 0.04), 1.2);
    weight[t] = w;
    total += w;
  }
  const dirs: number[] = [];
  const colors: number[] = [];
  for (let t = 0; t < texels; t++) {
    const lambda = (maxStars * (weight[t] ?? 0)) / total;
    const n = Math.floor(lambda + unit(hash32(seedKey, t, 0)));
    if (n <= 0) continue;
    const i = t % faceSize;
    const j = Math.floor(t / faceSize) % faceSize;
    const face = Math.floor(t / (faceSize * faceSize));
    const r = raw[t * 3] ?? 0;
    const g = raw[t * 3 + 1] ?? 0;
    const b = raw[t * 3 + 2] ?? 0;
    const luma = 0.3 * r + 0.59 * g + 0.11 * b;
    const tint = luma > 1e-30 ? [Math.min(1.4, r / luma), Math.min(1.4, g / luma), Math.min(1.4, b / luma)] : [1, 1, 1];
    const level = levelOf(r, g, b, look);
    for (let k = 1; k <= n; k++) {
      const u = ((i + unit(hash32(seedKey, t, k * 4 + 1))) / faceSize) * 2 - 1;
      const v = ((j + unit(hash32(seedKey, t, k * 4 + 2))) / faceSize) * 2 - 1;
      faceDirection(face, u, v, dir);
      const len = Math.hypot(dir.x, dir.y, dir.z);
      dirs.push(dir.x / len, dir.y / len, dir.z / len);
      // Brightness: many dim stars, few bright ones. Stars in a dark patch of sky are dimmer too.
      const h = unit(hash32(seedKey, t, k * 4 + 3));
      const bright = (0.28 + 0.72 * h * h * h) * (0.55 + 0.45 * Math.sqrt(level));
      // Colour: a mix of the sky's tint and a star colour (mostly warm, some white, some blue).
      const c = unit(hash32(seedKey, t, k * 4 + 4));
      const base = c < 0.55 ? WARM : c < 0.82 ? WHITE : BLUE;
      colors.push(
        Math.min(1, bright * (0.55 * base[0] + 0.45 * (tint[0] ?? 1))),
        Math.min(1, bright * (0.55 * base[1] + 0.45 * (tint[1] ?? 1))),
        Math.min(1, bright * (0.55 * base[2] + 0.45 * (tint[2] ?? 1))),
      );
    }
  }
  return { count: dirs.length / 3, dirs: Float32Array.from(dirs), colors: Float32Array.from(colors) };
}

/**
 * Removes faint stars that sit (as seen from the player) in the same small patch of sky as a real near star, so a fake dot
 * never sits on top of a real system. `nearDirs` holds unit directions (x, y, z) of the real stars that are drawn.
 * `cellDeg` is the size of the patch in degrees.
 */
export function removeNearOverlaps(stars: FaintStars, nearDirs: Float32Array, cellDeg: number): FaintStars {
  const cells = Math.max(8, Math.round(360 / cellDeg));
  const key = (x: number, y: number, z: number): number => {
    const lon = Math.atan2(z, x);
    const lat = Math.asin(Math.max(-1, Math.min(1, y)));
    const a = Math.min(cells - 1, Math.floor(((lon + Math.PI) / (2 * Math.PI)) * cells));
    const b = Math.min(cells / 2 - 1, Math.floor(((lat + Math.PI / 2) / Math.PI) * (cells / 2)));
    return a * cells + b;
  };
  const taken = new Set<number>();
  for (let i = 0; i + 2 < nearDirs.length; i += 3) taken.add(key(nearDirs[i] ?? 0, nearDirs[i + 1] ?? 0, nearDirs[i + 2] ?? 0));
  const keepDirs: number[] = [];
  const keepColors: number[] = [];
  for (let s = 0; s < stars.count; s++) {
    const x = stars.dirs[s * 3] ?? 0;
    const y = stars.dirs[s * 3 + 1] ?? 0;
    const z = stars.dirs[s * 3 + 2] ?? 0;
    if (taken.has(key(x, y, z))) continue;
    keepDirs.push(x, y, z);
    keepColors.push(stars.colors[s * 3] ?? 0, stars.colors[s * 3 + 1] ?? 0, stars.colors[s * 3 + 2] ?? 0);
  }
  return { count: keepDirs.length / 3, dirs: Float32Array.from(keepDirs), colors: Float32Array.from(keepColors) };
}
