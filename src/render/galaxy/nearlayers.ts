// THE NEAR STARS ON SCREEN (prototype G2): diamonds for systems inside the ship's reach, plus a coloured pixel for EVERY star.
//
// Plain words: both layers are one single draw call each, however many stars there are (the GPU draws them all at once).
// The diamonds are the nearest stars (the list is sorted nearest first). A diamond is always the same size in space (about
// 0.7 light years across), wherever in the galaxy you are, so far away it shrinks below one pixel; that is why every star also
// has a pixel: the pixel is hidden inside its diamond when you are close, and stays visible when the diamond is too small to see.
// A pixel is brighter and a little bigger the closer the star is to the player, and every star fades to nothing at the edge of
// the near-star bubble, so the bubble has no visible edge.

import * as THREE from "three";
import { diamondSize, EDGE_FADE_START, edgeFade } from "./previewmath";
import type { NearStars } from "./neardata";

/** The most diamonds the page can ever draw (memory is reserved once; one more slot is kept for a tapped star). */
export const MAX_DIAMONDS = 20000;

const PIXEL_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aDist;
  uniform float uFar;
  uniform float uBig;
  varying vec3 vColor;
  void main() {
    float x = clamp(aDist / uFar, 0.0, 1.0);
    float fade = 1.0 - smoothstep(${EDGE_FADE_START.toFixed(2)}, 1.0, x);
    vColor = aColor * (1.0 - 0.82 * pow(x, 0.6)) * fade;
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
  /** Stars drawn as pixels (every star has one). */
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
  /** How many stars are diamonds because they are in reach (the tapped star may be one more). */
  private reachDiamonds = 0;

  constructor() {
    this.diamonds = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_DIAMONDS + 1);
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

  /** Fills both layers: stars 0..k-1 (inside the reach, at most `diamondCap`) become diamonds; all stars get a pixel. */
  setStars(stars: NearStars, withinReach: number, diamondCap: number): NearCounts {
    const counts = this.setDiamonds(stars, withinReach, diamondCap);
    const g = this.pixels.geometry;
    g.setAttribute("position", new THREE.BufferAttribute(stars.positions, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(stars.colors, 3));
    g.setAttribute("aDist", new THREE.BufferAttribute(stars.distances, 1));
    g.setDrawRange(0, stars.count);
    this.pixelMaterial.uniforms.uFar.value = stars.radius;
    this.pixelMaterial.uniforms.uBig.value = stars.radius * 0.22;
    return counts;
  }

  /**
   * Only the diamonds again (the stars are the same, the ship's reach or the cap changed): cheap, the pixels are left alone.
   * Call `setStars` first.
   */
  setDiamonds(stars: NearStars, withinReach: number, diamondCap: number): NearCounts {
    const k = Math.min(withinReach, diamondCap, MAX_DIAMONDS, stars.count);
    for (let i = 0; i < k; i++) {
      const s = diamondSize(stars.radii[i] ?? 1);
      this.matrix.makeScale(s, s, s);
      this.matrix.setPosition(stars.positions[i * 3] ?? 0, stars.positions[i * 3 + 1] ?? 0, stars.positions[i * 3 + 2] ?? 0);
      this.diamonds.setMatrixAt(i, this.matrix);
      // The colours are the game's hex colours, so they are given in the sRGB colour space (the same as `setHex` does).
      // A diamond near the edge of the bubble is darkened the same way its pixel is.
      const fade = edgeFade(stars.distances[i] ?? 0, stars.radius);
      this.diamonds.setColorAt(i, this.color.setRGB((stars.colors[i * 3] ?? 1) * fade, (stars.colors[i * 3 + 1] ?? 1) * fade, (stars.colors[i * 3 + 2] ?? 1) * fade, THREE.SRGBColorSpace));
    }
    this.diamonds.count = k;
    this.reachDiamonds = k;
    this.diamonds.instanceMatrix.needsUpdate = true;
    if (this.diamonds.instanceColor) this.diamonds.instanceColor.needsUpdate = true;
    return { diamonds: k, pixels: stars.count, triangles: k * 8 };
  }

  /**
   * Makes sure the tapped star is drawn as a diamond even when it lies outside the ship's reach (so zooming in on any star shows
   * a diamond, never just a pixel). `index` null = no tapped star.
   */
  setSelected(stars: NearStars, index: number | null): void {
    if (index === null || index < this.reachDiamonds || index >= stars.count) {
      this.diamonds.count = this.reachDiamonds;
      return;
    }
    const s = diamondSize(stars.radii[index] ?? 1);
    this.matrix.makeScale(s, s, s);
    this.matrix.setPosition(stars.positions[index * 3] ?? 0, stars.positions[index * 3 + 1] ?? 0, stars.positions[index * 3 + 2] ?? 0);
    this.diamonds.setMatrixAt(this.reachDiamonds, this.matrix);
    this.diamonds.setColorAt(this.reachDiamonds, this.color.setRGB(stars.colors[index * 3] ?? 1, stars.colors[index * 3 + 1] ?? 1, stars.colors[index * 3 + 2] ?? 1, THREE.SRGBColorSpace));
    this.diamonds.count = this.reachDiamonds + 1;
    this.diamonds.instanceMatrix.needsUpdate = true;
    if (this.diamonds.instanceColor) this.diamonds.instanceColor.needsUpdate = true;
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
