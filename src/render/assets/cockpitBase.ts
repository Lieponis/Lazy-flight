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
// Three rough options for this step (variant 0, 1, 2 = A, B, C): A as drawn, B more glass, C snugger (lower roof).

import * as THREE from "three";
import { ModelKit, type ColorName } from "./kit";
import type { AssetEntry, AssetModel, BuildOptions } from "./types";

type V3 = [number, number, number];

interface ShellOptions {
  label: string;
  width: number; // full width at the back
  length: number;
  noseHalf: number; // half width of the flat front of the nose
  noseRound: number; // share of the length over which the nose widens (top view)
  backHeight: number; // roof height at the back
  frontHeight: number; // roof height at the front (top of the front wall)
  wallHeight: number; // upright side walls (front view)
  // The window band in the top view: u = across (-1 left side .. 1 right side), v = along (0 nose .. 1 back).
  band: { vFront: number; apex: number; tip: number; uTip: number; uOut: number };
}

export const SHELL_OPTIONS: ShellOptions[] = [
  {
    label: "A: as drawn",
    width: 3.6, length: 3.85, noseHalf: 0.82, noseRound: 0.45, backHeight: 2.4, frontHeight: 0.98, wallHeight: 1.22,
    band: { vFront: 0.04, apex: 0.33, tip: 0.92, uTip: 0.7, uOut: 0.96 },
  },
  {
    label: "B: more glass",
    width: 3.6, length: 3.85, noseHalf: 0.82, noseRound: 0.45, backHeight: 2.4, frontHeight: 0.98, wallHeight: 1.22,
    band: { vFront: 0.03, apex: 0.45, tip: 0.94, uTip: 0.5, uOut: 0.98 },
  },
  {
    label: "C: snugger, lower roof",
    width: 3.4, length: 3.6, noseHalf: 0.8, noseRound: 0.42, backHeight: 2.05, frontHeight: 0.95, wallHeight: 1.05,
    band: { vFront: 0.04, apex: 0.33, tip: 0.92, uTip: 0.7, uOut: 0.96 },
  },
];

/** Where the pilot's eye sits, measured from the floor at the back-left: left seat, about mid-length. */
const EYE = { x: -0.9, y: 1.4, v: 0.5 };
const T = 0.08; // shell thickness
const NA = 12; // segments in the roof arch
const NZ = 16; // sections along the length

function buildShell(o: ShellOptions): AssetModel {
  const kit = new ModelKit();
  const zOf = (v: number): number => (v - EYE.v) * o.length; // nose (v = 0) is in front: negative z
  const half = o.width / 2;
  const hwOf = (v: number): number => {
    if (v >= o.noseRound) return half;
    const t = 1 - v / o.noseRound;
    return o.noseHalf + (half - o.noseHalf) * Math.sqrt(Math.max(0, 1 - t * t));
  };
  const hOf = (v: number): number => o.frontHeight + (o.backHeight - o.frontHeight) * (1 - (1 - v) * (1 - v));
  const wallOf = (v: number): number => Math.min(o.wallHeight, hOf(v) - 0.25);

  // A ring of points round one section (left floor, up the left wall, over the arch, down the right wall), inner or outer.
  const ring = (v: number, grow: number): V3[] => {
    const hw = hwOf(v) + grow;
    const h = hOf(v) + grow;
    const wall = wallOf(v);
    const z = zOf(v);
    const pts: V3[] = [[-hw, -grow, z]];
    for (let i = 0; i <= NA; i++) {
      const th = Math.PI - (i * Math.PI) / NA;
      pts.push([hw * Math.cos(th), wall + (h - wall) * Math.sin(th), z]);
    }
    pts.push([hw, -grow, z]);
    return pts;
  };
  const vs = Array.from({ length: NZ + 1 }, (_, i) => i / NZ);
  const inner = vs.map((v) => ring(v, 0));
  const outer = vs.map((v, i) => {
    const r = ring(v, T);
    const dz = i === 0 ? -T : i === NZ ? T : 0;
    return r.map((p) => [p[0], p[1], p[2] + dz] as V3);
  });
  const segs = inner[0]!.length; // ring segments, the last one closes the ring along the floor

  // Is the cell (section k to k+1, segment s) part of the window?
  const b = o.band;
  const isWindow = (k: number, s: number): boolean => {
    if (s === 0 || s >= segs - 2) return false; // left wall, right wall, floor
    const v = (vs[k]! + vs[k + 1]!) / 2;
    if (v < b.vFront || v > b.tip) return false;
    const a = inner[k]![s]!;
    const c = inner[k + 1]![s + 1]!;
    const x = (a[0] + c[0]) / 2;
    const u = Math.abs(x) / hwOf(v);
    const uIn = v <= b.apex ? 0 : (b.uTip * (v - b.apex)) / (b.tip - b.apex);
    return u >= uIn && u <= b.uOut;
  };

  // Collect triangles in buckets, each becomes one named part.
  const buckets = new Map<string, { color: ColorName; pos: number[] }>();
  const put = (name: string, color: ColorName, tri: V3[], towards: THREE.Vector3, face: "in" | "out"): void => {
    const [p, q, r] = tri.map((t) => new THREE.Vector3(...t)) as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
    const n = q.clone().sub(p).cross(r.clone().sub(p));
    const mid = p.clone().add(q).add(r).divideScalar(3);
    const wantIn = face === "in";
    const pointsTo = n.dot(towards.clone().sub(mid)) > 0;
    const order = pointsTo === wantIn ? [p, q, r] : [p, r, q];
    if (!buckets.has(name)) buckets.set(name, { color, pos: [] });
    for (const v of order) buckets.get(name)!.pos.push(v.x, v.y, v.z);
  };
  const quad = (name: string, color: ColorName, a: V3, b2: V3, c: V3, d: V3, towards: THREE.Vector3, face: "in" | "out"): void => {
    put(name, color, [a, b2, c], towards, face);
    put(name, color, [a, c, d], towards, face);
  };
  const axis = (k: number): THREE.Vector3 => new THREE.Vector3(0, wallOf(vs[k]!) * 0.6, (zOf(vs[k]!) + zOf(vs[Math.min(k + 1, NZ)]!)) / 2);

  for (let k = 0; k < NZ; k++) {
    for (let s = 0; s < segs; s++) {
      const s2 = (s + 1) % segs;
      const win = s < segs - 1 && isWindow(k, s);
      if (win) continue;
      const floor = s === segs - 1;
      const name = floor ? "interior floor" : s === 0 || s === segs - 2 ? "interior walls" : "interior roof";
      const color: ColorName = floor ? "metalDark" : s === 0 || s === segs - 2 ? "hullDark" : "hullMid";
      const c = axis(k);
      quad(name, color, inner[k]![s]!, inner[k + 1]![s]!, inner[k + 1]![s2]!, inner[k]![s2]!, c, "in");
      quad("hull outside", "frame", outer[k]![s]!, outer[k + 1]![s]!, outer[k + 1]![s2]!, outer[k]![s2]!, c, "out");
    }
  }
  // Window rims: where a window cell meets solid shell (or the end of the band), close the gap between inside and outside.
  for (let k = 0; k < NZ; k++) {
    for (let s = 1; s < segs - 2; s++) {
      if (!isWindow(k, s)) continue;
      const centre = new THREE.Vector3(...inner[k]![s]!).add(new THREE.Vector3(...inner[k + 1]![s + 1]!)).multiplyScalar(0.5);
      const edges: [number, number, number, number, boolean][] = [
        [k, s, k + 1, s, !isWindow(k, s - 1)], // left edge (segment s-1 side)
        [k, s + 1, k + 1, s + 1, !isWindow(k, s + 1)], // right edge
        [k, s, k, s + 1, k === 0 || !isWindow(k - 1, s)], // front edge
        [k + 1, s, k + 1, s + 1, k + 1 >= NZ || !isWindow(k + 1, s)], // back edge
      ];
      for (const [k1, j1, k2, j2, solid] of edges) {
        if (!solid) continue;
        const a = inner[k1]![j1]!;
        const b2 = inner[k2]![j2]!;
        const c = outer[k2]![j2]!;
        const d = outer[k1]![j1]!;
        // The rim faces into the window hole.
        quad("interior window rims", "frame", a, b2, c, d, centre, "in");
      }
      kit.windowOpening(`window ${k} ${s}`, [inner[k]![s]!, inner[k + 1]![s]!, inner[k + 1]![s + 1]!, inner[k]![s + 1]!]);
    }
  }
  // Front and back walls (caps), inside and outside.
  const inside = new THREE.Vector3(0, 0.8, 0);
  for (const [k, name, color] of [[0, "interior front wall", "hullDark"], [NZ, "interior back wall", "hullDark"]] as const) {
    const rIn = inner[k]!;
    const rOut = outer[k]!;
    const cIn = rIn.reduce((acc, p) => acc.add(new THREE.Vector3(...p)), new THREE.Vector3()).divideScalar(rIn.length);
    const cOut = rOut.reduce((acc, p) => acc.add(new THREE.Vector3(...p)), new THREE.Vector3()).divideScalar(rOut.length);
    for (let i = 0; i < rIn.length; i++) {
      const j = (i + 1) % rIn.length;
      put(name, color, [cIn.toArray() as V3, rIn[i]!, rIn[j]!], inside, "in");
      put("hull outside", "frame", [cOut.toArray() as V3, rOut[i]!, rOut[j]!], inside, "out");
    }
  }
  for (const [name, { color, pos }] of buckets) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    kit.add(name, g, color);
  }
  // The arched doorway in the back wall (dark), as in the front view.
  const zb = zOf(1) - 0.02;
  const doorW = o.width * 0.58;
  const doorH = Math.min(1.48, o.backHeight * 0.62);
  const doorPts: V3[] = [];
  for (let i = 0; i <= 10; i++) {
    const th = (i * Math.PI) / 10;
    for (const z of [zb, zb - 0.04]) doorPts.push([(doorW / 2) * Math.cos(th), doorH * Math.sin(th) + 0.001, z]);
  }
  for (const z of [zb, zb - 0.04]) doorPts.push([-doorW / 2, 0.001, z], [doorW / 2, 0.001, z]);
  kit.convex("back doorway", doorPts, "underside");

  // Move everything so the pilot's eye is at (0, 0, 0). (z is already measured from the eye.)
  const model = kit.finish();
  const shift = new THREE.Vector3(-EYE.x, -EYE.y, 0);
  model.group.position.copy(shift);
  model.group.updateMatrixWorld(true);
  const wrapped = new THREE.Group();
  wrapped.add(model.group);
  for (const a of Object.values(model.anchors)) a.pos.add(shift);
  if (model.windowOpenings) {
    for (const w of model.windowOpenings) w.points = w.points.map((p) => [p[0] + shift.x, p[1] + shift.y, p[2] + shift.z]);
  }
  model.anchors.eye = { pos: new THREE.Vector3(0, 0, 0), dir: new THREE.Vector3(0, 0, -1) };
  return { ...model, group: wrapped };
}

export function buildCockpitBase(o: BuildOptions = {}): AssetModel {
  return buildShell(SHELL_OPTIONS[Math.max(0, Math.min(SHELL_OPTIONS.length - 1, o.variant ?? 0))]!);
}

/** Work in progress: shown in the viewer only, not in the registry, until all its steps are approved. */
export const COCKPIT_BASE_WIP: AssetEntry = {
  id: "cockpit-base",
  name: "Cockpit base (work in progress)",
  kind: "cockpit",
  description: "Step 1: shell and window cut-out. Look 1 = A as drawn, Look 2 = B more glass, Look 3 = C snugger. Screens, seats and lights come in later steps.",
  variants: SHELL_OPTIONS.length,
  build: buildCockpitBase,
  anchorNames: ["eye"],
  triangles: 3000,
  status: "DRAFT",
};
