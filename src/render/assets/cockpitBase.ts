// THE BASE COCKPIT (C1 restart, built one step at a time from Andy's drawings, 2026-11-10).
// One cockpit for all three ships. Step 1: the shell and the window cut-out only.
// Origin = the pilot's eye, looking -Z, up +Y, 1 unit = 1 crate.
//
// Andy's drawings (side, front and top view):
//   shell   = flat floor; tall flat back wall; the roof curves down to a short front wall; seen from the front,
//             low upright side walls with a round arch on top; seen from above, a rounded nose.
//   window  = one band that wraps round the nose and runs back along both sides of the roof ("C" seen from above);
//             the middle of the roof stays solid.
//   back    = an arched doorway in the back wall.
//
// DECIDED (Andy, step 1): option C (snugger, lower roof); zero-thickness walls (just a surface); no sharp corners
// (smooth, rounded window edges; rounded floor corners).

import * as THREE from "three";
import { ModelKit } from "./kit";
import type { AssetEntry, AssetModel, BuildOptions } from "./types";

type V3 = [number, number, number];
type V2 = [number, number];

/** Shell sizes (option C), in crates. */
export const SHELL = {
  width: 3.4, // at the back
  length: 3.6,
  noseHalf: 0.8, // half width of the flat front of the nose
  noseRound: 0.42, // share of the length over which the nose widens (top view)
  backHeight: 2.05,
  frontHeight: 0.95, // top of the short front wall
  wallHeight: 1.05, // upright side walls (front view)
  fillet: 0.18, // rounded corner where the floor meets the walls
};

/**
 * The window band, seen from above: a thick curved line (a "C") round the nose and back along both sides,
 * with rounded ends. `spine` = its middle line as (across, along) in shares: across -1 left .. 1 right of the local
 * half width, along 0 nose .. 1 back. `radius` = half its thickness, in crates.
 */
export const WINDOW = {
  spine: [[-0.8, 0.86], [-0.82, 0.6], [-0.76, 0.36], [-0.55, 0.19], [-0.2, 0.13], [0.2, 0.13], [0.55, 0.19], [0.76, 0.36], [0.82, 0.6], [0.8, 0.86]] as V2[],
  radius: 0.3,
};

/** Where the pilot's eye sits (left seat, about mid-length), from the floor. Not decided yet: seats come later. */
const EYE = { x: -0.9, y: 1.3, v: 0.5 };
const NA = 16; // pieces round the roof arch
const NZ = 22; // pieces along the length

const zOf = (v: number): number => (v - EYE.v) * SHELL.length; // nose (v = 0) in front: negative z
const hwOf = (v: number): number => {
  const half = SHELL.width / 2;
  if (v >= SHELL.noseRound) return half;
  const t = 1 - v / SHELL.noseRound;
  return SHELL.noseHalf + (half - SHELL.noseHalf) * Math.sqrt(Math.max(0, 1 - t * t));
};
const hOf = (v: number): number => SHELL.frontHeight + (SHELL.backHeight - SHELL.frontHeight) * (1 - (1 - v) * (1 - v));
const wallOf = (v: number): number => Math.min(SHELL.wallHeight, hOf(v) - 0.25);

/** One section of the shell: the floor, the rounded floor corners, the upright walls and the arch, as a closed ring. */
function ring(v: number): V3[] {
  const hw = hwOf(v);
  const h = hOf(v);
  const wall = wallOf(v);
  const f = Math.min(SHELL.fillet, wall * 0.4);
  const z = zOf(v);
  const pts: V3[] = [];
  const corner = (side: 1 | -1, up: boolean): void => {
    // A quarter round from the floor to the wall (or back), 3 steps.
    const cx = side * (hw - f);
    const steps = [0, 1, 2, 3].map((i) => (i * Math.PI) / 6);
    const seq = up ? steps : [...steps].reverse();
    for (const a of seq) pts.push([cx + side * f * Math.sin(a), f - f * Math.cos(a), z]);
  };
  corner(-1, false); // from the wall bottom down to the floor (we go round: left wall top is added by the arch)
  pts.reverse(); // now: floor edge -> up to the wall
  for (let i = 0; i <= NA; i++) {
    const th = Math.PI - (i * Math.PI) / NA;
    pts.push([hw * Math.cos(th), wall + (h - wall) * Math.sin(th), z]);
  }
  corner(1, true);
  pts.pop();
  const last = pts.length;
  void last;
  return pts;
}

/** Distance (in crates, seen from above) from a point to the window band's middle line, minus the band's half thickness. */
function windowField(x: number, v: number): number {
  const z = v * SHELL.length;
  let best = Infinity;
  const P = WINDOW.spine.map(([u, vv]) => [u * hwOf(vv), vv * SHELL.length] as V2);
  for (let i = 0; i + 1 < P.length; i++) {
    const [ax, az] = P[i]!;
    const [bx, bz] = P[i + 1]!;
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best - WINDOW.radius;
}

function buildShell(): AssetModel {
  const kit = new ModelKit();
  const vs = Array.from({ length: NZ + 1 }, (_, i) => i / NZ);
  const rings = vs.map(ring);
  const n = rings[0]!.length;
  const archStart = 4; // first arch point (after the floor corner)
  const archEnd = archStart + NA; // last arch point
  // Solid (> 0) or window (< 0) at each grid point. Only the roof arch can be window, and not the front wall.
  const field = (k: number, j: number): number => {
    if (j < archStart || j > archEnd) return 1;
    const p = rings[k]![j]!;
    if (p[1] <= wallOf(vs[k]!) + 0.02) return 1;
    return windowField(p[0], vs[k]!);
  };

  const pos: Record<"roof" | "walls" | "floor", number[]> = { roof: [], walls: [], floor: [] };
  const windows: V3[][] = [];
  const centreOf = (k: number): THREE.Vector3 => new THREE.Vector3(0, wallOf(vs[k]!) * 0.6, zOf(vs[k]!));
  const emit = (bucket: keyof typeof pos, poly: V3[], towards: THREE.Vector3): void => {
    for (let i = 1; i + 1 < poly.length; i++) {
      const a = new THREE.Vector3(...poly[0]!);
      const b = new THREE.Vector3(...poly[i]!);
      const c = new THREE.Vector3(...poly[i + 1]!);
      const nrm = b.clone().sub(a).cross(c.clone().sub(a));
      if (nrm.lengthSq() < 1e-12) continue;
      const inward = nrm.dot(towards.clone().sub(a)) > 0;
      const tri = inward ? [a, b, c] : [a, c, b];
      for (const p of tri) pos[bucket].push(p.x, p.y, p.z);
    }
  };

  for (let k = 0; k < NZ; k++) {
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n;
      // The cell's corners in order, with their solid/window value.
      const corners: { p: V3; f: number }[] = [
        { p: rings[k]![j]!, f: field(k, j) },
        { p: rings[k + 1]![j]!, f: field(k + 1, j) },
        { p: rings[k + 1]![j2]!, f: field(k + 1, j2) },
        { p: rings[k]![j2]!, f: field(k, j2) },
      ];
      // Keep the solid part (f >= 0); cut along the line where f = 0, so the window edge is smooth.
      const clip = (keepSolid: boolean): V3[] => {
        const out: V3[] = [];
        for (let i = 0; i < 4; i++) {
          const A = corners[i]!;
          const B = corners[(i + 1) % 4]!;
          const fa = keepSolid ? A.f : -A.f;
          const fb = keepSolid ? B.f : -B.f;
          if (fa >= 0) out.push(A.p);
          if ((fa >= 0) !== (fb >= 0)) {
            const t = fa / (fa - fb);
            out.push([A.p[0] + (B.p[0] - A.p[0]) * t, A.p[1] + (B.p[1] - A.p[1]) * t, A.p[2] + (B.p[2] - A.p[2]) * t]);
          }
        }
        return out;
      };
      const solid = clip(true);
      const bucket = j === n - 1 ? "floor" : j < archStart || j >= archEnd ? "walls" : "roof";
      if (solid.length >= 3) emit(bucket, solid, centreOf(k));
      const hole = clip(false);
      if (hole.length >= 3) windows.push(hole);
    }
  }
  // Front and back walls: the end rings, filled.
  const inside = new THREE.Vector3(0, 0.8, 0);
  for (const k of [0, NZ]) {
    const r = rings[k]!;
    const c = r.reduce((acc, p) => acc.add(new THREE.Vector3(...p)), new THREE.Vector3()).divideScalar(r.length);
    for (let i = 0; i < r.length; i++) emit("walls", [c.toArray() as V3, r[i]!, r[(i + 1) % r.length]!], inside);
  }
  const colours = { roof: "hullMid", walls: "hullDark", floor: "metalDark" } as const;
  for (const b of ["roof", "walls", "floor"] as const) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos[b], 3));
    kit.add(`interior ${b}`, g, colours[b]);
  }
  windows.forEach((w, i) => kit.windowOpening(`window ${i + 1}`, w));

  // The arched doorway in the back wall (dark), as in the front view.
  const zb = zOf(1) - 0.02;
  const doorW = SHELL.width * 0.58;
  const doorH = Math.min(1.48, SHELL.backHeight * 0.62);
  const doorPts: V3[] = [];
  for (let i = 0; i <= 10; i++) {
    const th = (i * Math.PI) / 10;
    for (const z of [zb, zb - 0.03]) doorPts.push([(doorW / 2) * Math.cos(th), doorH * Math.sin(th) + 0.001, z]);
  }
  kit.convex("back doorway", doorPts, "underside");

  const model = kit.finish();
  // A surface with no thickness: show it from both sides (from outside too, in the viewer).
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
  description: "Step 1 (decided: option C, a single surface, smooth window edges, rounded corners): shell and window cut-out. Dashboard, seats, screens and lights come in later steps.",
  variants: 1,
  build: buildCockpitBase,
  anchorNames: ["eye"],
  triangles: 3000,
  status: "DRAFT",
};
