// The Cargo Hauler: a small low-poly ship built from boxes. Nothing downloaded.
// Flat look: every face gets one of four brightness steps, baked into the shape (no lights needed).

import * as THREE from "three";
import { faceShade } from "./helpers";

const LIGHT = new THREE.Vector3(0.4, 0.8, 0.45).normalize();

/** Gives every triangle a flat color from a main color and a fixed light direction. */
export function shadedGeometry(source: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  source.dispose();
  const position = geometry.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  const base = new THREE.Color(hex);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i + 2 < position.count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1);
    c.fromBufferAttribute(position, i + 2);
    n.subVectors(b, a).cross(c.sub(a)).normalize();
    const shade = 0.4 + 0.6 * faceShade(n.dot(LIGHT));
    for (let k = 0; k < 3; k++) {
      colors[(i + k) * 3] = base.r * shade;
      colors[(i + k) * 3 + 1] = base.g * shade;
      colors[(i + k) * 3 + 2] = base.b * shade;
    }
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function part(geometry: THREE.BufferGeometry, hex: number, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(shadedGeometry(geometry, hex), new THREE.MeshBasicMaterial({ vertexColors: true }));
  mesh.position.set(x, y, z);
  return mesh;
}

export interface ShipModel {
  group: THREE.Group;
  /** The glowing engine flames. Make them longer (scale.z) for warp. */
  flames: THREE.Mesh[];
}

/** The ship points towards -Z (forward). It is about 4.7 units long. */
export function buildCargoHauler(): ShipModel {
  const group = new THREE.Group();

  group.add(part(new THREE.BoxGeometry(0.9, 0.55, 1.8), 0x8d99c9, 0, 0, 0.1)); // main body
  const nose = new THREE.ConeGeometry(0.45, 0.9, 4);
  nose.rotateX(-Math.PI / 2); // point forward
  nose.rotateY(Math.PI / 4);
  group.add(part(nose, 0xc9d0f2, 0, 0, -1.25));
  group.add(part(new THREE.BoxGeometry(0.26, 0.26, 2.4), 0x4a4f78, 0, 0, 1.7)); // spine
  group.add(part(new THREE.BoxGeometry(0.95, 0.75, 0.65), 0xff8a3d, 0, 0, 1.2)); // cargo container 1
  group.add(part(new THREE.BoxGeometry(0.95, 0.75, 0.65), 0x3dd6c6, 0, 0, 1.95)); // cargo container 2
  group.add(part(new THREE.BoxGeometry(2.3, 0.07, 0.7), 0x6b77b5, 0, -0.05, 0.35)); // wings
  group.add(part(new THREE.BoxGeometry(0.32, 0.32, 0.55), 0x4a4f78, -0.3, 0, 2.55)); // engine left
  group.add(part(new THREE.BoxGeometry(0.32, 0.32, 0.55), 0x4a4f78, 0.3, 0, 2.55)); // engine right

  const flames: THREE.Mesh[] = [];
  for (const x of [-0.3, 0.3]) {
    const geometry = new THREE.BoxGeometry(0.2, 0.2, 1);
    geometry.translate(0, 0, 0.5); // grows backwards when scaled
    const flame = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffb347 }));
    flame.position.set(x, 0, 2.83);
    flames.push(flame);
    group.add(flame);
  }
  return { group, flames };
}
