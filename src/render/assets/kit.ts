// THE MODEL KIT: builds a model from simple shapes and merges them into a few meshes.
//
// How a builder uses it:
//   const kit = new ModelKit({ tint });
//   kit.box("body", 2, 1, 4, "hullLight", { at: [0, 0.8, 0] });
//   kit.box("window", 0.6, 0.3, 0.1, "window", { at: [0, 1.2, -2], layer: "glow" });
//   kit.anchor("parking", [0, 0, 0]);
//   return kit.finish();
//
// Every shape is baked with the game's four brightness steps (flat shading, no lights needed).
// Shapes on the same layer become ONE mesh. Layers:
//   body   = everything solid (shaded)
//   glow   = windows, lights that stay on (never shaded), merged into the body mesh
//   blinkA, blinkB = lights that blink in turn (two small meshes)
//   flame  = engine flames (one mesh, grows backwards along +Z)
//   ring   = a part that spins (one mesh, turns around its own origin)
//   light  = cockpits: surfaces lit by the window (one mesh, own material so its colour can be tinted)

import * as THREE from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { faceShade } from "../helpers";
import { PAL, safeTint, safeTintDark, type PalKey } from "./palette";
import { BLINK_ON, BLINK_PERIOD, FLAME_PARKED, LIGHT_DIR } from "./style";
import type { Anchors, AssetAnimation, AssetModel } from "./types";

export type ColorName = PalKey | "tint" | "tintDark";
export type Layer = "body" | "glow" | "blinkA" | "blinkB" | "flame" | "ring" | "light";

export interface PartOptions {
  at?: readonly [number, number, number];
  /** Turn in radians around x, y, z (applied in that order). */
  rot?: readonly [number, number, number];
  /** A turn given as a quaternion (used instead of `rot` when set). */
  q?: THREE.Quaternion;
  layer?: Layer;
}

/** One cross-section of a loft: centre (x, y), position z, width, height, top and bottom corner cuts. */
export interface LoftSection {
  z: number;
  w: number;
  h: number;
  y: number;
  x?: number;
  ct?: number;
  cb?: number;
}

/** A record of where each named part lives inside a merged mesh (the checker uses it). */
export interface PartInfo {
  name: string;
  /** First triangle of this part in the mesh. */
  start: number;
  count: number;
}

const LIGHT = new THREE.Vector3(...LIGHT_DIR).normalize();

/** The shared material: every mesh uses vertex colours, so one material is enough. */
export function makeAssetMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ vertexColors: true });
}

/** Brightness of one face from its direction (the same four steps as the game). */
export function shadeFor(normal: THREE.Vector3): number {
  return 0.4 + 0.6 * faceShade(normal.dot(LIGHT));
}

interface PendingPart {
  name: string;
  geometry: THREE.BufferGeometry; // non-indexed, already moved into place
  hex: number;
  shaded: boolean;
}

export class ModelKit {
  private parts: Record<Layer, PendingPart[]> = { body: [], glow: [], blinkA: [], blinkB: [], flame: [], ring: [], light: [] };
  private windows: { name: string; points: [number, number, number][] }[] = [];
  /** Everything built is moved by this much (cockpits use it to move the room around a fixed eye). */
  private shift = new THREE.Vector3();
  private leverSpecs: { name: string; pivot: THREE.Vector3; axis: THREE.Vector3; maxAngle: number; build: (k: ModelKit) => void }[] = [];
  private origins: Partial<Record<Layer, THREE.Vector3>> = {};
  private anchors: Anchors = {};
  private spinSpeed = 0;
  private spinAxis = new THREE.Vector3(0, 1, 0);
  private tint: number;
  private recolour: Partial<Record<string, number>>;

  /** `recolour`: palette colours to replace (ship liveries); glow colours are never passed here. */
  constructor(options: { tint?: number; recolour?: Partial<Record<string, number>> } = {}) {
    this.tint = options.tint ?? 0xb5653a;
    this.recolour = options.recolour ?? {};
  }

  /** The colour number for a palette name or "tint" / "tintDark". */
  color(name: ColorName): number {
    if (name === "tint") return safeTint(this.tint);
    if (name === "tintDark") return safeTintDark(this.tint);
    return this.recolour[name] ?? PAL[name];
  }

  // ------------------------------------------------------------ shapes

  box(name: string, w: number, h: number, d: number, color: ColorName, o: PartOptions = {}): this {
    return this.add(name, new THREE.BoxGeometry(w, h, d), color, o);
  }

  /** A cylinder standing up (along Y). `sides` = 6 or 8 keeps it chunky. */
  cyl(name: string, rTop: number, rBottom: number, h: number, sides: number, color: ColorName, o: PartOptions = {}): this {
    return this.add(name, new THREE.CylinderGeometry(rTop, rBottom, h, sides), color, o);
  }

  /** A cone pointing up (+Y). */
  cone(name: string, r: number, h: number, sides: number, color: ColorName, o: PartOptions = {}): this {
    return this.add(name, new THREE.ConeGeometry(r, h, sides), color, o);
  }

  /** A low-poly ball (detail 0 = 20 faces, 1 = 80 faces). */
  ball(name: string, r: number, detail: 0 | 1, color: ColorName, o: PartOptions = {}): this {
    return this.add(name, new THREE.IcosahedronGeometry(r, detail), color, o);
  }

  /** A half ball (dome), flat side down. */
  dome(name: string, r: number, sides: number, color: ColorName, o: PartOptions = {}): this {
    return this.add(name, new THREE.SphereGeometry(r, sides, 3, 0, Math.PI * 2, 0, Math.PI / 2), color, o);
  }

  /** A ring lying flat (around Y). Tube = thickness. */
  ring(name: string, radius: number, tube: number, sides: number, color: ColorName, o: PartOptions = {}): this {
    const g = new THREE.TorusGeometry(radius, tube, 4, sides);
    g.rotateX(Math.PI / 2);
    return this.add(name, g, color, o);
  }

  /**
   * A wedge: a box whose top face is narrower and/or shorter. Good for noses and sloped roofs.
   * w, h, d = bottom width, height, depth. topW, topD = top width and depth. topShiftZ moves the top forward (-) or back (+).
   */
  wedge(
    name: string,
    w: number,
    h: number,
    d: number,
    topW: number,
    topD: number,
    color: ColorName,
    o: PartOptions & { topShiftZ?: number } = {},
  ): this {
    const shift = o.topShiftZ ?? 0;
    const b = [w / 2, d / 2];
    const t = [topW / 2, topD / 2];
    // 8 corners: bottom 0-3, top 4-7 (x-, x+ / z-, z+)
    const v: [number, number, number][] = [
      [-b[0]!, -h / 2, -b[1]!], [b[0]!, -h / 2, -b[1]!], [b[0]!, -h / 2, b[1]!], [-b[0]!, -h / 2, b[1]!],
      [-t[0]!, h / 2, -t[1]! + shift], [t[0]!, h / 2, -t[1]! + shift], [t[0]!, h / 2, t[1]! + shift], [-t[0]!, h / 2, t[1]! + shift],
    ];
    // Faces wound counter-clockwise when seen from outside.
    const quads = [
      [0, 1, 2, 3], // bottom (seen from below)
      [4, 7, 6, 5], // top
      [0, 4, 5, 1], // front (z-)
      [2, 6, 7, 3], // back (z+)
      [1, 5, 6, 2], // right (x+)
      [3, 7, 4, 0], // left (x-)
    ];
    const pos: number[] = [];
    for (const [a, bb, c, dd] of quads) {
      for (const idx of [a, bb, c, a, c, dd]) pos.push(...v[idx!]!);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return this.add(name, g, color, o);
  }

  /**
   * Any six-sided block from 8 corners: bottom four, then top four, each in the order
   * (left-front, right-front, right-back, left-back). Front = -Z, left = -X.
   */
  hull8(name: string, corners: readonly (readonly [number, number, number])[], color: ColorName, o: PartOptions = {}): this {
    const v = corners;
    const quads = [
      [0, 1, 2, 3],
      [4, 7, 6, 5],
      [0, 4, 5, 1],
      [2, 6, 7, 3],
      [1, 5, 6, 2],
      [3, 7, 4, 0],
    ];
    const pos: number[] = [];
    for (const [a, b, c, d] of quads) for (const i of [a, b, c, a, c, d]) pos.push(...v[i!]!);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return this.add(name, g, color, o);
  }

  /**
   * A block that changes size along its length (front at zFront, back at zBack, zFront < zBack).
   * Each end is a rectangle: width, height and the height of its middle (y).
   */
  taper(
    name: string,
    front: { z: number; w: number; h: number; y: number },
    back: { z: number; w: number; h: number; y: number },
    color: ColorName,
    o: PartOptions = {},
  ): this {
    const f = front;
    const b = back;
    return this.hull8(
      name,
      [
        [-f.w / 2, f.y - f.h / 2, f.z], [f.w / 2, f.y - f.h / 2, f.z], [b.w / 2, b.y - b.h / 2, b.z], [-b.w / 2, b.y - b.h / 2, b.z],
        [-f.w / 2, f.y + f.h / 2, f.z], [f.w / 2, f.y + f.h / 2, f.z], [b.w / 2, b.y + b.h / 2, b.z], [-b.w / 2, b.y + b.h / 2, b.z],
      ],
      color,
      o,
    );
  }

  /**
   * A faceted hull: a list of cross-sections along Z (front first). Each section is a rectangle with its
   * top corners cut (ct) and bottom corners cut (cb), so the hull has 8 sides: angled shoulders, no box look.
   */
  loft(name: string, sections: readonly LoftSection[], color: ColorName, o: PartOptions & { openFront?: boolean } = {}): this {
    const rings = sections.map((s) => {
      const hw = s.w / 2;
      const b = s.y - s.h / 2;
      const t = s.y + s.h / 2;
      const ct = Math.min(s.ct ?? 0, hw, s.h / 2);
      const cb = Math.min(s.cb ?? 0, hw, s.h / 2);
      const pts: [number, number][] = [
        [-hw + cb, b], [hw - cb, b], [hw, b + cb], [hw, t - ct],
        [hw - ct, t], [-hw + ct, t], [-hw, t - ct], [-hw, b + cb],
      ];
      return pts.map(([x, y]) => [x + (s.x ?? 0), y, s.z] as [number, number, number]);
    });
    const pos: number[] = [];
    const tri = (a: number[], b: number[], c: number[]): void => void pos.push(...a, ...c, ...b);
    for (let r = 0; r + 1 < rings.length; r++) {
      const A = rings[r]!;
      const B = rings[r + 1]!;
      for (let i = 0; i < 8; i++) {
        const j = (i + 1) % 8;
        tri(A[i]!, B[i]!, B[j]!);
        tri(A[i]!, B[j]!, A[j]!);
      }
    }
    const first = rings[0]!;
    const last = rings[rings.length - 1]!;
    for (let i = 1; i < 7; i++) {
      if (!o.openFront) tri(first[0]!, first[i]!, first[i + 1]!);
      tri(last[0]!, last[i + 1]!, last[i]!);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return this.add(name, g, color, o);
  }

  /**
   * A flat convex shape (points in the x-y plane, counter-clockwise, y up) pushed along Z from zFront to zBack.
   * Used for station faces around a docking slot.
   */
  prism(name: string, poly: readonly (readonly [number, number])[], zFront: number, zBack: number, color: ColorName, o: PartOptions = {}): this {
    const pos: number[] = [];
    const n = poly.length;
    const f = (i: number): number[] => [poly[i]![0], poly[i]![1], zFront];
    const b = (i: number): number[] => [poly[i]![0], poly[i]![1], zBack];
    for (let i = 1; i + 1 < n; i++) {
      pos.push(...f(0), ...f(i + 1), ...f(i)); // front face looks to -Z
      pos.push(...b(0), ...b(i), ...b(i + 1)); // back face looks to +Z
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      pos.push(...f(i), ...f(j), ...b(j));
      pos.push(...f(i), ...b(j), ...b(i));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return this.add(name, g, color, o);
  }

  /** The same 8-corner block mirrored to the other side (x becomes -x), with its faces kept pointing out. */
  static mirrorX(c: readonly (readonly [number, number, number])[]): [number, number, number][] {
    const m = c.map(([x, y, z]) => [-x, y, z] as [number, number, number]);
    return [m[1]!, m[0]!, m[3]!, m[2]!, m[5]!, m[4]!, m[7]!, m[6]!];
  }

  /** Adds any geometry (it is copied and moved into place). */
  add(name: string, geometry: THREE.BufferGeometry, color: ColorName, o: PartOptions = {}): this {
    const layer = o.layer ?? "body";
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    g.deleteAttribute("normal");
    g.deleteAttribute("uv");
    const m = new THREE.Matrix4();
    const r = o.rot ?? [0, 0, 0];
    if (o.q) m.makeRotationFromQuaternion(o.q);
    else m.makeRotationFromEuler(new THREE.Euler(r[0], r[1], r[2], "XYZ"));
    const at = o.at ?? [0, 0, 0];
    m.setPosition(at[0] + this.shift.x, at[1] + this.shift.y, at[2] + this.shift.z);
    g.applyMatrix4(m);
    const shaded = !(layer === "glow" || layer === "blinkA" || layer === "blinkB" || layer === "flame" || layer === "light");
    this.parts[layer].push({ name, geometry: g, hex: this.color(color), shaded });
    return this;
  }

  // ------------------------------------------------------------ anchors and animation

  /** A named point. `dir` = the way it faces (default: forward, -Z). */
  anchor(name: string, at: readonly [number, number, number], dir: readonly [number, number, number] = [0, 0, -1]): this {
    this.anchors[name] = { pos: new THREE.Vector3(...at).add(this.shift), dir: new THREE.Vector3(...dir).normalize() };
    return this;
  }

  /** A named point with a size (cockpit screens): `dir` = the way the screen faces. */
  screenAnchor(name: string, at: readonly [number, number, number], dir: readonly [number, number, number], w: number, h: number): this {
    this.anchor(name, at, dir);
    this.anchors[name]!.size = { w, h };
    return this;
  }

  /**
   * Cockpits: a wall at z (zFront to zBack, zFront < zBack) filling the rectangle `outer` (x0, y0, x1, y1)
   * except for the window `hole` (a convex shape, counter-clockwise points). Built from flat wedges around the hole.
   * Records the opening so the checker can make sure nothing blocks it.
   */
  windowWall(
    name: string,
    hole: readonly [number, number][],
    outer: readonly [number, number, number, number],
    zFront: number,
    zBack: number,
    color: ColorName,
  ): this {
    const [x0, y0, x1, y1] = outer;
    const cx = hole.reduce((a, p) => a + p[0], 0) / hole.length;
    const cy = hole.reduce((a, p) => a + p[1], 0) / hole.length;
    const corners: [number, number][] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const ang = (p: readonly [number, number]): number => Math.atan2(p[1] - cy, p[0] - cx);
    const dirs = [...hole.map(ang), ...corners.map(ang)].map((a) => (a + Math.PI * 2) % (Math.PI * 2)).sort((a, b) => a - b);
    const uniq = dirs.filter((a, i) => i === 0 || a - dirs[i - 1]! > 1e-6);
    // Where a ray from the hole's middle at angle a leaves a convex shape (given as a closed point list).
    const hit = (shape: readonly (readonly [number, number])[], a: number): [number, number] => {
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      let best = Infinity;
      for (let i = 0; i < shape.length; i++) {
        const p = shape[i]!;
        const q = shape[(i + 1) % shape.length]!;
        const ex = q[0] - p[0];
        const ey = q[1] - p[1];
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-12) continue;
        const t = ((p[0] - cx) * ey - (p[1] - cy) * ex) / den;
        const u = ((p[0] - cx) * dy - (p[1] - cy) * dx) / den;
        if (t > 1e-9 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.min(best, t);
      }
      return [cx + dx * best, cy + dy * best];
    };
    for (let i = 0; i < uniq.length; i++) {
      const a = uniq[i]!;
      const b = uniq[(i + 1) % uniq.length]!;
      let quad: [number, number][] = [hit(hole, a), hit(hole, b), hit(corners, b), hit(corners, a)];
      const area = quad.reduce((s, p, j) => {
        const q = quad[(j + 1) % 4]!;
        return s + p[0] * q[1] - q[0] * p[1];
      }, 0);
      if (area < 0) quad = quad.reverse();
      if (Math.abs(area) > 1e-6) this.prism(`${name} ${i + 1}`, quad, zFront, zBack, color);
    }
    this.windowOpening(name, hole.map((p) => [p[0], p[1], zBack] as [number, number, number]));
    return this;
  }

  /** From now on, move everything that is built (parts, anchors, openings, levers) by (x, y, z). */
  moveAll(x: number, y: number, z: number): this {
    this.shift.set(x, y, z);
    return this;
  }

  /** Records a window opening (a ring of 3D points). Nothing is built: an opening is empty space. */
  windowOpening(name: string, points: readonly (readonly [number, number, number])[]): this {
    const d = this.shift;
    this.windows.push({ name, points: points.map((p) => [p[0] + d.x, p[1] + d.y, p[2] + d.z] as [number, number, number]) });
    return this;
  }

  /** A square beam (pillar, strut, rail) from point a to point b, `t` thick. */
  beam(name: string, a: readonly [number, number, number], b: readonly [number, number, number], t: number, color: ColorName, o: { layer?: Layer } = {}): this {
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    const mid = A.clone().add(B).multiplyScalar(0.5);
    return this.add(name, new THREE.BoxGeometry(t, len, t), color, { at: [mid.x, mid.y, mid.z], q, layer: o.layer });
  }

  /** Any convex solid from a list of corner points (faces always point outwards). */
  convex(name: string, points: readonly (readonly [number, number, number])[], color: ColorName, o: { layer?: Layer } = {}): this {
    return this.add(name, new ConvexGeometry(points.map((p) => new THREE.Vector3(...p))), color, { layer: o.layer });
  }

  /** A flat slab: a 4-point face pushed `t` along `push` (the outward direction). */
  slab(name: string, face: readonly (readonly [number, number, number])[], push: readonly [number, number, number], t: number, color: ColorName): this {
    const n = new THREE.Vector3(...push).normalize().multiplyScalar(t);
    const pts = face.flatMap((p) => [p, [p[0] + n.x, p[1] + n.y, p[2] + n.z] as const]);
    return this.convex(name, pts, color);
  }

  /**
   * A lever or joystick: built by `build` around its own pivot (0, 0, 0), placed at `pivot`, turning around `axis`.
   * Its meshes share the model's material. The game may turn it up to `maxAngle` radians.
   */
  lever(name: string, pivot: readonly [number, number, number], axis: readonly [number, number, number], maxAngle: number, build: (k: ModelKit) => void): this {
    this.leverSpecs.push({ name, pivot: new THREE.Vector3(...pivot).add(this.shift), axis: new THREE.Vector3(...axis).normalize(), maxAngle, build });
    return this;
  }

  /** Where the flame layer starts (flames grow backwards from here). All engine exits share this z. */
  flameOrigin(at: readonly [number, number, number]): this {
    this.origins.flame = new THREE.Vector3(...at);
    return this;
  }

  /** The point the ring layer spins around, its axis and speed (radians per second). */
  spin(at: readonly [number, number, number], axis: readonly [number, number, number], speed: number): this {
    this.origins.ring = new THREE.Vector3(...at);
    this.spinAxis = new THREE.Vector3(...axis).normalize();
    this.spinSpeed = speed;
    return this;
  }

  // ------------------------------------------------------------ finish

  finish(): AssetModel {
    const group = new THREE.Group();
    const material = makeAssetMaterial();
    const animation: AssetAnimation = { blinkers: [], spinners: [], flames: [], levers: [] };

    const make = (layers: Layer[], label: string, origin?: THREE.Vector3): THREE.Mesh | null => {
      const list = layers.flatMap((l) => this.parts[l]);
      if (list.length === 0) return null;
      const mesh = new THREE.Mesh(mergeParts(list, origin), material);
      mesh.name = label;
      if (origin) mesh.position.copy(origin);
      group.add(mesh);
      return mesh;
    };

    make(["body", "glow"], "body");
    for (const g of ["A", "B"] as const) {
      const mesh = make([g === "A" ? "blinkA" : "blinkB"], `blink${g}`);
      if (mesh) animation.blinkers.push({ mesh, group: g });
    }
    const flame = make(["flame"], "flame", this.origins.flame ?? new THREE.Vector3());
    if (flame) {
      flame.scale.z = FLAME_PARKED;
      animation.flames.push(flame);
    }
    const ring = make(["ring"], "ring", this.origins.ring ?? new THREE.Vector3());
    for (const spec of this.leverSpecs) {
      const sub = new ModelKit({ tint: this.tint });
      spec.build(sub);
      const part = sub.finish();
      const mesh = part.group.children[0] as THREE.Mesh;
      (mesh.material as THREE.Material).dispose();
      mesh.material = material;
      mesh.name = spec.name;
      mesh.position.copy(spec.pivot);
      group.add(mesh);
      animation.levers.push({ object: mesh, axis: spec.axis, maxAngle: spec.maxAngle });
    }
    let windowLight: THREE.Mesh | undefined;
    if (this.parts.light.length > 0) {
      windowLight = new THREE.Mesh(mergeParts(this.parts.light), makeAssetMaterial());
      windowLight.name = "windowLight";
      group.add(windowLight);
    }
    if (ring && this.spinSpeed !== 0) animation.spinners.push({ object: ring, axis: this.spinAxis, speed: this.spinSpeed });

    const startQuats = animation.spinners.map((s) => s.object.quaternion.clone());
    const q = new THREE.Quaternion();
    const update = (t: number): void => {
      const phase = ((t % BLINK_PERIOD) + BLINK_PERIOD) % BLINK_PERIOD;
      const aOn = phase < BLINK_ON;
      for (const b of animation.blinkers) b.mesh.visible = b.group === "A" ? aOn : !aOn;
      animation.spinners.forEach((s, i) => {
        q.setFromAxisAngle(s.axis, s.speed * t);
        s.object.quaternion.copy(startQuats[i]!).premultiply(q);
      });
    };
    update(0);
    const model: AssetModel = { group, anchors: this.anchors, animation, update };
    if (this.windows.length > 0) model.windowOpenings = this.windows;
    if (windowLight) model.windowLight = windowLight;
    return model;
  }
}

/** Merges parts into one geometry with two colour sets: `color` (shaded) and `baseColor` (flat, for the viewer). */
function mergeParts(list: PendingPart[], origin?: THREE.Vector3): THREE.BufferGeometry {
  let total = 0;
  for (const p of list) total += p.geometry.getAttribute("position").count;
  const pos = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  const base = new Float32Array(total * 3);
  const infos: PartInfo[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const colr = new THREE.Color();
  let v = 0;
  for (const p of list) {
    const src = p.geometry.getAttribute("position");
    colr.setHex(p.hex);
    infos.push({ name: p.name, start: v / 3, count: src.count / 3 });
    for (let i = 0; i + 2 < src.count; i += 3) {
      a.fromBufferAttribute(src, i);
      b.fromBufferAttribute(src, i + 1);
      c.fromBufferAttribute(src, i + 2);
      n.subVectors(b, a).cross(c.clone().sub(a)).normalize();
      const s = p.shaded ? shadeFor(n) : 1;
      for (const corner of [a, b, c]) {
        pos[v * 3] = corner.x - (origin?.x ?? 0);
        pos[v * 3 + 1] = corner.y - (origin?.y ?? 0);
        pos[v * 3 + 2] = corner.z - (origin?.z ?? 0);
        col[v * 3] = colr.r * s;
        col[v * 3 + 1] = colr.g * s;
        col[v * 3 + 2] = colr.b * s;
        base[v * 3] = colr.r;
        base[v * 3 + 1] = colr.g;
        base[v * 3 + 2] = colr.b;
        v++;
      }
    }
    p.geometry.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("baseColor", new THREE.BufferAttribute(base, 3));
  g.userData.parts = infos;
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
