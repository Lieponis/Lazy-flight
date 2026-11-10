// THE COCKPIT LENS (decided by Andy, C1 step 2, option C): a wide view from the pilot's seat without the stretched
// edges of a normal flat picture.
//
// How it works, in plain words: the scene is first drawn as a normal (flat) picture into a hidden image, a little
// wider than needed. Then every pixel of the screen looks up its colour in that image through a "Panini" lens: the
// edges are pulled in, so things at the sides keep their shape. Upright lines stay straight; flat lines bend a
// little near the left and right edges. `strength` 0 = a normal flat picture, 1 = the full Panini lens.
//
// The extra work is one pass over the screen picture, which is tiny at the game's low resolution (phones are fine).
// For the game: the cockpit scene renders with `CockpitLens.render` instead of `renderer.render`.

import * as THREE from "three";

/** Side-to-side field of view from the pilot's seat, in degrees (Andy: about 70). */
export const COCKPIT_FOV = 70;
/** How strongly the lens pulls the edges in (Andy: a light correction). */
export const COCKPIT_LENS = 0.35;

/** Screen position (Panini plane) of a view direction at side angle `phi` (radians). */
export const paniniX = (phi: number, d: number): number => ((d + 1) * Math.sin(phi)) / (d + Math.cos(phi));

/** View direction (x right, y up, z forward, not normalised) for a point on the Panini plane. */
export function paniniDir(X: number, Y: number, d: number): [number, number, number] {
  const k = (X * X) / ((d + 1) * (d + 1));
  const disc = k * k * d * d - (k + 1) * (k * d * d - 1);
  const cosPhi = (-k * d + Math.sqrt(Math.max(0, disc))) / (k + 1);
  const phi = Math.sign(X) * Math.acos(Math.max(-1, Math.min(1, cosPhi)));
  const s = (d + Math.cos(phi)) / (d + 1);
  return [Math.sin(phi), Y * s, Math.cos(phi)];
}

export class CockpitLens {
  private target = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType });
  private wide = new THREE.PerspectiveCamera();
  private quadScene = new THREE.Scene();
  private quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material: THREE.ShaderMaterial;

  constructor(private renderer: THREE.WebGLRenderer) {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        src: { value: this.target.texture },
        extent: { value: new THREE.Vector2(1, 1) }, // Panini plane half size (X, Y) at the screen edges
        tanHalf: { value: new THREE.Vector2(1, 1) }, // the hidden flat picture's half size, as tangents
        d: { value: COCKPIT_LENS },
      },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: `
        uniform sampler2D src; uniform vec2 extent; uniform vec2 tanHalf; uniform float d;
        varying vec2 vUv;
        void main() {
          vec2 P = (vUv * 2.0 - 1.0) * extent;
          float k = P.x * P.x / ((d + 1.0) * (d + 1.0));
          float disc = k * k * d * d - (k + 1.0) * (k * d * d - 1.0);
          float cosPhi = clamp((-k * d + sqrt(max(disc, 0.0))) / (k + 1.0), -1.0, 1.0);
          float phi = sign(P.x) * acos(cosPhi);
          float s = (d + cos(phi)) / (d + 1.0);
          vec3 dir = vec3(sin(phi), P.y * s, cos(phi));
          vec2 uv = (dir.xy / dir.z) / tanHalf * 0.5 + 0.5;
          gl_FragColor = texture2D(src, uv);
          #include <colorspace_fragment>
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
  }

  /**
   * Draws `scene` as seen by `camera` (its position and direction are used; its own field of view is not) through the
   * lens, at the renderer's current size. `fov` = side to side in degrees on a wide screen (top to bottom on a tall
   * one); `strength` 0..1.
   */
  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, fov = COCKPIT_FOV, strength = COCKPIT_LENS): void {
    const size = this.renderer.getSize(new THREE.Vector2());
    const aspect = size.x / Math.max(1, size.y);
    const d = Math.max(0, Math.min(1, strength));
    const half = (fov * Math.PI) / 360;
    // The Panini plane's half size at the screen edges.
    let ex: number;
    let ey: number;
    if (aspect >= 1) {
      ex = paniniX(half, d);
      ey = ex / aspect;
    } else {
      ey = paniniX(half, d);
      ex = ey * aspect;
    }
    // How wide the hidden flat picture must be to cover every screen pixel: check the screen's edges.
    let tx = 0;
    let ty = 0;
    for (let i = 0; i <= 16; i++) {
      const t = (i / 16) * 2 - 1;
      for (const [X, Y] of [[t * ex, ey], [ex, t * ey]] as const) {
        const [x, y, z] = paniniDir(X, Y, d);
        tx = Math.max(tx, Math.abs(x / z));
        ty = Math.max(ty, Math.abs(y / z));
      }
    }
    tx *= 1.01;
    ty *= 1.01;
    // The hidden picture: a bit more pixels than the screen, so the lens does not lose detail.
    const h = Math.ceil(size.y * 1.3);
    const w = Math.ceil(h * (tx / ty));
    if (this.target.width !== w || this.target.height !== h) this.target.setSize(w, h);
    this.wide.position.copy(camera.position);
    this.wide.quaternion.copy(camera.quaternion);
    this.wide.near = camera.near;
    this.wide.far = camera.far;
    this.wide.fov = (2 * Math.atan(ty) * 180) / Math.PI;
    this.wide.aspect = tx / ty;
    this.wide.updateProjectionMatrix();
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, this.wide);
    this.renderer.setRenderTarget(null);
    this.material.uniforms.extent!.value.set(ex, ey);
    this.material.uniforms.tanHalf!.value.set(tx, ty);
    this.material.uniforms.d!.value = d;
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  dispose(): void {
    this.target.dispose();
    this.material.dispose();
  }
}
