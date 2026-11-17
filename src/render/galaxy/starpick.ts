// TAPPING A STAR (prototype G2): finds the star under a tap quickly. Pure maths, no Three.js.
//
// Plain words: with up to 20,000 tappable stars we do not want to test every star on every tap. The stars are sorted into a
// 3D grid of small boxes once (when the stars change). A tap becomes a ray from the camera; we walk along the ray from box to
// box and only test the stars in the boxes the ray passes (plus the boxes next to them, because a fingertip is not a needle).
// The star closest to the ray, as seen from the camera, wins.

export interface PickHit {
  /** Index of the star (0 = nearest to the player). */
  index: number;
  /** Distance from the camera along the ray (light years). */
  along: number;
  /** Angle between the ray and the star (radians). */
  angle: number;
}

export class StarGrid {
  readonly count: number;
  private readonly minX: number;
  private readonly minY: number;
  private readonly minZ: number;
  private readonly cell: number;
  private readonly nx: number;
  private readonly ny: number;
  private readonly nz: number;
  private readonly start: Int32Array;
  private readonly items: Int32Array;
  /** How many stars the last `pick` looked at (for the report). */
  tested = 0;

  /** Sorts the first `count` stars of `positions` (x, y, z each) into the grid, about 4 stars to a box. */
  constructor(private readonly positions: Float32Array, count: number) {
    this.count = Math.min(count, Math.floor(positions.length / 3));
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < this.count; i++) {
      const x = positions[i * 3] ?? 0;
      const y = positions[i * 3 + 1] ?? 0;
      const z = positions[i * 3 + 2] ?? 0;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
    if (this.count === 0) {
      minX = minY = minZ = 0;
      maxX = maxY = maxZ = 1;
    }
    const sx = Math.max(maxX - minX, 1e-3);
    const sy = Math.max(maxY - minY, 1e-3);
    const sz = Math.max(maxZ - minZ, 1e-3);
    const boxes = Math.max(1, this.count / 4);
    this.cell = Math.max(Math.cbrt((sx * sy * sz) / boxes), Math.max(sx, sy, sz) / 64, 1e-3);
    this.minX = minX;
    this.minY = minY;
    this.minZ = minZ;
    this.nx = Math.max(1, Math.min(64, Math.ceil(sx / this.cell)));
    this.ny = Math.max(1, Math.min(64, Math.ceil(sy / this.cell)));
    this.nz = Math.max(1, Math.min(64, Math.ceil(sz / this.cell)));
    const total = this.nx * this.ny * this.nz;
    this.start = new Int32Array(total + 1);
    this.items = new Int32Array(this.count);
    const boxOf = new Int32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      const b = this.boxIndex(positions[i * 3] ?? 0, positions[i * 3 + 1] ?? 0, positions[i * 3 + 2] ?? 0);
      boxOf[i] = b;
      this.start[b + 1] = (this.start[b + 1] ?? 0) + 1;
    }
    for (let b = 0; b < total; b++) this.start[b + 1] = (this.start[b + 1] ?? 0) + (this.start[b] ?? 0);
    const fill = this.start.slice(0, total);
    for (let i = 0; i < this.count; i++) {
      const b = boxOf[i] ?? 0;
      this.items[fill[b] ?? 0] = i;
      fill[b] = (fill[b] ?? 0) + 1;
    }
  }

  private cellCoord(v: number, min: number, n: number): number {
    return Math.max(0, Math.min(n - 1, Math.floor((v - min) / this.cell)));
  }

  private boxIndex(x: number, y: number, z: number): number {
    return this.cellCoord(x, this.minX, this.nx) + this.nx * (this.cellCoord(y, this.minY, this.ny) + this.ny * this.cellCoord(z, this.minZ, this.nz));
  }

  /**
   * The star nearest to the ray (origin o, unit direction d), as seen from the origin, among the stars whose angle to the ray is
   * at most `maxAngle` radians and whose distance along the ray is between `minAlong` and `maxAlong`. Null if there is none.
   */
  pick(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxAngle: number, maxAlong: number, minAlong = 0): PickHit | null {
    this.tested = 0;
    if (this.count === 0) return null;
    const tan = Math.tan(maxAngle);
    const c = this.cell;
    // Clip the ray to the grid box, grown by the reach of the tolerance cone at the far end.
    const grow = maxAlong * tan + c;
    const lo = [this.minX - grow, this.minY - grow, this.minZ - grow];
    const hi = [this.minX + this.nx * c + grow, this.minY + this.ny * c + grow, this.minZ + this.nz * c + grow];
    const o = [ox, oy, oz];
    const d = [dx, dy, dz];
    let t0 = Math.max(0, minAlong);
    let t1 = maxAlong;
    for (let k = 0; k < 3; k++) {
      const dk = d[k] as number;
      const ok = o[k] as number;
      if (Math.abs(dk) < 1e-12) {
        if (ok < (lo[k] as number) || ok > (hi[k] as number)) return null;
      } else {
        let a = ((lo[k] as number) - ok) / dk;
        let b = ((hi[k] as number) - ok) / dk;
        if (a > b) [a, b] = [b, a];
        if (a > t0) t0 = a;
        if (b < t1) t1 = b;
        if (t0 > t1) return null;
      }
    }
    // March along the ray in steps of about one box; test the stars of the boxes around each step point.
    let best: PickHit | null = null;
    let bestScore = Infinity;
    const step = c * 0.9;
    let lastBox = -1;
    for (let t = t0; ; t += step) {
      const tt = Math.min(t, t1);
      const px = ox + dx * tt;
      const py = oy + dy * tt;
      const pz = oz + dz * tt;
      // A star the ray's cone could hit lies within the cone's width there (it grows with the distance) and half a step along the ray.
      const reach = Math.max(1, Math.ceil(Math.hypot((tt + step / 2) * tan, step / 2) / c));
      const cx = Math.floor((px - this.minX) / c);
      const cy = Math.floor((py - this.minY) / c);
      const cz = Math.floor((pz - this.minZ) / c);
      const box = cx + 4096 * (cy + 4096 * cz);
      if (box !== lastBox || reach > 1) {
        lastBox = box;
        for (let z = Math.max(0, cz - reach); z <= Math.min(this.nz - 1, cz + reach); z++) {
          for (let y = Math.max(0, cy - reach); y <= Math.min(this.ny - 1, cy + reach); y++) {
            for (let x = Math.max(0, cx - reach); x <= Math.min(this.nx - 1, cx + reach); x++) {
              const b = x + this.nx * (y + this.ny * z);
              for (let q = this.start[b] ?? 0; q < (this.start[b + 1] ?? 0); q++) {
                const i = this.items[q] ?? 0;
                this.tested++;
                const vx = (this.positions[i * 3] ?? 0) - ox;
                const vy = (this.positions[i * 3 + 1] ?? 0) - oy;
                const vz = (this.positions[i * 3 + 2] ?? 0) - oz;
                const along = vx * dx + vy * dy + vz * dz;
                if (along < minAlong || along > maxAlong) continue;
                const px2 = vx - dx * along;
                const py2 = vy - dy * along;
                const pz2 = vz - dz * along;
                const angle = Math.atan2(Math.sqrt(px2 * px2 + py2 * py2 + pz2 * pz2), along);
                if (angle > maxAngle) continue;
                // Closest to the ray wins; a star only a hair farther from the ray but much nearer to the camera wins.
                const score = angle + 0.15 * maxAngle * (along / maxAlong);
                if (score < bestScore) {
                  bestScore = score;
                  best = { index: i, along, angle };
                }
              }
            }
          }
        }
      }
      if (tt >= t1) break;
    }
    return best;
  }
}

/** Brute-force version (tests compare against it): tests every star. */
export function pickBrute(positions: Float32Array, count: number, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxAngle: number, maxAlong: number, minAlong = 0): PickHit | null {
  let best: PickHit | null = null;
  let bestScore = Infinity;
  for (let i = 0; i < count; i++) {
    const vx = (positions[i * 3] ?? 0) - ox;
    const vy = (positions[i * 3 + 1] ?? 0) - oy;
    const vz = (positions[i * 3 + 2] ?? 0) - oz;
    const along = vx * dx + vy * dy + vz * dz;
    if (along < minAlong || along > maxAlong) continue;
    const px = vx - dx * along;
    const py = vy - dy * along;
    const pz = vz - dz * along;
    const angle = Math.atan2(Math.sqrt(px * px + py * py + pz * pz), along);
    if (angle > maxAngle) continue;
    const score = angle + 0.15 * maxAngle * (along / maxAlong);
    if (score < bestScore) {
      bestScore = score;
      best = { index: i, along, angle };
    }
  }
  return best;
}

/** One entry of {@link nearestTo}: the star's index in the list and its distance in light years. */
export interface NearbyStar {
  index: number;
  distance: number;
}

/**
 * The `k` stars closest to star number `from` (the star itself is left out), nearest first.
 * Looks at the first `count` stars once, with no grid: it runs once per tap (never per frame),
 * and about 0.1 ms for 20,000 stars is cheap enough for that.
 */
export function nearestTo(positions: Float32Array, count: number, from: number, k: number): NearbyStar[] {
  const out: NearbyStar[] = [];
  if (from < 0 || from >= count || k <= 0) return out;
  const fx = positions[from * 3] ?? 0;
  const fy = positions[from * 3 + 1] ?? 0;
  const fz = positions[from * 3 + 2] ?? 0;
  let worst = Infinity; // squared distance of the farthest of the k kept so far (Infinity until k are kept)
  for (let i = 0; i < count; i++) {
    if (i === from) continue;
    const dx = (positions[i * 3] ?? 0) - fx;
    const dy = (positions[i * 3 + 1] ?? 0) - fy;
    const dz = (positions[i * 3 + 2] ?? 0) - fz;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (out.length === k && d2 >= worst) continue;
    // Insert in order (k is tiny, so a simple shift is fine).
    let at = out.length;
    while (at > 0 && (out[at - 1]?.distance ?? 0) > d2) at--;
    out.splice(at, 0, { index: i, distance: d2 });
    if (out.length > k) out.pop();
    if (out.length === k) worst = out[k - 1]?.distance ?? Infinity;
  }
  for (const s of out) s.distance = Math.sqrt(s.distance);
  return out;
}
