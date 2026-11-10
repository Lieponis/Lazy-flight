// THE BASE COCKPIT (C1 restart, built one step at a time from Andy's drawings, 2026-11-10).
// One cockpit for all three ships. Step 1: the shell and the window cut-out only.
// Origin = the pilot's eye, looking -Z, up +Y, 1 unit = 1 crate.
//
// DECIDED (Andy, step 1):
//   - six separate surfaces with no thickness: small front wall, back wall, floor, two side walls, and one
//     curved (lofted) roof surface with the window cut out of it;
//   - shape from the drawing "Cockpit shell", window outline from the drawing "Cockpit windows";
//   - no sharp corners on the window edge (smooth cut).
//   - the window follows the front view most closely (option C); top and side views pull a little;
//   - 6 separate surfaces, drawn by the game in one go (one draw call) so phones stay fast.
//
// All the shapes below were measured from Andy's drawings, pixel by pixel (side, front and top view), and are
// stored as tables. Every number is a share of the cockpit's length (the drawing's 410 pixels = LENGTH crates).

import * as THREE from "three";
import { ModelKit } from "./kit";
import type { AssetEntry, AssetModel, BuildOptions } from "./types";

type V3 = [number, number, number];
type V2 = [number, number];

/** Cockpit length, nose to back wall, in crates. Every other size follows the drawing's proportions. */
export const LENGTH = 3.6;

/** Measured every 1/40 of the length, nose (first) to back (last). */
const ROOF = [0.251, 0.271, 0.291, 0.311, 0.33, 0.348, 0.366, 0.383, 0.398, 0.412, 0.427, 0.441, 0.454, 0.466, 0.479, 0.49, 0.502, 0.512, 0.522, 0.532, 0.541, 0.549, 0.556, 0.563, 0.571, 0.577, 0.583, 0.589, 0.595, 0.599, 0.602, 0.607, 0.611, 0.615, 0.617, 0.62, 0.621, 0.622, 0.624, 0.624, 0.624];
/** Top of the side walls (side view, the inner curve). Zero where there is no side wall (the nose). */
const WALL = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.067, 0.11, 0.141, 0.17, 0.191, 0.211, 0.227, 0.243, 0.257, 0.268, 0.28, 0.29, 0.298, 0.306, 0.312, 0.317, 0.322, 0.327, 0.329, 0.332, 0.334, 0.334];
/** Half width of the floor (top view). */
const PLAN = [0.226, 0.251, 0.282, 0.304, 0.324, 0.343, 0.361, 0.376, 0.39, 0.402, 0.415, 0.424, 0.433, 0.441, 0.449, 0.454, 0.459, 0.463, 0.466, 0.466, 0.466, 0.466, 0.466, 0.466, 0.466, 0.466, 0.466, 0.466, 0.466, 0.466, 0.466, 0.466, 0.466, 0.466, 0.466, 0.466, 0.466, 0.466, 0.466, 0.466, 0.466];
/** Where the side walls begin (and the nose curve ends), as a share of the length. */
const WALL_START = 0.45;

/** Shape of the roof arch seen from the front, from its bottom edge (1, 0) to the top middle (0, 1).
 *  FRONT = the small front wall (front view, inner arch); BACK = the back wall's arch (front view, outer arch). */
const FRONT_ARCH: V2[] = [[1, 0], [0.99, 0.059], [0.99, 0.157], [0.973, 0.252], [0.947, 0.343], [0.913, 0.431], [0.866, 0.514], [0.817, 0.595], [0.754, 0.671], [0.681, 0.742], [0.6, 0.811], [0.511, 0.866], [0.419, 0.917], [0.319, 0.956], [0.214, 0.982], [0.108, 1], [0, 1]];
const BACK_ARCH: V2[] = [[1, 0], [0.966, 0.083], [0.934, 0.17], [0.893, 0.255], [0.854, 0.34], [0.811, 0.424], [0.764, 0.507], [0.71, 0.587], [0.654, 0.664], [0.592, 0.736], [0.524, 0.803], [0.45, 0.864], [0.37, 0.917], [0.283, 0.958], [0.191, 0.987], [0.096, 1], [0, 1]];

/** The window outline seen from above ("Cockpit windows", top view): (along, across), along 0 nose .. 1 back. */
const WINDOW: V2[] = [[0.793, 0.42], [0.761, 0.42], [0.729, 0.42], [0.697, 0.42], [0.666, 0.417], [0.636, 0.412], [0.605, 0.41], [0.575, 0.405], [0.545, 0.4], [0.516, 0.393], [0.487, 0.386], [0.458, 0.378], [0.43, 0.369], [0.402, 0.359], [0.374, 0.348], [0.346, 0.338], [0.319, 0.325], [0.292, 0.313], [0.267, 0.297], [0.241, 0.281], [0.216, 0.266], [0.191, 0.248], [0.166, 0.231], [0.144, 0.211], [0.121, 0.189], [0.099, 0.166], [0.079, 0.143], [0.061, 0.118], [0.045, 0.093], [0.03, 0.067], [0.019, 0.039], [0.011, 0.01], [0.016, -0.02], [0.023, -0.049], [0.037, -0.075], [0.051, -0.101], [0.069, -0.126], [0.089, -0.15], [0.111, -0.173], [0.133, -0.195], [0.157, -0.216], [0.181, -0.235], [0.206, -0.253], [0.231, -0.269], [0.256, -0.286], [0.282, -0.3], [0.309, -0.313], [0.335, -0.327], [0.363, -0.338], [0.39, -0.349], [0.418, -0.359], [0.446, -0.369], [0.475, -0.376], [0.504, -0.383], [0.533, -0.391], [0.564, -0.395], [0.594, -0.4], [0.624, -0.405], [0.654, -0.409], [0.686, -0.41], [0.717, -0.412], [0.749, -0.412], [0.781, -0.412], [0.812, -0.41], [0.841, -0.403], [0.869, -0.393], [0.895, -0.379], [0.915, -0.356], [0.911, -0.326], [0.891, -0.303], [0.867, -0.286], [0.841, -0.272], [0.813, -0.262], [0.786, -0.249], [0.758, -0.24], [0.731, -0.228], [0.703, -0.218], [0.676, -0.208], [0.649, -0.197], [0.621, -0.186], [0.593, -0.176], [0.566, -0.164], [0.538, -0.154], [0.511, -0.142], [0.484, -0.13], [0.457, -0.118], [0.431, -0.104], [0.404, -0.091], [0.379, -0.074], [0.356, -0.053], [0.337, -0.029], [0.327, -0.001], [0.335, 0.029], [0.352, 0.054], [0.374, 0.074], [0.399, 0.091], [0.424, 0.108], [0.451, 0.121], [0.477, 0.133], [0.504, 0.146], [0.532, 0.157], [0.559, 0.169], [0.587, 0.179], [0.614, 0.191], [0.642, 0.201], [0.67, 0.211], [0.698, 0.22], [0.725, 0.232], [0.753, 0.242], [0.78, 0.254], [0.808, 0.264], [0.835, 0.277], [0.861, 0.291], [0.887, 0.306], [0.91, 0.327], [0.918, 0.356], [0.904, 0.382], [0.878, 0.398], [0.85, 0.407], [0.82, 0.412]];

/** The same window seen from the side (along, height) and from the front (across, height), from the drawing. */
const WINDOW_SIDE: V2[] = [[0.182, 0.252], [0.155, 0.252], [0.127, 0.252], [0.099, 0.252], [0.072, 0.252], [0.044, 0.252], [0.018, 0.256], [0.034, 0.274], [0.055, 0.291], [0.076, 0.306], [0.097, 0.322], [0.118, 0.338], [0.139, 0.354], [0.161, 0.369], [0.183, 0.383], [0.205, 0.396], [0.227, 0.41], [0.249, 0.423], [0.272, 0.436], [0.294, 0.449], [0.318, 0.459], [0.34, 0.471], [0.364, 0.482], [0.387, 0.493], [0.411, 0.502], [0.436, 0.507], [0.461, 0.5], [0.488, 0.498], [0.514, 0.495], [0.541, 0.493], [0.568, 0.49], [0.595, 0.49], [0.623, 0.49], [0.649, 0.49], [0.676, 0.49], [0.703, 0.493], [0.729, 0.497], [0.755, 0.502], [0.779, 0.51], [0.804, 0.516], [0.829, 0.524], [0.853, 0.532], [0.878, 0.539], [0.903, 0.546], [0.929, 0.542], [0.952, 0.531], [0.97, 0.511], [0.977, 0.486], [0.977, 0.46], [0.965, 0.438], [0.944, 0.42], [0.921, 0.409], [0.898, 0.398], [0.874, 0.388], [0.852, 0.376], [0.827, 0.368], [0.803, 0.359], [0.779, 0.352], [0.754, 0.344], [0.73, 0.335], [0.705, 0.327], [0.68, 0.322], [0.655, 0.315], [0.629, 0.31], [0.604, 0.304], [0.579, 0.298], [0.553, 0.293], [0.528, 0.288], [0.501, 0.286], [0.475, 0.281], [0.449, 0.277], [0.423, 0.274], [0.396, 0.271], [0.37, 0.266], [0.344, 0.264], [0.316, 0.264], [0.289, 0.262], [0.263, 0.259], [0.236, 0.257], [0.209, 0.254]];
const WINDOW_FRONT: V2[] = [[0.097, 0.33], [0.077, 0.33], [0.056, 0.33], [0.036, 0.332], [0.016, 0.332], [-0.004, 0.335], [-0.024, 0.332], [-0.044, 0.33], [-0.064, 0.33], [-0.085, 0.33], [-0.105, 0.332], [-0.125, 0.333], [-0.144, 0.337], [-0.164, 0.339], [-0.182, 0.344], [-0.201, 0.349], [-0.22, 0.354], [-0.238, 0.361], [-0.256, 0.367], [-0.273, 0.374], [-0.29, 0.383], [-0.307, 0.393], [-0.323, 0.404], [-0.338, 0.419], [-0.347, 0.436], [-0.349, 0.456], [-0.344, 0.474], [-0.333, 0.491], [-0.319, 0.504], [-0.304, 0.517], [-0.288, 0.528], [-0.27, 0.534], [-0.249, 0.534], [-0.229, 0.532], [-0.21, 0.528], [-0.192, 0.522], [-0.173, 0.517], [-0.154, 0.515], [-0.135, 0.51], [-0.115, 0.507], [-0.095, 0.505], [-0.075, 0.504], [-0.055, 0.502], [-0.036, 0.5], [-0.015, 0.5], [0.006, 0.5], [0.027, 0.5], [0.047, 0.5], [0.067, 0.502], [0.087, 0.505], [0.106, 0.507], [0.126, 0.51], [0.146, 0.512], [0.165, 0.515], [0.184, 0.519], [0.203, 0.524], [0.221, 0.529], [0.24, 0.534], [0.261, 0.534], [0.281, 0.532], [0.298, 0.523], [0.314, 0.512], [0.328, 0.498], [0.342, 0.482], [0.352, 0.466], [0.352, 0.445], [0.347, 0.426], [0.332, 0.412], [0.317, 0.398], [0.301, 0.387], [0.284, 0.378], [0.267, 0.37], [0.249, 0.364], [0.231, 0.356], [0.212, 0.352], [0.194, 0.347], [0.175, 0.342], [0.156, 0.337], [0.137, 0.335], [0.117, 0.332]];

/** Where the pilot's eye sits (left seat), from the floor. DECIDED (step 2): higher and closer to the dashboard. */
const EYE = { x: -0.6, y: 1.45, v: 0.47 };
/** Field of view from the pilot's seat, in degrees. DECIDED (step 2): narrower than the old 60. */
export const EYE_FOV = 50;
/** Rings along the length (closer together where the side walls start to rise). */
const VS = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.47, 0.5, 0.54, 0.58, 0.63, 0.68, 0.74, 0.8, 0.87, 0.93, 1];
const SPLIT = 2; // cells the window edge crosses are split 3 x 3, for a smooth edge
const NH = 10; // pieces from the roof's bottom edge to its top middle (each side)

const table = (t: readonly number[], v: number): number => {
  const f = Math.min(Math.max(v, 0), 1) * (t.length - 1);
  const i = Math.min(Math.floor(f), t.length - 2);
  return t[i]! + (t[i + 1]! - t[i]!) * (f - i);
};
const arch = (a: readonly V2[], s: number): V2 => {
  const f = s * (a.length - 1);
  const i = Math.min(Math.floor(f), a.length - 2);
  const k = f - i;
  return [a[i]![0] + (a[i + 1]![0] - a[i]![0]) * k, a[i]![1] + (a[i + 1]![1] - a[i]![1]) * k];
};
const zOf = (v: number): number => (v - EYE.v) * LENGTH; // nose (v = 0) in front: negative z
const halfWidth = (v: number): number => table(PLAN, v) * LENGTH;
const wallTop = (v: number): number => (v < WALL_START ? 0 : table(WALL, v) * LENGTH);
const roofTop = (v: number): number => table(ROOF, v) * LENGTH;

/** A point on the roof: `v` along, `s` from the bottom edge (0) to the top middle (1), `side` -1 left / 1 right. */
function roofPoint(v: number, s: number, side: number): V3 {
  const [fx, fy] = arch(FRONT_ARCH, s);
  const [bx, by] = arch(BACK_ARCH, s);
  const sx = fx + (bx - fx) * v;
  const sy = fy + (by - fy) * v;
  const w = wallTop(v);
  return [side * sx * halfWidth(v), w + (roofTop(v) - w) * sy, zOf(v)];
}

/** Height of the roof's inside above a floor point (x across in crates, v along), or 0 outside the cabin. */
function roofHeightAt(x: number, v: number): number {
  const hw = halfWidth(v);
  if (Math.abs(x) >= hw) return wallTop(v);
  let lo = 0; // s = 0: bottom edge (|x| = hw) .. s = 1: top middle (x = 0)
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (Math.abs(roofPoint(v, mid, 1)[0]) > Math.abs(x)) lo = mid;
    else hi = mid;
  }
  return roofPoint(v, (lo + hi) / 2, 1)[1];
}

const inPoly = (p: V2, poly: readonly V2[]): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[i]!;
    const [bx, by] = poly[j]!;
    if (ay > p[1] !== by > p[1] && p[0] < ((bx - ax) * (p[1] - ay)) / (by - ay) + ax) inside = !inside;
  }
  return inside;
};
const edgeDist = (p: V2, poly: readonly V2[]): number => {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i]!;
    const [bx, by] = poly[(i + 1) % poly.length]!;
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(p[0] - ax - dx * t, p[1] - ay - dy * t));
  }
  return best;
};
const signedDist = (p: V2, poly: readonly V2[]): number => (inPoly(p, poly) ? -1 : 1) * edgeDist(p, poly);
/**
 * Which of Andy's three window views leads. His three views of the window do not fully agree with each other on this
 * roof (no window shape can match all three), so one view is followed exactly and the others are matched as well
 * as they can be. "top" = the C seen from above (exact); "side" and "front" = lean towards those views instead.
 */
export const WINDOW_LEAD: "top" | "side" | "front" = "front"; // DECIDED by Andy: option C, the front view leads

/** Solid roof (> 0) or window (< 0) at a roof point. Made exactly left/right symmetric. */
function windowField(x: number, y: number, v: number): number {
  const u = Math.abs(x) / LENGTH;
  const h = y / LENGTH;
  const top = (signedDist([v, u], WINDOW) + signedDist([v, -u], WINDOW)) / 2;
  const side = signedDist([v, h], WINDOW_SIDE);
  const front = (signedDist([u, h], WINDOW_FRONT) + signedDist([-u, h], WINDOW_FRONT)) / 2;
  if (WINDOW_LEAD === "top") return top;
  if (WINDOW_LEAD === "side") return (top + 2 * side) / 3;
  // Front leads; the top and side views still pull a little, so the C shape stays recognisable from above.
  return (top + side + 4 * front) / 6;
}

function buildShell(): AssetModel {
  const kit = new ModelKit();
  const centre = new THREE.Vector3(0, 0.9, zOf(0.6)); // a point inside the cabin
  /** Adds triangles (a fan) facing the inside of the cabin. */
  const tris: Record<string, number[]> = {};
  const emit = (name: string, poly: V3[], towards: THREE.Vector3 = centre): void => {
    const out = (tris[name] ??= []);
    for (let i = 1; i + 1 < poly.length; i++) {
      const a = new THREE.Vector3(...poly[0]!);
      const b = new THREE.Vector3(...poly[i]!);
      const c = new THREE.Vector3(...poly[i + 1]!);
      const nrm = b.clone().sub(a).cross(c.clone().sub(a));
      if (nrm.lengthSq() < 1e-12) continue;
      const tri = nrm.dot(towards.clone().sub(a)) > 0 ? [a, b, c] : [a, c, b];
      for (const p of tri) out.push(p.x, p.y, p.z);
    }
  };

  // 1. THE ROOF: one curved surface lofted from the front wall's arch to the back wall's arch, its bottom edge
  //    on the floor round the nose and on top of the side walls further back. The window is cut out of it.
  const cols = 2 * NH + 1; // left bottom edge .. top middle .. right bottom edge
  const grid: V3[][] = VS.map((v) =>
    Array.from({ length: cols }, (_, j) => (j <= NH ? roofPoint(v, j / NH, -1) : roofPoint(v, (cols - 1 - j) / NH, 1))),
  );
  /** A roof point from grid coordinates: `kf` along the rings (may be fractional), `c` across (0 .. cols - 1). */
  const at = (kf: number, c: number): V3 => {
    const k = Math.min(Math.floor(kf), VS.length - 2);
    const v = VS[k]! + (VS[k + 1]! - VS[k]!) * (kf - k);
    return c <= NH ? roofPoint(v, c / NH, -1) : roofPoint(v, (2 * NH - c) / NH, 1);
  };
  const windows: V3[][] = [];
  /** One cell of the roof: keep the solid part, record the window part. Cells the window edge crosses are split
   *  into smaller cells first, so the cut edge follows the drawing smoothly. */
  type Corner = { p: V3; f: number; v: number };
  const corner = (p: V3, v: number): Corner => ({ p, v, f: windowField(p[0], p[1], v) });
  const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  /** One cell of the roof (corners in order): keep the solid part, record the window part. A cell the window edge
   *  crosses is first split into SPLIT x SPLIT flat pieces (same plane, so no cracks), so the cut follows the
   *  drawing's outline smoothly. */
  const cell = (q: Corner[], split: boolean): void => {
    const mixed = q.some((c) => c.f < 0) && q.some((c) => c.f >= 0);
    if (split && mixed) {
      const n = SPLIT;
      const P = (a: number, b: number): Corner => {
        const left = lerp3(q[0]!.p, q[1]!.p, a / n);
        const right = lerp3(q[3]!.p, q[2]!.p, a / n);
        const v = q[0]!.v + (q[1]!.v - q[0]!.v) * (a / n);
        return corner(lerp3(left, right, b / n), v);
      };
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) cell([P(a, b), P(a + 1, b), P(a + 1, b + 1), P(a, b + 1)], false);
      return;
    }
    const clip = (keepSolid: boolean): V3[] => {
      const out: V3[] = [];
      for (let i = 0; i < 4; i++) {
        const A = q[i]!;
        const B = q[(i + 1) % 4]!;
        const fa = keepSolid ? A.f : -A.f;
        const fb = keepSolid ? B.f : -B.f;
        if (fa >= 0) out.push(A.p);
        if (fa >= 0 !== fb >= 0) out.push(lerp3(A.p, B.p, fa / (fa - fb)));
      }
      return out;
    };
    const solid = clip(true);
    if (solid.length >= 3) emit("interior roof", solid);
    const hole = clip(false);
    if (hole.length >= 3) windows.push(hole);
  };
  const G = VS.map((v, k) => Array.from({ length: cols }, (_, j) => corner(at(k, j), v)));
  for (let k = 0; k + 1 < VS.length; k++)
    for (let j = 0; j + 1 < cols; j++) cell([G[k]![j]!, G[k + 1]![j]!, G[k + 1]![j + 1]!, G[k]![j + 1]!], true);


  // 2. THE FLOOR: flat, the top-view outline.
  for (let k = 0; k + 1 < VS.length; k++) {
    const a = VS[k]!;
    const b = VS[k + 1]!;
    emit("interior floor", [[-halfWidth(a), 0, zOf(a)], [halfWidth(a), 0, zOf(a)], [halfWidth(b), 0, zOf(b)], [-halfWidth(b), 0, zOf(b)]]);
  }

  // 3 + 4. THE SIDE WALLS: flat and upright, from where the nose curve ends to the back; the top edge is the curve
  //        from the side view (it meets the roof's bottom edge exactly).
  for (const side of [-1, 1] as const) {
    const name = side < 0 ? "interior left wall" : "interior right wall";
    const ks = VS.map((v, k) => ({ v, k })).filter(({ v }) => v >= WALL_START);
    for (let i = 0; i + 1 < ks.length; i++) {
      const a = ks[i]!.v;
      const b = ks[i + 1]!.v;
      const top = (k: number): V3 => grid[k]![side < 0 ? 0 : cols - 1]!;
      const poly: V3[] = [[side * halfWidth(a), 0, zOf(a)], [side * halfWidth(b), 0, zOf(b)], top(ks[i + 1]!.k), top(ks[i]!.k)];
      emit(name, poly.filter((p, n) => n < 2 || p[1] > 1e-4));
    }
  }

  // 5. THE SMALL FRONT WALL: the arch at the nose, flat and upright.
  const front = grid[0]!;
  const frontPoly: V3[] = [[0, 0, zOf(0)], ...front];
  emit("interior front wall", frontPoly);

  // 6. THE BACK WALL: upright sides up to the side walls' top, then the roof arch; flat and upright.
  const back = grid[VS.length - 1]!;
  const backPoly: V3[] = [[0, 0, zOf(1)], [-halfWidth(1), 0, zOf(1)], ...back, [halfWidth(1), 0, zOf(1)]];
  emit("interior back wall", backPoly);

  /** Like emit, but the faces point away from `from` (for the outside of a block standing in the cabin). */
  const emitAway = (name: string, poly: V3[], from: THREE.Vector3): void => {
    const c = poly.reduce((acc, p) => acc.add(new THREE.Vector3(...p)), new THREE.Vector3()).divideScalar(poly.length);
    emit(name, poly, c.multiplyScalar(2).sub(from));
  };

  // ---------------------------------------------------------------- STEP 2: PANELS (option B: as drawn, softened)
  // Measured from "Cockpit panels". Shares of the length, like the shell.
  // DECIDED (Andy, step 2 rework): dashboard at the drawing's height; its light-grey top is flat (at a right angle to
  // the upright faces) and runs forward until it meets the cabin's shell, with no gap; side columns; the centre
  // console joins the dashboard; the overhead panel comes forward to the window's edge but never crosses it.
  //
  // DASHBOARD seen from the side, back part: flat light top -> soft lip -> light upright face (faces the pilot)
  // -> flat dark underside (leg room) -> dark upright leg-room face down to the floor.
  const DASH_TOP = 0.35; // height of the flat top (drawing height)
  const KNEE_TOP = 0.178; // height of the leg-room opening
  const KNEE_DEPTH = 0.63; // the leg-room face, as a share of the way from the nose to the lip
  const SOFT = 0.03; // the soft lip, crates
  const LIP_MIDDLE = 0.23; // how far back the middle section reaches (top view)
  const LIP_WING_END: V2 = [0.375, 0.4]; // where the wings' back edge meets the cabin side (along, across)
  const MID_HALF = 0.2; // half width of the straight middle section
  const lipOf = (u: number): number => {
    const a = Math.abs(u);
    if (a <= MID_HALF) return LIP_MIDDLE;
    return LIP_MIDDLE + ((a - MID_HALF) / (LIP_WING_END[1] - MID_HALF)) * (LIP_WING_END[0] - LIP_MIDDLE);
  };
  /** Along-position of the nose outline at a given across-position (0 on the flat front). */
  const noseOf = (u: number): number => {
    const a = Math.abs(u);
    if (a <= PLAN[0]!) return 0;
    for (let i = 1; i < PLAN.length; i++) {
      if (PLAN[i]! >= a) {
        const t = (a - PLAN[i - 1]!) / (PLAN[i]! - PLAN[i - 1]!);
        return (i - 1 + t) / (PLAN.length - 1);
      }
    }
    return 1;
  };
  /** Height (crates) of the dashboard's flat top at a floor point: the drawing height, or just under the shell. */
  const shelf = (x: number, v: number): number => Math.max(0, Math.min(DASH_TOP * LENGTH, roofHeightAt(x, v) - 0.004));
  // Where the wing's back edge reaches the nose outline: the dashboard's outer end.
  let uEnd = MID_HALF;
  while (uEnd < 0.47 && noseOf(uEnd + 0.002) < lipOf(uEnd + 0.002)) uEnd += 0.002;
  const US = [-uEnd, -0.36, -0.32, -0.28, -0.24, -MID_HALF, -0.1, 0, 0.1, MID_HALF, 0.24, 0.28, 0.32, 0.36, uEnd];
  const DS = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.88]; // along the top, from the nose (0) to just before the lip (1)
  const softV = SOFT / LENGTH;
  for (let i = 0; i + 1 < US.length; i++) {
    const col = (u: number): V3[] => {
      const x = u * LENGTH;
      const n0 = noseOf(u);
      const lip = lipOf(u);
      const along = (d: number): number => n0 + d * (lip - n0);
      const pts: V3[] = DS.map((d) => [x, shelf(x, along(d)), zOf(along(d))]);
      const vTopEnd = lip - softV;
      const hTop = shelf(x, vTopEnd);
      pts.push([x, hTop, zOf(vTopEnd)]); // end of the flat top
      const hLip = Math.max(Math.min(hTop - SOFT, shelf(x, lip)), KNEE_TOP * LENGTH);
      pts.push([x, hLip, zOf(lip)]); // the soft lip
      pts.push([x, KNEE_TOP * LENGTH, zOf(lip)]); // bottom of the light upright face
      const vKnee = along(KNEE_DEPTH);
      pts.push([x, KNEE_TOP * LENGTH, zOf(vKnee)]); // under the dashboard
      pts.push([x, 0, zOf(vKnee)]); // the leg-room face reaches the floor
      return pts;
    };
    const A = col(US[i]!);
    const B = col(US[i + 1]!);
    const towards = new THREE.Vector3(0, 1.4, zOf(0.6));
    for (let k = 0; k + 1 < A.length; k++) {
      const name = k < DS.length + 2 ? "interior dashboard (may cover window edge)" : "interior dashboard underside";
      emit(name, [A[k]!, A[k + 1]!, B[k + 1]!, B[k]!], towards);
    }
  }
  // The centre stack: light plates on the leg-room face of the middle section, above the centre console.
  {
    const vFace = KNEE_DEPTH * LIP_MIDDLE + 0.003;
    const half = 0.07 * LENGTH;
    for (const [a, b] of [[0.105, 0.138], [0.144, 0.172]] as const) {
      emit("interior centre stack", [[-half, a * LENGTH, zOf(vFace)], [half, a * LENGTH, zOf(vFace)], [half, b * LENGTH, zOf(vFace)], [-half, b * LENGTH, zOf(vFace)]]);
    }
  }

  // SIDE COLUMNS: one along each side, from the end of the dashboard's wing back past the pilot's knees.
  // Upright inner face; flat top at the drawing height, or just under the shell where the roof is lower.
  {
    const COL_IN = 0.39; // inner face, across (share of length)
    const COL_TOP = 0.277;
    const v0 = lipOf(COL_IN);
    const v1 = 0.6;
    const vs = [v0, v0 + 0.04, v0 + 0.08, 0.5, 0.55, v1];
    const xIn = COL_IN * LENGTH;
    const topAt = (x: number, v: number): number => Math.max(0, Math.min(COL_TOP * LENGTH, roofHeightAt(x, v) - 0.004));
    const away = new THREE.Vector3(0, 0.6, zOf(0.5));
    for (const side of [-1, 1] as const) {
      for (let i = 0; i + 1 < vs.length; i++) {
        const a = vs[i]!;
        const b = vs[i + 1]!;
        const sx = side * xIn;
        // inner face
        emit("interior side columns", [[sx, 0, zOf(a)], [sx, 0, zOf(b)], [sx, topAt(sx, b), zOf(b)], [sx, topAt(sx, a), zOf(a)]], away);
        // top: from the inner edge out to the cabin side, in two strips
        const outA = side * (halfWidth(a) - 0.002);
        const outB = side * (halfWidth(b) - 0.002);
        const midA = (sx + outA) / 2;
        const midB = (sx + outB) / 2;
        const strip = (pa: number, pb: number, qa: number, qb: number): void =>
          emit("interior side columns", [[pa, topAt(pa, a), zOf(a)], [pb, topAt(pb, b), zOf(b)], [qb, topAt(qb, b), zOf(b)], [qa, topAt(qa, a), zOf(a)]], new THREE.Vector3(0, 5, zOf(0.5)));
        strip(sx, sx, midA, midB);
        strip(midA, midB, outA, outB);
      }
      // back end, facing the back of the cabin
      const sx = side * xIn;
      const out = side * (halfWidth(v1) - 0.002);
      const mid = (sx + out) / 2;
      emit("interior side columns", [[sx, 0, zOf(v1)], [out, 0, zOf(v1)], [out, topAt(out, v1), zOf(v1)], [mid, topAt(mid, v1), zOf(v1)], [sx, topAt(sx, v1), zOf(v1)]], new THREE.Vector3(0, 0.5, zOf(1)));
    }
  }

  // CENTRE CONSOLE: a low block between the seats, joined to the dashboard's leg-room face, two sections,
  // rounded back end, softened top edges.
  {
    const half = 0.08 * LENGTH;
    const soft = 0.03; // chamfer, crates
    const vFront = KNEE_DEPTH * LIP_MIDDLE; // on the dashboard's leg-room face
    const heightAt = (v: number): number => (v < 0.39 ? 0.1 + ((v - vFront) / (0.39 - vFront)) * (0.067 - 0.1) : 0.066) * LENGTH;
    // Outline seen from above: (x, v), going round. The back end is a half round.
    const ring: V2[] = [[-half, vFront], [half, vFront]];
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI;
      ring.push([half * Math.cos(a), 0.544 + (Math.sin(a) * half) / LENGTH]);
    }
    const n = ring.length;
    // The soft top edge: pulled in sideways and at the round end, but not at the front (it meets the dashboard).
    const inset = (p: V2, i: number): V2 => {
      const [x, v] = p;
      if (i < 2) return [x - Math.sign(x) * soft, v];
      const dx = x;
      const dv = (v - 0.544) * LENGTH;
      const len = Math.hypot(dx, dv) || 1;
      return [x - (dx / len) * soft, v - ((dv / len) * soft) / LENGTH];
    };
    const top = ring.map(inset);
    const mid = new THREE.Vector3(0, 0.1, zOf(0.4));
    for (let i = 1; i < n; i++) {
      // Sides and round end (the front, i = 0, sits against the dashboard and is not needed).
      const a = ring[i]!;
      const b = ring[(i + 1) % n]!;
      const ai = top[i]!;
      const bi = top[(i + 1) % n]!;
      const ha = heightAt(a[1]);
      const hb = heightAt(b[1]);
      emitAway("interior centre console", [[a[0], 0, zOf(a[1])], [b[0], 0, zOf(b[1])], [b[0], hb - soft, zOf(b[1])], [a[0], ha - soft, zOf(a[1])]], mid);
      emitAway("interior centre console", [[a[0], ha - soft, zOf(a[1])], [b[0], hb - soft, zOf(b[1])], [bi[0], heightAt(bi[1]), zOf(bi[1])], [ai[0], heightAt(ai[1]), zOf(ai[1])]], mid);
    }
    // The top, split into two sections by a dark line at v = 0.374.
    const split = 0.374;
    const front = top.filter((p) => p[1] <= split);
    const back = top.filter((p) => p[1] > split);
    const hx = top[1]![0];
    const sectionA: V2[] = [...front, [hx, split - 0.004], [-hx, split - 0.004]];
    const sectionB: V2[] = [[hx, split + 0.004], ...back, [-hx, split + 0.004]];
    for (const sec of [sectionA, sectionB]) {
      emit("interior centre console", sec.map(([x, v]) => [x, heightAt(v), zOf(v)] as V3), new THREE.Vector3(0, 5, zOf(0.4)));
    }
    emit("interior console line", [[-hx, heightAt(split) - 0.003, zOf(split - 0.004)], [hx, heightAt(split) - 0.003, zOf(split - 0.004)], [hx, heightAt(split) - 0.003, zOf(split + 0.004)], [-hx, heightAt(split) - 0.003, zOf(split + 0.004)]], new THREE.Vector3(0, 5, zOf(0.4)));
  }

  // OVERHEAD PANEL: a strip hanging under the middle of the roof, from the window's edge back to the back wall.
  // Seen from the front: a narrow light face underneath, sloping sides up to the roof.
  {
    const bottomHalf = 0.06 * LENGTH;
    const topHalf = 0.12 * LENGTH;
    const drop = 0.05 * LENGTH;
    const TAPER = 0.05;
    const vEnd = 0.957;
    const solidAt = (x: number, v: number): boolean => windowField(x, roofHeightAt(x, v), v) > 0.015;
    const fits = (start: number): boolean => {
      for (let v = start; v <= vEnd; v += 0.005) {
        const w = topHalf * Math.min(1, (v - start) / TAPER) + 0.03;
        for (const x of [0, w / 2, w]) if (!solidAt(x, v) || !solidAt(-x, v)) return false;
      }
      return true;
    };
    let vStart = 0.2;
    while (vStart < 0.9 && !fits(vStart)) vStart += 0.005;
    const taper = (v: number): number => Math.min(1, (v - vStart) / TAPER);
    const vs = [vStart, vStart + 0.02, vStart + TAPER];
    for (let v = vStart + TAPER + 0.07; v < vEnd - 0.03; v += 0.07) vs.push(v);
    vs.push(vEnd);
    const sect = (v: number): V3[] => {
      const t = taper(v);
      const xb = bottomHalf * t;
      const xt = Math.max(topHalf * t, 0.02);
      const yb = roofHeightAt(xb, v) - drop * Math.max(t, 0.15);
      return [[-xt, roofHeightAt(xt, v) - 0.005, zOf(v)], [-xb, yb, zOf(v)], [xb, yb, zOf(v)], [xt, roofHeightAt(xt, v) - 0.005, zOf(v)]];
    };
    const down = (v: number): THREE.Vector3 => new THREE.Vector3(0, 0, zOf(v));
    for (let i = 0; i + 1 < vs.length; i++) {
      const a = sect(vs[i]!);
      const b = sect(vs[i + 1]!);
      const below = down((vs[i]! + vs[i + 1]!) / 2);
      emit("interior overhead panel sides", [a[0]!, b[0]!, b[1]!, a[1]!], below);
      emit("interior overhead panel sides", [a[2]!, b[2]!, b[3]!, a[3]!], below);
      emit("interior overhead panel", [a[1]!, b[1]!, b[2]!, a[2]!], below);
    }
    emit("interior overhead panel sides", sect(vEnd), new THREE.Vector3(0, 0, zOf(0.5)));
  }

  const colours = {
    "interior roof": "hullMid",
    "interior floor": "metalDark",
    "interior left wall": "hullDark",
    "interior right wall": "hullDark",
    "interior front wall": "hullDark",
    "interior back wall": "hullDark",
    "interior dashboard (may cover window edge)": "hullLight",
    "interior side columns": "hullMid",
    "interior dashboard underside": "frame",
    "interior centre stack": "hullLight",
    "interior centre console": "hullLight", // same as the dashboard (Andy)
    "interior console line": "frame",
    "interior overhead panel": "hullLight",
    "interior overhead panel sides": "hullMid",
  } as const;
  for (const [name, colour] of Object.entries(colours)) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(tris[name] ?? [], 3));
    kit.add(name, g, colour);
  }
  windows.forEach((w, i) => kit.windowOpening(`window ${i + 1}`, w));

  const model = kit.finish();
  // Surfaces with no thickness: show them from both sides (from outside too, in the viewer).
  model.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) (mesh.material as THREE.Material).side = THREE.DoubleSide;
  });
  // Move everything so the pilot's eye is at (0, 0, 0). (z is already measured from the eye.)
  const shift = new THREE.Vector3(-EYE.x, -EYE.y, 0);
  model.group.position.copy(shift);
  const wrapped = new THREE.Group();
  wrapped.add(model.group);
  for (const a of Object.values(model.anchors)) a.pos.add(shift);
  if (model.windowOpenings) for (const w of model.windowOpenings) w.points = w.points.map((p) => [p[0] + shift.x, p[1] + shift.y, p[2] + shift.z]);
  model.anchors.eye = { pos: new THREE.Vector3(0, 0, 0), dir: new THREE.Vector3(0, 0, -1) };
  return { ...model, group: wrapped };
}

export function buildCockpitBase(_o: BuildOptions = {}): AssetModel {
  return buildShell();
}

/** Work in progress: shown in the viewer only, not in the registry, until all its steps are approved. */
export const COCKPIT_BASE_WIP: AssetEntry = {
  id: "cockpit-base",
  name: "Cockpit base (work in progress)",
  kind: "cockpit",
  description:
    "Steps 1-2: shell (six surfaces with no thickness, window cut out of the curved roof) and panels (dashboard, centre console, overhead panel), measured from Andy's drawings. Seats, screens, lights and dog come in later steps.",
  variants: 1,
  build: buildCockpitBase,
  anchorNames: ["eye"],
  eyeFov: EYE_FOV,
  triangles: 3000,
  status: "DRAFT",
};
