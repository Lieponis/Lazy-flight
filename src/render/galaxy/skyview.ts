// THE SKY ON SCREEN (prototype G2). Draws the soft sky glow and the back-drop dots behind everything else.
//
// Plain words: the sky sits "at infinity": it only turns with the camera, it never gets closer when the camera moves. It is
// drawn first in its own little scene, then the map is drawn on top. The glow is a big box around the camera; a small shader
// works out, for every screen pixel, which direction it looks in, and mixes the 4 nearest squares of the sky (the ring layout of
// skysphere.ts) so the glow is smooth and round, never made of visible squares. The dots are drawn on top, one pixel each.

import * as THREE from "three";
import { ringCountsData, ringsToRows, type RingLayout } from "./skysphere";
import { PEAK_RGB, SPACE_RGB } from "./skylook";
import type { FaintStars } from "./skystars";

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// This does the same sum as sampleRings in skysphere.ts (the tests and my offline pictures use that one).
const SKY_FRAGMENT = /* glsl */ `
  uniform sampler2D uSky;     // one row per ring: red, green, blue = tint, alpha = brightness level
  uniform sampler2D uCounts;  // one texel per ring: squares in that ring (red = low 8 bits, green = high bits)
  uniform float uRings;
  uniform float uGlow;
  uniform vec3 uSpace;
  uniform vec3 uPeak;
  varying vec3 vDir;
  const float PI = 3.14159265358979;

  vec4 ringSample(float ring, float lonFrac) {
    ring = clamp(ring, 0.0, uRings - 1.0);
    vec4 c = texelFetch(uCounts, ivec2(int(ring), 0), 0);
    float n = floor(c.r * 255.0 + 0.5) + 256.0 * floor(c.g * 255.0 + 0.5);
    float f = lonFrac * n - 0.5;
    float i0 = floor(f);
    float t = f - i0;
    float a = mod(i0 + n, n);
    float b = mod(i0 + 1.0 + n, n);
    vec4 ta = texelFetch(uSky, ivec2(int(a), int(ring)), 0);
    vec4 tb = texelFetch(uSky, ivec2(int(b), int(ring)), 0);
    return mix(ta, tb, t);
  }

  void main() {
    vec3 d = normalize(vDir);
    float lat = asin(clamp(d.y, -1.0, 1.0));
    float lon = atan(d.z, d.x);
    if (lon < 0.0) lon += 2.0 * PI;
    float fr = (lat + 0.5 * PI) / PI * uRings - 0.5;
    float r0 = floor(fr);
    float lonFrac = lon / (2.0 * PI);
    vec4 tex = mix(ringSample(r0, lonFrac), ringSample(r0 + 1.0, lonFrac), fr - r0);
    float level = tex.a * uGlow;
    gl_FragColor = vec4(uSpace + (uPeak * tex.rgb - uSpace) * level, 1.0);
  }
`;

const STAR_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    gl_PointSize = 1.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position * 100.0, 1.0);
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  uniform float uDim;  // 1 = the dots' own colours (the galaxy map); less = fainter (the system view's backdrop)
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor * uDim, 1.0);
  }
`;

export class SkyView {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 16 / 9, 1, 400);

  private readonly dome: THREE.Mesh;
  private readonly domeMaterial: THREE.ShaderMaterial;
  private readonly starPoints: THREE.Points;
  private texture: THREE.DataTexture | null = null;
  private countsTexture: THREE.DataTexture | null = null;
  private layout: RingLayout | null = null;
  private glowOn = true;
  private readonly starMaterial: THREE.ShaderMaterial;

  constructor() {
    this.domeMaterial = new THREE.ShaderMaterial({
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      uniforms: {
        uSky: { value: null },
        uCounts: { value: null },
        uRings: { value: 1 },
        uGlow: { value: 0 },
        uSpace: { value: new THREE.Vector3(SPACE_RGB[0] / 255, SPACE_RGB[1] / 255, SPACE_RGB[2] / 255) },
        uPeak: { value: new THREE.Vector3(PEAK_RGB[0] / 255, PEAK_RGB[1] / 255, PEAK_RGB[2] / 255) },
      },
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
    });
    this.dome = new THREE.Mesh(new THREE.BoxGeometry(200, 200, 200), this.domeMaterial);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = 0;
    this.dome.visible = false; // nothing to show until the first sky is built
    this.scene.add(this.dome);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(0), 3));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(0), 3));
    this.starMaterial = new THREE.ShaderMaterial({
      vertexShader: STAR_VERTEX,
      fragmentShader: STAR_FRAGMENT,
      uniforms: { uDim: { value: 1 } },
      depthTest: false,
      depthWrite: false,
    });
    this.starPoints = new THREE.Points(geometry, this.starMaterial);
    this.starPoints.frustumCulled = false;
    this.starPoints.renderOrder = 1; // after the glow
    this.scene.add(this.starPoints);
  }

  /** Puts a freshly built sky glow on the GPU. `flat` = 4 bytes per square (see skyToTexels), ring after ring. */
  setTexels(flat: Uint8Array, layout: RingLayout): void {
    const same = this.layout !== null && this.layout.rings === layout.rings && this.layout.maxCount === layout.maxCount && this.layout.total === layout.total;
    const rows = ringsToRows(flat, layout, same ? (this.texture?.image.data as Uint8Array) : undefined);
    if (!same || !this.texture || !this.countsTexture) {
      this.texture?.dispose();
      this.countsTexture?.dispose();
      this.texture = makeTexture(rows, layout.maxCount, layout.rings);
      this.countsTexture = makeTexture(ringCountsData(layout), layout.rings, 1);
      this.layout = layout;
      this.domeMaterial.uniforms.uSky.value = this.texture;
      this.domeMaterial.uniforms.uCounts.value = this.countsTexture;
      this.domeMaterial.uniforms.uRings.value = layout.rings;
    } else {
      this.texture.needsUpdate = true;
    }
    this.refreshDome();
  }

  /** How strong the soft glow under the dots is (0..1). */
  setGlowStrength(strength: number): void {
    this.domeMaterial.uniforms.uGlow.value = strength;
    this.refreshDome();
  }

  /** How bright the dots are, 0..1 (1 = their own colours, the default). A faint backdrop uses a small number. */
  setDim(dim: number): void {
    this.starMaterial.uniforms.uDim.value = Math.max(0, Math.min(1, Number.isFinite(dim) ? dim : 1));
  }

  /** The dot brightness now (0..1). */
  get dim(): number {
    return this.starMaterial.uniforms.uDim.value as number;
  }

  /** The glow box is only drawn when it has something to show (a built sky, switched on, strength above 0). */
  private refreshDome(): void {
    this.dome.visible = this.glowOn && this.texture !== null && (this.domeMaterial.uniforms.uGlow.value as number) > 0;
  }

  /** The back-drop dots (unit directions plus colours). */
  setStars(stars: FaintStars): void {
    const g = this.starPoints.geometry;
    g.setAttribute("position", new THREE.BufferAttribute(stars.dirs, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(stars.colors, 3));
    g.setDrawRange(0, stars.count);
    g.computeBoundingSphere();
  }

  setVisible(glow: boolean, dots: boolean): void {
    this.glowOn = glow;
    this.refreshDome();
    this.starPoints.visible = dots;
  }

  private turnBack = new THREE.Quaternion(); // undoes the sky's own turn (see setTurn); no turn = does nothing

  /**
   * Turns the whole sky about the sideways (x) line by `angle` radians, as a station going round its planet sees it (stage 3o).
   * 0 = the sky as it always was. Whoever sets a turn must put it back to 0 when its screen is left, because screens can share one sky.
   */
  setTurn(angle: number): void {
    if (angle === 0 || !Number.isFinite(angle)) this.turnBack.identity();
    else this.turnBack.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -angle);
  }

  /** Copies the way the map camera is turned, so the sky looks the same way (the sky camera never moves). */
  follow(camera: THREE.PerspectiveCamera): void {
    this.camera.quaternion.copy(this.turnBack).multiply(camera.quaternion);
    this.camera.fov = camera.fov;
    this.camera.aspect = camera.aspect;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  dispose(): void {
    this.texture?.dispose();
    this.countsTexture?.dispose();
    this.domeMaterial.dispose();
    this.dome.geometry.dispose();
    this.starPoints.geometry.dispose();
    this.starMaterial.dispose();
  }
}

/** A small RGBA texture that is looked up exactly (no smoothing by the graphics card: the shader mixes the squares itself). */
function makeTexture(data: Uint8Array, width: number, height: number): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
