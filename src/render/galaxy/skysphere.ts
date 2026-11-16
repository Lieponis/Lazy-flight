// THE SKY'S LITTLE SQUARES ON A SPHERE (prototype G2). Pure maths, no Three.js.
//
// Plain words: a cube cuts the sky into 6 square pictures; near the corners its squares are about 5 times smaller than in the
// middle of a face, and the cube's edges can show. Instead the sky is cut into rings of squares around the up/down axis (the
// galaxy's axis): every ring has as many squares as fit around it, so rings near the poles have few squares. All squares then
// have about the same size and shape ("equal-area rings"). Andy chose this layout.
//
// The squares are stored ring after ring in one flat list; the page puts them in a texture with one row per ring (and a second
// tiny texture holding how many squares each ring has), and the sky shader finds the square for a direction the same way
// `sampleRings` below does.

import type { Vec3 } from "./skyglow";

export interface RingLayout {
  /** Number of rings from the south pole to the north pole. */
  rings: number;
  /** Squares in each ring. */
  counts: Int32Array;
  /** Index of the first square of each ring. */
  offsets: Int32Array;
  total: number;
  /** Squares in the widest ring (the equator). */
  maxCount: number;
}

/** `equalArea` true: rings hold fewer squares near the poles (equal-size squares). false: every ring has the same count (a plain grid). */
export function ringLayout(rings: number, equalArea: boolean): RingLayout {
  const delta = Math.PI / rings;
  const counts = new Int32Array(rings);
  const offsets = new Int32Array(rings);
  const widest = Math.max(4, Math.round((2 * Math.PI) / delta));
  let total = 0;
  for (let r = 0; r < rings; r++) {
    const lat = -Math.PI / 2 + (r + 0.5) * delta;
    counts[r] = equalArea ? Math.max(4, Math.round((2 * Math.PI * Math.cos(lat)) / delta)) : widest;
    offsets[r] = total;
    total += counts[r] ?? 0;
  }
  return { rings, counts, offsets, total, maxCount: widest };
}

/** Rings that give about `texels` squares in total. */
export function ringsForTexels(texels: number, equalArea: boolean): number {
  let lo = 4;
  let hi = 2000;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ringLayout(mid, equalArea).total < texels) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The direction (length 1) at the middle of square i of ring r. y is up. */
export function ringTexelDirection(layout: RingLayout, ring: number, i: number, out: Vec3): Vec3 {
  const lat = -Math.PI / 2 + ((ring + 0.5) * Math.PI) / layout.rings;
  const lon = ((i + 0.5) / (layout.counts[ring] ?? 1)) * 2 * Math.PI;
  const c = Math.cos(lat);
  out.x = c * Math.cos(lon);
  out.y = Math.sin(lat);
  out.z = c * Math.sin(lon);
  return out;
}

/** Which square (index into the flat list) a direction falls in. */
export function directionToRingTexel(layout: RingLayout, x: number, y: number, z: number): number {
  const len = Math.hypot(x, y, z) || 1;
  const lat = Math.asin(Math.max(-1, Math.min(1, y / len)));
  const ring = Math.max(0, Math.min(layout.rings - 1, Math.floor(((lat + Math.PI / 2) / Math.PI) * layout.rings)));
  let lon = Math.atan2(z, x);
  if (lon < 0) lon += 2 * Math.PI;
  const n = layout.counts[ring] ?? 1;
  const i = Math.max(0, Math.min(n - 1, Math.floor((lon / (2 * Math.PI)) * n)));
  return (layout.offsets[ring] ?? 0) + i;
}

/** The share of the whole sky (solid angle in steradians) that one square of ring `ring` covers. All squares add up to 4 pi. */
export function ringTexelSolidAngle(layout: RingLayout, ring: number): number {
  const delta = Math.PI / layout.rings;
  const lat = -Math.PI / 2 + (ring + 0.5) * delta;
  const band = 2 * Math.PI * (Math.sin(lat + delta / 2) - Math.sin(lat - delta / 2));
  return band / (layout.counts[ring] ?? 1);
}

/** How many squares each ring has, as texture bytes (red = low 8 bits, green = the rest). One texel per ring. */
export function ringCountsData(layout: RingLayout): Uint8Array {
  const data = new Uint8Array(layout.rings * 4);
  for (let r = 0; r < layout.rings; r++) {
    const n = layout.counts[r] ?? 0;
    data[r * 4] = n & 255;
    data[r * 4 + 1] = n >> 8;
    data[r * 4 + 3] = 255;
  }
  return data;
}

/**
 * Lays the flat list of squares (4 bytes each) out as texture rows: row = ring, a ring shorter than the widest one leaves the
 * end of its row empty. The result is `layout.maxCount` x `layout.rings` texels.
 */
export function ringsToRows(flat: Uint8Array, layout: RingLayout, out?: Uint8Array): Uint8Array {
  const data = out ?? new Uint8Array(layout.maxCount * layout.rings * 4);
  for (let r = 0; r < layout.rings; r++) {
    const n = layout.counts[r] ?? 0;
    const from = (layout.offsets[r] ?? 0) * 4;
    data.set(flat.subarray(from, from + n * 4), r * layout.maxCount * 4);
  }
  return data;
}

/**
 * Smooth (bilinear) look-up of the sky at a direction: mixes the 2 x 2 nearest squares (the two nearest rings, and in each the two
 * nearest squares, wrapping around the ring). `flat` holds 4 bytes per square. Writes 4 numbers (0..255) into `out`.
 * The sky shader does exactly this sum on the graphics card.
 */
export function sampleRings(layout: RingLayout, flat: Uint8Array, x: number, y: number, z: number, out: number[]): number[] {
  const len = Math.hypot(x, y, z) || 1;
  const lat = Math.asin(Math.max(-1, Math.min(1, y / len)));
  let lon = Math.atan2(z, x);
  if (lon < 0) lon += 2 * Math.PI;
  const fr = ((lat + Math.PI / 2) / Math.PI) * layout.rings - 0.5;
  const r0 = Math.floor(fr);
  const tr = fr - r0;
  out[0] = out[1] = out[2] = out[3] = 0;
  for (let k = 0; k < 2; k++) {
    const ring = Math.max(0, Math.min(layout.rings - 1, r0 + k));
    const wr = k === 0 ? 1 - tr : tr;
    const n = layout.counts[ring] ?? 1;
    const f = (lon / (2 * Math.PI)) * n - 0.5;
    const i0 = Math.floor(f);
    const ti = f - i0;
    for (let m = 0; m < 2; m++) {
      const i = (((i0 + m) % n) + n) % n;
      const w = wr * (m === 0 ? 1 - ti : ti);
      const o = ((layout.offsets[ring] ?? 0) + i) * 4;
      out[0] += (flat[o] ?? 0) * w;
      out[1] += (flat[o + 1] ?? 0) * w;
      out[2] += (flat[o + 2] ?? 0) * w;
      out[3] += (flat[o + 3] ?? 0) * w;
    }
  }
  return out;
}
