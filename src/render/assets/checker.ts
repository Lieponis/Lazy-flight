// THE PROBLEM CHECKER: looks at a built model and lists problems in plain words.
// Used by the viewer ("Check this asset", "Check all assets") and by the tests.

import * as THREE from "three";
import { BAY_SIZE, RULES, SPIN_ANCHOR } from "./style";
import type { PartInfo } from "./kit";
import type { AssetEntry, AssetKind, AssetModel } from "./types";

export interface Problem {
  level: "error" | "warning";
  text: string;
}

export interface Counts {
  triangles: number;
  meshes: number;
  materials: number;
  /** Size of the bounding box in crate units (x = width, y = height, z = length). */
  size: { x: number; y: number; z: number };
}

/** Counts triangles, meshes and materials of a model (animated parts included). */
export function countModel(model: AssetModel): Counts {
  let triangles = 0;
  let meshes = 0;
  const materials = new Set<THREE.Material>();
  model.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes++;
    const g = mesh.geometry;
    triangles += g.index ? g.index.count / 3 : g.getAttribute("position").count / 3;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(m);
  });
  const box = boundsOf(model);
  const s = box.isEmpty() ? new THREE.Vector3() : box.getSize(new THREE.Vector3());
  return { triangles: Math.round(triangles), meshes, materials: materials.size, size: { x: s.x, y: s.y, z: s.z } };
}

/** The box around the whole model, ignoring flames (they change length). */
export function boundsOf(model: AssetModel): THREE.Box3 {
  model.group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  model.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || model.animation.flames.includes(mesh)) return;
    const pos = mesh.geometry.getAttribute("position");
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      if (Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)) box.expandByPoint(v);
    }
  });
  return box;
}

interface WorldPart {
  label: string;
  box: THREE.Box3;
  volume: number; // signed: below zero means the faces point inwards
  closedish: boolean;
}

function partsOf(mesh: THREE.Mesh): WorldPart[] {
  const pos = mesh.geometry.getAttribute("position");
  const triCount = pos.count / 3;
  const infos: PartInfo[] = (mesh.geometry.userData.parts as PartInfo[] | undefined) ?? [
    { name: mesh.name || "mesh", start: 0, count: triCount },
  ];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const out: WorldPart[] = [];
  for (const info of infos) {
    const box = new THREE.Box3();
    for (let i = info.start * 3; i < (info.start + info.count) * 3; i++) {
      box.expandByPoint(a.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
    }
    // Volume measured from the part's own middle, so open shapes (a dome without a floor) still read the right way.
    const mid = box.getCenter(new THREE.Vector3());
    let volume = 0;
    let area = 0;
    for (let t = info.start; t < info.start + info.count; t++) {
      a.fromBufferAttribute(pos, t * 3).applyMatrix4(mesh.matrixWorld).sub(mid);
      b.fromBufferAttribute(pos, t * 3 + 1).applyMatrix4(mesh.matrixWorld).sub(mid);
      c.fromBufferAttribute(pos, t * 3 + 2).applyMatrix4(mesh.matrixWorld).sub(mid);
      volume += a.dot(b.clone().cross(c)) / 6;
      area += b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
    }
    // A flat or open shape has almost no volume compared to its skin: we cannot judge its facing.
    const size = box.getSize(new THREE.Vector3());
    const thin = Math.min(size.x, size.y, size.z);
    out.push({ label: `${mesh.name}:${info.name}`, box, volume, closedish: thin > 1e-4 && Math.abs(volume) > area * thin * 0.02 });
  }
  return out;
}

/**
 * Stations: names of parts that cut into the bay room (the camera sits inside it).
 * The room is BAY_SIZE big, from the slot mouth (dockEntrance) inwards, with the parking point in the middle of its floor.
 * The bay's own floor, walls, ceiling, marks and lights (parts named "bay ...") are allowed.
 */
export function bayIntrusions(model: AssetModel): string[] {
  const park = model.anchors.parking?.pos;
  const mouth = model.anchors.dockEntrance?.pos;
  if (!park || !mouth) return [];
  const room = new THREE.Box3(
    new THREE.Vector3(park.x - BAY_SIZE.width / 2, park.y, mouth.z),
    new THREE.Vector3(park.x + BAY_SIZE.width / 2, park.y + BAY_SIZE.height, mouth.z + BAY_SIZE.depth),
  ).expandByScalar(-0.05);
  model.group.updateMatrixWorld(true);
  const found = new Set<string>();
  const tri = new THREE.Triangle();
  model.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.getAttribute("position");
    const infos: PartInfo[] = (mesh.geometry.userData.parts as PartInfo[] | undefined) ?? [{ name: mesh.name, start: 0, count: pos.count / 3 }];
    for (const info of infos) {
      if (info.name.startsWith("bay ")) continue;
      for (let t = info.start; t < info.start + info.count; t++) {
        tri.a.fromBufferAttribute(pos, t * 3).applyMatrix4(mesh.matrixWorld);
        tri.b.fromBufferAttribute(pos, t * 3 + 1).applyMatrix4(mesh.matrixWorld);
        tri.c.fromBufferAttribute(pos, t * 3 + 2).applyMatrix4(mesh.matrixWorld);
        if (room.intersectsTriangle(tri)) {
          found.add(info.name);
          break;
        }
      }
    }
  });
  return [...found];
}

/**
 * Cockpits: names of parts that block the window opening, seen from the eye.
 * Rays go from the eye to points spread over the window (kept a little inside its edge); any face they cross
 * before reaching the window is a blocker. Window struts (parts named "strut ...") are allowed: they are the frame.
 */
export function windowBlockers(model: AssetModel): string[] {
  const win = model.windowOpening;
  const eye = model.anchors.eye?.pos;
  if (!win || !eye) return [];
  model.group.updateMatrixWorld(true);
  const cx = win.poly.reduce((a, p) => a + p[0], 0) / win.poly.length;
  const cy = win.poly.reduce((a, p) => a + p[1], 0) / win.poly.length;
  const inside = (x: number, y: number): boolean => {
    let ok = true;
    win.poly.forEach((p, i) => {
      const q = win.poly[(i + 1) % win.poly.length]!;
      if ((q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]) < 0) ok = false;
    });
    return ok;
  };
  const xs = win.poly.map((p) => p[0]);
  const ys = win.poly.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const targets: THREE.Vector3[] = [];
  for (let i = 0; i <= 14; i++) {
    for (let j = 0; j <= 10; j++) {
      const x = minX + ((maxX - minX) * i) / 14;
      const y = minY + ((maxY - minY) * j) / 10;
      // Pull each point 6% towards the middle so the window's own edge does not count.
      const px = cx + (x - cx) * 0.94;
      const py = cy + (y - cy) * 0.94;
      if (inside(x, y)) targets.push(new THREE.Vector3(px, py, win.z));
    }
  }
  const found = new Set<string>();
  const ray = new THREE.Ray();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const hitPoint = new THREE.Vector3();
  model.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.getAttribute("position");
    const infos: PartInfo[] = (mesh.geometry.userData.parts as PartInfo[] | undefined) ?? [{ name: mesh.name, start: 0, count: pos.count / 3 }];
    for (const info of infos) {
      if (info.name.startsWith("strut")) continue;
      let blocked = false;
      for (let t = info.start; t < info.start + info.count && !blocked; t++) {
        a.fromBufferAttribute(pos, t * 3).applyMatrix4(mesh.matrixWorld);
        b.fromBufferAttribute(pos, t * 3 + 1).applyMatrix4(mesh.matrixWorld);
        c.fromBufferAttribute(pos, t * 3 + 2).applyMatrix4(mesh.matrixWorld);
        for (const target of targets) {
          const dist = target.distanceTo(eye);
          ray.set(eye, target.clone().sub(eye).normalize());
          if (ray.intersectTriangle(a, b, c, false, hitPoint) && hitPoint.distanceTo(eye) < dist - 0.01) {
            blocked = true;
            break;
          }
        }
      }
      if (blocked) found.add(info.name);
    }
  });
  return [...found];
}

/**
 * Checks one model. `kind` decides the budgets. `entry` (optional) lets it compare the declared numbers.
 * Returns an empty list when everything is fine.
 */
export function checkModel(model: AssetModel, kind: AssetKind, entry?: AssetEntry): Problem[] {
  const problems: Problem[] = [];
  const err = (text: string): void => void problems.push({ level: "error", text });
  const warn = (text: string): void => void problems.push({ level: "warning", text });
  const rules = RULES[kind];
  model.group.updateMatrixWorld(true);

  // 1. Broken numbers.
  let badNumbers = 0;
  model.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const arr = mesh.geometry.getAttribute("position").array as ArrayLike<number>;
    for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i]!)) badNumbers++;
  });
  if (badNumbers > 0) err(`${badNumbers} corner numbers are broken (NaN or infinity). Parts of the model will not draw.`);

  // 2. Counts against the budget.
  const counts = countModel(model);
  if (counts.triangles > rules.maxTriangles)
    err(`Too many triangles: ${counts.triangles}, the budget is ${rules.maxTriangles}.`);
  if (counts.meshes > rules.maxMeshes) err(`Too many meshes: ${counts.meshes}, at most ${rules.maxMeshes}. Each mesh costs phones a little.`);
  if (counts.materials > rules.maxMaterials) err(`Too many materials: ${counts.materials}, at most ${rules.maxMaterials}.`);
  if (entry && entry.triangles < counts.triangles)
    warn(`The registry says ${entry.triangles} triangles but the model has ${counts.triangles}. Update the registry.`);

  // 3. Size.
  const longest = Math.max(counts.size.x, counts.size.y, counts.size.z);
  if (longest < rules.size.min || longest > rules.size.max)
    err(`Size is off: the longest side is ${longest.toFixed(1)} crates, it should be ${rules.size.min} to ${rules.size.max}.`);

  // 4. Anchors.
  const names = Object.keys(model.anchors);
  for (const name of rules.requiredAnchors) if (!names.includes(name)) err(`Missing anchor "${name}".`);
  if (rules.engineAnchors && !rules.engineAnchors.some((set) => set.every((n) => names.includes(n))))
    err(`Missing engine anchors: needs "engineL" and "engineR", or "engineMain".`);
  if (kind === "station" && model.animation.spinners.length > 0 && !names.includes(SPIN_ANCHOR))
    err(`It spins but has no "${SPIN_ANCHOR}" anchor.`);
  const box = boundsOf(model);
  const grown = box.clone().expandByScalar(Math.max(1, longest * 0.15));
  for (const [name, a] of Object.entries(model.anchors)) {
    const ok = [a.pos.x, a.pos.y, a.pos.z, a.dir.x, a.dir.y, a.dir.z].every(Number.isFinite);
    if (!ok) err(`Anchor "${name}" has broken numbers.`);
    else if (!box.isEmpty() && !grown.containsPoint(a.pos)) warn(`Anchor "${name}" is far away from the model.`);
  }
  if (entry) for (const name of entry.anchorNames) if (!names.includes(name)) err(`The registry lists anchor "${name}" but the model does not have it.`);

  // 5. Faces pointing inside out, and parts floating away from the body.
  const parts: WorldPart[] = [];
  model.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && !model.animation.flames.includes(mesh)) parts.push(...partsOf(mesh));
  });
  const inside = parts.filter((p) => p.closedish && p.volume < 0).map((p) => p.label.split(":")[1]);
  if (inside.length > 0) err(`Faces point inside out (they show as holes): ${inside.join(", ")}.`);

  if (parts.length > 1) {
    const reach = parts.map((p) => p.box.clone().expandByScalar(0.05));
    let biggest = 0;
    parts.forEach((p, i) => {
      if (p.box.getSize(new THREE.Vector3()).lengthSq() > parts[biggest]!.box.getSize(new THREE.Vector3()).lengthSq()) biggest = i;
    });
    const joined = new Set<number>([biggest]);
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = 0; i < parts.length; i++) {
        if (joined.has(i)) continue;
        for (const j of joined) {
          if (reach[i]!.intersectsBox(reach[j]!)) {
            joined.add(i);
            grew = true;
            break;
          }
        }
      }
    }
    const loose = parts.filter((_, i) => !joined.has(i)).map((p) => p.label.split(":")[1]);
    if (loose.length > 0) err(`Parts float away from the body (they touch nothing): ${loose.join(", ")}.`);
  }

  // 6. Stations: nothing may cut across the bay, where the docked camera sits.
  if (kind === "station") {
    const cutting = bayIntrusions(model);
    if (cutting.length > 0) err(`Parts cut across the inside of the docking bay: ${cutting.join(", ")}.`);
  }

  // 7. Cockpits: the window must show the outside.
  if (kind === "cockpit") {
    if (!model.windowOpening) err("This cockpit has no window opening recorded.");
    const blocking = windowBlockers(model);
    if (blocking.length > 0) err(`Faces block the window opening: ${blocking.join(", ")}.`);
  }

  return problems;
}

/** Builds and checks one registry entry, every variant. */
export function checkEntry(entry: AssetEntry): { variant: number; problems: Problem[] }[] {
  const out: { variant: number; problems: Problem[] }[] = [];
  for (let v = 0; v < entry.variants; v++) {
    try {
      out.push({ variant: v, problems: checkModel(entry.build({ variant: v }), entry.kind, entry) });
    } catch (e) {
      out.push({ variant: v, problems: [{ level: "error", text: `The model could not be built: ${(e as Error).message}` }] });
    }
  }
  return out;
}
