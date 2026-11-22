// THE SKY AHEAD OF THE SHIP (stage 3o, fix 3). Pure numbers only: no graphics here, so the tests can run anywhere.
//
// The flight scene has its own made-up axes: the ship always points along -z, and "up" is +y. The faint galaxy sky is drawn in the real
// galaxy's axes (the centre at 0,0,0, the disc flat in x/z, y out of the disc). Until now the two were simply laid on top of each other, so
// the ship pointed at the same piece of sky on every trip. Here we turn the sky so that what lies AHEAD of the ship is what really lies in
// the direction of the trip, from the system you left towards the system you are going to: fly towards the centre and the centre is ahead,
// fly towards the rim and the rim is ahead. The disc stays level (up stays up) whenever the trip runs along the disc.
// The same two systems always give the same picture.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

/** A hop shorter than this (light years) has no direction worth showing: the sky is left as it always was (the same system, or next door). */
export const MIN_TRIP_LY = 0.5;

/** The way the trip goes in the galaxy: a direction of length 1, or null for a hop too short to have one (or when a place is missing). */
export function tripDirection(from: Vec3 | null | undefined, to: Vec3 | null | undefined): Vec3 | null {
  if (!from || !to) return null;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const d = Math.hypot(dx, dy, dz);
  if (!(d >= MIN_TRIP_LY) || !Number.isFinite(d)) return null;
  return { x: dx / d, y: dy / d, z: dz / d };
}

/**
 * The turn that takes the flight scene's axes onto the galaxy's, so that the ship's nose (-z) points along `dir` and up stays as upright
 * as it can. Null (no trip direction) gives null: leave the sky alone.
 * Used as: the sky camera looks along (this turn) applied to the way the flight camera looks.
 */
export function headingQuaternion(dir: Vec3 | null): Quat | null {
  if (!dir) return null;
  // The new axes of the scene, written in galaxy terms: back (+z) is opposite to the way we go, right (+x), up (+y).
  const bx = -dir.x;
  const by = -dir.y;
  const bz = -dir.z;
  // right = up x back, with up = galaxy y. Straight up or down has no "right": any sideways axis will do (only inside a hair of vertical).
  let rx = bz; // (0,1,0) x (bx,by,bz) = (bz, 0, -bx)
  let ry = 0;
  let rz = -bx;
  const rl = Math.hypot(rx, ry, rz);
  if (rl < 1e-6) {
    rx = 1;
    ry = 0;
    rz = 0;
  } else {
    rx /= rl;
    ry /= rl;
    rz /= rl;
  }
  // up = back x right
  const ux = by * rz - bz * ry;
  const uy = bz * rx - bx * rz;
  const uz = bx * ry - by * rx;
  // The matrix has right, up and back as its columns (m<row><column>).
  const m00 = rx;
  const m01 = ux;
  const m02 = bx;
  const m10 = ry;
  const m11 = uy;
  const m12 = by;
  const m20 = rz;
  const m21 = uz;
  const m22 = bz;
  const trace = m00 + m11 + m22;
  let q: Quat;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    q = { w: 0.25 * s, x: (m21 - m12) / s, y: (m02 - m20) / s, z: (m10 - m01) / s };
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = { w: (m21 - m12) / s, x: 0.25 * s, y: (m01 + m10) / s, z: (m02 + m20) / s };
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = { w: (m02 - m20) / s, x: (m01 + m10) / s, y: 0.25 * s, z: (m12 + m21) / s };
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = { w: (m10 - m01) / s, x: (m02 + m20) / s, y: (m12 + m21) / s, z: 0.25 * s };
  }
  const n = Math.hypot(q.x, q.y, q.z, q.w);
  return { x: q.x / n, y: q.y / n, z: q.z / n, w: q.w / n };
}

/** Turns a direction by a quaternion (for the tests). */
export function rotateBy(q: Quat, v: Vec3): Vec3 {
  // v' = v + 2w (u x v) + 2 u x (u x v), with u = (q.x, q.y, q.z)
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
}

/** How much a trip goes towards the galaxy centre: 1 = straight at the centre, -1 = straight out to the rim, 0 = round the galaxy. */
export function inwardScore(from: Vec3, to: Vec3): number {
  const dir = tripDirection(from, to);
  const l = Math.hypot(from.x, from.y, from.z);
  if (!dir || l < 1) return 0;
  return -(dir.x * from.x + dir.y * from.y + dir.z * from.z) / l;
}

/** ?heading=in or ?heading=out in the web address (with ?warppreview=1): a test trip towards the centre or towards the rim. */
export function parseTripHeading(search: string): "in" | "out" | null {
  const m = /[?&]heading=([a-z]+)/i.exec(search);
  const v = m?.[1]?.toLowerCase();
  return v === "in" || v === "out" ? v : null;
}

/** The place that lies most towards the centre ("in") or most towards the rim ("out") as seen from `from`; null for an empty list. */
export function pickByHeading<T extends { position: Vec3 }>(from: Vec3, list: readonly T[], which: "in" | "out"): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const item of list) {
    const s = inwardScore(from, item.position) * (which === "in" ? 1 : -1);
    if (best === null || s > bestScore) {
      best = item;
      bestScore = s;
    }
  }
  return best;
}
