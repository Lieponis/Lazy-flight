// Small pictures of the ships for the Shipyard. Each ship is built and drawn ONCE into a tiny picture
// (pixel look), then the 3D drawing tool is thrown away so it does not use memory or a second 3D context.
// Same idea as thumbnail() in src/models.ts.

import * as THREE from "three";
import { buildShipModel } from "../render/models3d";
import { boundsOf } from "../render/assets";
import { orbitCameraPosition } from "../render/helpers";
import { disposeAll } from "../render/systemview";

const W = 96; // tiny on purpose: shown twice as big with hard pixel edges
const H = 64;
const cache = new Map<string, string>(); // ship id -> picture (as a data address)

/** Draws every listed ship that is not drawn yet. Returns the pictures. Never throws (no 3D: no pictures). */
export function shipPictures(shipIds: readonly string[]): Map<string, string> {
  const missing = shipIds.filter((id) => !cache.has(id));
  if (missing.length === 0) return cache;
  let renderer: THREE.WebGLRenderer | null = null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: "low-power" });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x05060d);
    for (const id of missing) {
      const scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const sun = new THREE.DirectionalLight(0xffffff, 1.6);
      sun.position.set(3, 5, 4);
      scene.add(sun);
      const model = buildShipModel(id);
      model.update(0);
      scene.add(model.group);
      const box = boundsOf(model);
      const size = box.getSize(new THREE.Vector3());
      const mid = box.getCenter(new THREE.Vector3());
      const camera = new THREE.PerspectiveCamera(35, W / H, 0.05, 1000);
      const p = orbitCameraPosition(2.3, 0.45, Math.max(size.x, size.y, size.z) * 1.6 + 1);
      camera.position.set(mid.x + p.x, mid.y + p.y, mid.z + p.z);
      camera.lookAt(mid);
      renderer.render(scene, camera);
      cache.set(id, renderer.domElement.toDataURL("image/png"));
      disposeAll(model.group);
    }
  } catch {
    // No 3D available: the shipyard simply shows no pictures.
  } finally {
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
    }
  }
  return cache;
}
