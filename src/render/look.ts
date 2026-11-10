// THE PIXEL LOOK, the graphics part (stage 3e). One extra pass over the finished low-resolution picture: colour bands, dither and
// grain. Dials and presets are in lookmath.ts / settings.ts. With every dial at 0 nothing here runs.
//
// How the pass catches everything (docked view, starmap, flight and the cockpit lens): while `render()` runs, anything that would be
// drawn straight to the screen is drawn into a hidden picture of the same size instead (renderer.setRenderTarget(null) is redirected).
// Then one full-screen square copies that picture to the screen with the look applied. The lens does its own hidden picture first
// and ends with "draw to the screen", so it is caught the same way, without changing the lens.

import * as THREE from "three";
import { lookActive, type LookSettings } from "./lookmath";

const VERTEX = "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";

const FRAGMENT = /* glsl */ `
  uniform sampler2D src;
  uniform float uBands; uniform float uDither; uniform float uGrain; uniform float uTick;
  varying vec2 vUv;
  float d2(vec2 a) { a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
  float bayer4(vec2 a) { return d2(a * 0.5) * 0.25 + d2(a) + 0.03125; }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTick) * 43758.5453); }
  void main() {
    gl_FragColor = texture2D(src, vUv);
    #include <colorspace_fragment>
    vec3 rgb = gl_FragColor.rgb;
    rgb += (hash(gl_FragCoord.xy) - 0.5) * uGrain;
    if (uBands > 1.5) {
      float n = uBands - 1.0;
      float t = 0.5 + (bayer4(gl_FragCoord.xy) - 0.5) * uDither;
      rgb = floor(rgb * n + t) / n;
    }
    gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
  }
`;

export class PixelLook {
  private settings: LookSettings = { bands: 0, dither: 0, grain: 0 };
  private target = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType });
  private quadScene = new THREE.Scene();
  private quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material: THREE.ShaderMaterial;
  private capturing = false;
  private time = 0;

  constructor(private renderer: THREE.WebGLRenderer) {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        src: { value: this.target.texture },
        uBands: { value: 0 },
        uDither: { value: 0 },
        uGrain: { value: 0 },
        uTick: { value: 0 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
    // Redirect "draw to the screen" into the hidden picture while we are capturing.
    const original = renderer.setRenderTarget.bind(renderer);
    renderer.setRenderTarget = ((t: THREE.WebGLRenderTarget | null, face?: number, mip?: number): void => {
      original(t === null && this.capturing ? this.target : t, face, mip);
    }) as typeof renderer.setRenderTarget;
  }

  set(settings: LookSettings): void {
    this.settings = { ...settings };
    this.material.uniforms.uBands!.value = settings.bands;
    this.material.uniforms.uDither!.value = settings.dither;
    this.material.uniforms.uGrain!.value = settings.grain;
  }

  get(): LookSettings {
    return { ...this.settings };
  }

  /** Draws one frame: `draw` does the normal drawing; this adds the look on top. */
  render(draw: () => void, seconds: number): void {
    this.time += seconds;
    if (!lookActive(this.settings)) {
      draw();
      return;
    }
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    if (this.target.width !== size.x || this.target.height !== size.y) this.target.setSize(size.x, size.y);
    this.material.uniforms.uTick!.value = Math.floor(this.time * 12) * 0.37; // the grain changes about 12 times a second (chunky)
    this.capturing = true;
    this.renderer.setRenderTarget(null); // goes to the hidden picture
    try {
      draw();
    } finally {
      this.capturing = false;
    }
    this.renderer.setRenderTarget(null); // the real screen
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  dispose(): void {
    this.target.dispose();
    this.material.dispose();
  }
}
