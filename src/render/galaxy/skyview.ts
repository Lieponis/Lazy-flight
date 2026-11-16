// THE SKY ON SCREEN (prototype G2). Draws the sky cube and the faint stars behind everything else.
//
// Plain words: the sky sits "at infinity": it only turns with the camera, it never gets closer when the camera moves. It is
// drawn first in its own little scene, then the map is drawn on top. The glow is a big box around the camera; a small shader
// looks up the right texel of the sky cube for every screen pixel (nearest texel, no smoothing: chunky pixels), then applies
// the brightness steps and dot pattern of the chosen look.

import * as THREE from "three";
import { BAYER4, PEAK_RGB, SPACE_RGB, type SkyLook } from "./skylook";
import type { FaintStars } from "./skystars";

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// The face table below is the same as faceDirection / directionToFace in skycube.ts.
const SKY_FRAGMENT = /* glsl */ `
  uniform sampler2D uSky;
  uniform float uFace;
  uniform float uSteps;
  uniform float uDither;
  uniform float uHeight;
  uniform vec3 uSpace;
  uniform vec3 uPeak;
  varying vec3 vDir;
  const float BAYER[16] = float[16](${BAYER4.map((n) => `${n}.0`).join(", ")});
  void main() {
    vec3 d = vDir;
    vec3 a = abs(d);
    float face;
    vec2 uv;
    if (a.x >= a.y && a.x >= a.z) {
      if (d.x > 0.0) { face = 0.0; uv = vec2(-d.z, -d.y) / a.x; } else { face = 1.0; uv = vec2(d.z, -d.y) / a.x; }
    } else if (a.y >= a.z) {
      if (d.y > 0.0) { face = 2.0; uv = vec2(d.x, d.z) / a.y; } else { face = 3.0; uv = vec2(d.x, -d.z) / a.y; }
    } else {
      if (d.z > 0.0) { face = 4.0; uv = vec2(d.x, -d.y) / a.z; } else { face = 5.0; uv = vec2(-d.x, -d.y) / a.z; }
    }
    vec2 t = clamp(uv * 0.5 + 0.5, 0.0, 0.9999);
    t = (floor(t * uFace) + 0.5) / uFace;
    vec4 tex = texture2D(uSky, vec2(t.x, (face + t.y) / 6.0));
    float level = tex.a;
    if (uSteps > 0.5) {
      float px = floor(gl_FragCoord.x);
      float py = uHeight - 1.0 - floor(gl_FragCoord.y);
      float threshold = 0.5;
      if (uDither > 0.5) {
        int idx = int(mod(py, 4.0)) * 4 + int(mod(px, 4.0));
        threshold = (BAYER[idx] + 0.5) / 16.0;
      }
      level = min(1.0, floor(level * uSteps + threshold) / uSteps);
    }
    vec3 colour = uSpace + (uPeak * tex.rgb - uSpace) * level;
    gl_FragColor = vec4(colour, 1.0);
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
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, 1.0);
  }
`;

export class SkyView {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 16 / 9, 1, 400);

  private readonly dome: THREE.Mesh;
  private readonly domeMaterial: THREE.ShaderMaterial;
  private readonly starPoints: THREE.Points;
  private texture: THREE.DataTexture | null = null;
  private faceSize = 0;

  constructor() {
    this.domeMaterial = new THREE.ShaderMaterial({
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      uniforms: {
        uSky: { value: null },
        uFace: { value: 1 },
        uSteps: { value: 0 },
        uDither: { value: 0 },
        uHeight: { value: 180 },
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
    this.starPoints = new THREE.Points(
      geometry,
      new THREE.ShaderMaterial({ vertexShader: STAR_VERTEX, fragmentShader: STAR_FRAGMENT, depthTest: false, depthWrite: false }),
    );
    this.starPoints.frustumCulled = false;
    this.starPoints.renderOrder = 1; // after the glow
    this.scene.add(this.starPoints);
  }

  /** Puts a freshly built sky cube on the GPU. `texels` = 4 bytes per texel (see skyToTexels), 6 faces stacked. */
  setTexels(texels: Uint8Array, faceSize: number): void {
    if (!this.texture || this.faceSize !== faceSize) {
      this.texture?.dispose();
      const texture = new THREE.DataTexture(texels, faceSize, faceSize * 6, THREE.RGBAFormat, THREE.UnsignedByteType);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
      this.texture = texture;
      this.faceSize = faceSize;
      this.domeMaterial.uniforms.uSky.value = texture;
      this.domeMaterial.uniforms.uFace.value = faceSize;
    } else {
      this.texture.image.data.set(texels);
      this.texture.needsUpdate = true;
    }
    this.dome.visible = true;
  }

  /** Brightness steps and dot pattern of the chosen look. */
  setLook(look: SkyLook): void {
    this.domeMaterial.uniforms.uSteps.value = look.steps;
    this.domeMaterial.uniforms.uDither.value = look.dither ? 1 : 0;
  }

  /** The faint single stars (unit directions plus colours). */
  setStars(stars: FaintStars): void {
    const g = this.starPoints.geometry;
    g.setAttribute("position", new THREE.BufferAttribute(stars.dirs, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(stars.colors, 3));
    g.setDrawRange(0, stars.count);
    g.computeBoundingSphere();
  }

  setVisible(glow: boolean, dots: boolean): void {
    this.dome.visible = glow && this.texture !== null;
    this.starPoints.visible = dots;
  }

  /** Copies the way the map camera is turned, so the sky looks the same way (the sky camera never moves). */
  follow(camera: THREE.PerspectiveCamera, height: number): void {
    this.camera.quaternion.copy(camera.quaternion);
    this.camera.fov = camera.fov;
    this.camera.aspect = camera.aspect;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.domeMaterial.uniforms.uHeight.value = height;
  }

  dispose(): void {
    this.texture?.dispose();
    this.domeMaterial.dispose();
    this.dome.geometry.dispose();
    this.starPoints.geometry.dispose();
    (this.starPoints.material as THREE.Material).dispose();
  }
}
