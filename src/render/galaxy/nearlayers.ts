// THE NEAR STARS ON SCREEN (prototype G2): diamonds for systems inside the ship's reach, coloured pixels for the rest.
//
// Plain words: both layers are one single draw call each, however many stars there are (the GPU draws them all at once).
// The diamonds are the nearest stars (the list is sorted nearest first), the pixels are all the others. A pixel is brighter
// and a little bigger the closer the star is to the player.

import * as THREE from "three";
import { diamondSize } from "./previewmath";
import type { NearStars } from "./neardata";

/** The most diamonds the page can ever draw (memory is reserved once). */
export const MAX_DIAMONDS = 20000;

const PIXEL_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aDist;
  uniform float uFar;
  uniform float uBig;
  varying vec3 vColor;
  void main() {
    float x = clamp(aDist / uFar, 0.0, 1.0);
    vColor = aColor * (1.0 - 0.82 * pow(x, 0.6));
    gl_PointSize = aDist < uBig ? 2.0 : 1.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PIXEL_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, 1.0);
  }
`;

export interface NearCounts {
  /** Stars drawn as diamonds. */
  diamonds: number;
  /** Stars drawn as pixels. */
  pixels: number;
  /** Triangles in the diamonds (8 each). */
  triangles: number;
}

export class NearLayers {
  readonly group = new THREE.Group();
  private readonly diamonds: THREE.InstancedMesh;
  private readonly pixels: THREE.Points;
  private readonly pixelMaterial: THREE.ShaderMaterial;
  private readonly matrix = new THREE.Matrix4();
  private readonly color = new THREE.Color();

  constructor() {
    this.diamonds = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_DIAMONDS);
    this.diamonds.frustumCulled = false;
    this.diamonds.count = 0;
    // Make sure the colour buffer exists before the first draw.
    this.diamonds.setColorAt(0, this.color.setRGB(1, 1, 1));
    this.group.add(this.diamonds);

    this.pixelMaterial = new THREE.ShaderMaterial({
      vertexShader: PIXEL_VERTEX,
      fragmentShader: PIXEL_FRAGMENT,
      uniforms: { uFar: { value: 1 }, uBig: { value: 0 } },
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(0), 3));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(0), 3));
    geometry.setAttribute("aDist", new THREE.BufferAttribute(new Float32Array(0), 1));
    this.pixels = new THREE.Points(geometry, this.pixelMaterial);
    this.pixels.frustumCulled = false;
    this.group.add(this.pixels);
  }

  /** Fills both layers: stars 0..k-1 (inside `reachLy`, at most `diamondCap`) become diamonds, the rest pixels. */
  setStars(stars: NearStars, withinReach: number, diamondCap: number): NearCounts {
    const k = Math.min(withinReach, diamondCap, MAX_DIAMONDS);
    for (let i = 0; i < k; i++) {
      const s = diamondSize(stars.radii[i] ?? 1);
      this.matrix.makeScale(s, s, s);
      this.matrix.setPosition(stars.positions[i * 3] ?? 0, stars.positions[i * 3 + 1] ?? 0, stars.positions[i * 3 + 2] ?? 0);
      this.diamonds.setMatrixAt(i, this.matrix);
      // The colours are the game's hex colours, so they are given in the sRGB colour space (the same as `setHex` does).
      this.diamonds.setColorAt(i, this.color.setRGB(stars.colors[i * 3] ?? 1, stars.colors[i * 3 + 1] ?? 1, stars.colors[i * 3 + 2] ?? 1, THREE.SRGBColorSpace));
    }
    this.diamonds.count = k;
    this.diamonds.instanceMatrix.needsUpdate = true;
    if (this.diamonds.instanceColor) this.diamonds.instanceColor.needsUpdate = true;

    const g = this.pixels.geometry;
    g.setAttribute("position", new THREE.BufferAttribute(stars.positions, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(stars.colors, 3));
    g.setAttribute("aDist", new THREE.BufferAttribute(stars.distances, 1));
    g.setDrawRange(k, Math.max(0, stars.count - k));
    this.pixelMaterial.uniforms.uFar.value = stars.radius;
    this.pixelMaterial.uniforms.uBig.value = stars.radius * 0.22;
    return { diamonds: k, pixels: Math.max(0, stars.count - k), triangles: k * 8 };
  }

  setVisible(pixels: boolean, diamonds: boolean): void {
    this.pixels.visible = pixels;
    this.diamonds.visible = diamonds;
  }

  dispose(): void {
    this.diamonds.geometry.dispose();
    (this.diamonds.material as THREE.Material).dispose();
    this.diamonds.dispose();
    this.pixels.geometry.dispose();
    this.pixelMaterial.dispose();
  }
}
