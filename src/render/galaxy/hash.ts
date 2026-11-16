// Tiny repeatable "random" numbers for the galaxy prototype (G2): the same input always gives the same output.
// Pure maths, no Three.js. The prototype keeps its own copy so it never depends on src/universe.

/** Mixes three whole numbers into one 32-bit whole number (a murmur-style scramble). */
export function hash32(a: number, b: number, c: number): number {
  let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b) ^ Math.imul(c | 0, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** A hash turned into a number from 0 (included) up to 1 (excluded). */
export function unit(h: number): number {
  return (h >>> 0) / 4294967296;
}

/** A repeatable stream of numbers between 0 and 1 (mulberry32). */
export function mulberry(start: number): () => number {
  let a = start >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function corner(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth 3D "value noise" between 0 and 1 (lumpy, no repeats that you would notice). Written out by hand because the sky calls it millions of times. */
export function valueNoise(x: number, y: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fy = y - yi;
  const fz = z - zi;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const s = seed * 31;
  const hx0 = Math.imul(xi + s, 0x9e3779b1);
  const hx1 = Math.imul(xi + 1 + s, 0x9e3779b1);
  const hy0 = Math.imul(yi, 0x85ebca6b);
  const hy1 = Math.imul(yi + 1, 0x85ebca6b);
  const hz0 = Math.imul(zi, 0xc2b2ae35);
  const hz1 = Math.imul(zi + 1, 0xc2b2ae35);
  const c000 = corner(hx0 ^ hy0 ^ hz0);
  const c100 = corner(hx1 ^ hy0 ^ hz0);
  const c010 = corner(hx0 ^ hy1 ^ hz0);
  const c110 = corner(hx1 ^ hy1 ^ hz0);
  const c001 = corner(hx0 ^ hy0 ^ hz1);
  const c101 = corner(hx1 ^ hy0 ^ hz1);
  const c011 = corner(hx0 ^ hy1 ^ hz1);
  const c111 = corner(hx1 ^ hy1 ^ hz1);
  const x00 = c000 + (c100 - c000) * ux;
  const x10 = c010 + (c110 - c010) * ux;
  const x01 = c001 + (c101 - c001) * ux;
  const x11 = c011 + (c111 - c011) * ux;
  const y0 = x00 + (x10 - x00) * uy;
  const y1 = x01 + (x11 - x01) * uy;
  return y0 + (y1 - y0) * uz;
}
