// THE THREE COCKPIT SCREENS (stage C2b). Each screen is a small picture (a 2D canvas, pixel-art size) put on a flat plane
// that sits a hair in front of the glowing screen of Agent 8's cockpit. The picture is redrawn only a few times a second.
// What goes on the screens is decided in screendata.ts; this file only draws it.
//
// Cockpit anchors (src/render/assets/cockpitBase.ts): screenInfo (ahead), screenMap (middle), screenFuel (amber, pilot's wing).
// Each anchor has pos (the screen's middle), dir (pointing towards the pilot) and size {w, h} in crates.

import * as THREE from "three";
import type { AssetModel } from "./assets";
import {
  SCREEN_PIXEL_WIDTH,
  SCREEN_SUPERSAMPLE,
  TEXT_SHARPEN,
  canvasHeightFor,
  SCREEN_DESIGN_WIDTH,
  type FuelScreenData,
  type InfoScreenData,
  type MapScreenData,
} from "./screendata";
import { AMBER, CYAN, DARK, FONT, LIGHT, NAV_BACK, NAV_DIM, drawInfo, thick } from "./infoscreen";

/** How far in front of the glowing screen the picture floats (crates). */
const FLOAT = 0.003;

interface Face {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
}

// The screen's own tiny shader (stage 3i). It shows the picture like a plain textured square would, then gives the edges of the letters back
// that shrinking the picture took away: the pixel is pushed away from the average of itself and its four neighbours, one game pixel
// away (an "unsharp mask"). The sums are done on display colours (gamma), like the picture was drawn.
const SCREEN_VERTEX = "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
const SCREEN_FRAGMENT = /* glsl */ `
  uniform sampler2D uMap; uniform float uSharp;
  varying vec2 vUv;
  vec3 toGamma(vec3 c) { return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2)); }
  vec3 toLinear(vec3 c) { return pow(max(c, vec3(0.0)), vec3(2.2)); }
  void main() {
    vec2 d = fwidth(vUv); // how far one game pixel is, in picture coordinates
    vec3 c = toGamma(texture2D(uMap, vUv).rgb);
    vec3 l = toGamma(texture2D(uMap, vUv - vec2(d.x, 0.0)).rgb);
    vec3 r = toGamma(texture2D(uMap, vUv + vec2(d.x, 0.0)).rgb);
    vec3 u = toGamma(texture2D(uMap, vUv - vec2(0.0, d.y)).rgb);
    vec3 b = toGamma(texture2D(uMap, vUv + vec2(0.0, d.y)).rgb);
    vec3 mean = (c + l + r + u + b) * 0.2;
    gl_FragColor = vec4(toLinear(clamp(c + uSharp * (c - mean), 0.0, 1.0)), 1.0);
    #include <colorspace_fragment>
  }
`;

type ScreenName = "screenInfo" | "screenMap" | "screenFuel" | "screenRightWing";

function makeFace(model: AssetModel, name: ScreenName): Face | null {
  const a = model.anchors[name];
  if (!a || !a.size) return null;
  const canvas = document.createElement("canvas");
  canvas.width = SCREEN_PIXEL_WIDTH;
  canvas.height = canvasHeightFor(SCREEN_PIXEL_WIDTH, a.size.w, a.size.h, SCREEN_SUPERSAMPLE);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.LinearFilter; // smooth, not blocky: the picture is bigger than the screen's share of the game picture
  texture.minFilter = THREE.LinearMipmapLinearFilter; // averaged down cleanly instead of dropping pixels (no broken letters)
  texture.generateMipmaps = true;
  texture.anisotropy = 8; // sharper when the screen is seen at a slant (the renderer lowers it if the device allows less)
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: texture }, uSharp: { value: TEXT_SHARPEN } },
    vertexShader: SCREEN_VERTEX,
    fragmentShader: SCREEN_FRAGMENT,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(a.size.w, a.size.h), material);
  mesh.position.copy(a.pos).addScaledVector(a.dir, FLOAT);
  mesh.lookAt(mesh.position.clone().add(a.dir)); // the picture faces the pilot
  mesh.name = `${name} picture`;
  model.group.add(mesh);
  return { canvas, ctx, texture, mesh, material };
}

/** Writes `text` centred at x, baseline y, at the biggest size (up to `px`) that fits `maxWidth`. */
function centred(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, maxWidth: number, color: string): void {
  let size = px;
  ctx.font = `${size}px ${FONT}`;
  while (size > 8 && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    ctx.font = `${size}px ${FONT}`;
  }
  thick(ctx, text, x, y, color, size);
}

function drawMap(ctx: CanvasRenderingContext2D, w: number, h: number, d: MapScreenData): void {
  const k = w / SCREEN_DESIGN_WIDTH;
  ctx.fillStyle = NAV_BACK;
  ctx.fillRect(0, 0, w, h);
  centred(ctx, "ROUTE", w / 2, h * 0.12, 18 * k, w - 8 * k, CYAN);
  const px = (p: { x: number; y: number }): [number, number] => [p.x * w, p.y * h];
  // Stars: little bright squares.
  ctx.fillStyle = LIGHT;
  for (const s of d.stars) {
    const [x, y] = px(s);
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(k)), Math.max(1, Math.round(k)));
  }
  const [ox, oy] = px(d.origin);
  const [dx, dy] = px(d.destination);
  const [sx, sy] = px(d.ship);
  // The route: a thick line, bright where the ship has been, dim cyan still to go.
  ctx.lineWidth = 2.5 * k;
  ctx.lineCap = "butt";
  ctx.strokeStyle = NAV_DIM;
  ctx.setLineDash([4 * k, 3 * k]);
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(dx, dy);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = LIGHT;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(sx, sy);
  ctx.stroke();
  // The tour's stops: a ring on the line, filled bright once the ship has passed it.
  for (const stop of d.stops) {
    const [tx, ty] = px(stop.at);
    ctx.fillStyle = NAV_BACK;
    ctx.fillRect(tx - 4 * k, ty - 4 * k, 8 * k, 8 * k);
    ctx.strokeStyle = stop.passed ? LIGHT : CYAN;
    ctx.lineWidth = 2 * k;
    ctx.strokeRect(tx - 3 * k, ty - 3 * k, 6 * k, 6 * k);
    if (stop.passed) {
      ctx.fillStyle = LIGHT;
      ctx.fillRect(tx - 1.5 * k, ty - 1.5 * k, 3 * k, 3 * k);
    }
  }
  // Start (cyan square), destination (big bright ring), ship (bright diamond with a dark edge).
  ctx.fillStyle = CYAN;
  ctx.fillRect(ox - 3.5 * k, oy - 3.5 * k, 7 * k, 7 * k);
  ctx.strokeStyle = LIGHT;
  ctx.lineWidth = 2 * k;
  ctx.strokeRect(dx - 5 * k, dy - 5 * k, 10 * k, 10 * k);
  ctx.fillStyle = LIGHT;
  ctx.fillRect(dx - 1.5 * k, dy - 1.5 * k, 3 * k, 3 * k);
  const r = 6 * k;
  ctx.fillStyle = NAV_BACK;
  ctx.beginPath();
  ctx.moveTo(sx, sy - r - k);
  ctx.lineTo(sx + r + k, sy);
  ctx.lineTo(sx, sy + r + k);
  ctx.lineTo(sx - r - k, sy);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffd24a"; // warm yellow: the one thing that moves
  ctx.beginPath();
  ctx.moveTo(sx, sy - r);
  ctx.lineTo(sx + r, sy);
  ctx.lineTo(sx, sy + r);
  ctx.lineTo(sx - r, sy);
  ctx.closePath();
  ctx.fill();
}

/** The right wing screen: amber like the fuel screen, with a few quiet bars (a made-up readout, nothing to read). */
function drawRightWing(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const k = w / SCREEN_DESIGN_WIDTH;
  ctx.fillStyle = AMBER;
  ctx.fillRect(0, 0, w, h);
  const heights = [0.35, 0.6, 0.45, 0.8, 0.55];
  const barW = 10 * k;
  const gap = 6 * k;
  const x0 = (w - (heights.length * barW + (heights.length - 1) * gap)) / 2;
  const base = h * 0.85;
  const top = h * 0.2;
  ctx.fillStyle = DARK;
  ctx.fillRect(x0 - 4 * k, base + 1 * k, heights.length * (barW + gap) - gap + 8 * k, 2 * k);
  ctx.fillStyle = LIGHT;
  heights.forEach((v, i) => ctx.fillRect(x0 + i * (barW + gap), base - (base - top) * v, barW, (base - top) * v));
}

function drawFuel(ctx: CanvasRenderingContext2D, w: number, h: number, d: FuelScreenData): void {
  const k = w / SCREEN_DESIGN_WIDTH;
  ctx.fillStyle = AMBER;
  ctx.fillRect(0, 0, w, h);
  centred(ctx, "FUEL", w / 2, h * 0.3, 26 * k, w - 8 * k, LIGHT);
  const bx = 8 * k;
  const bw = w - 16 * k;
  const by = Math.round(h * 0.42);
  const bh = Math.max(8 * k, Math.round(h * 0.2));
  ctx.fillStyle = DARK;
  ctx.fillRect(bx - 2 * k, by - 2 * k, bw + 4 * k, bh + 4 * k);
  ctx.fillStyle = AMBER;
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = LIGHT;
  ctx.fillRect(bx, by, Math.round(bw * d.fraction), bh);
  centred(ctx, d.text, w / 2, h * 0.93, 26 * k, w - 8 * k, LIGHT);
}

export interface ScreenFrame {
  info: InfoScreenData;
  map: MapScreenData;
  fuel: FuelScreenData;
}

export class CockpitScreens {
  private info: Face | null;
  private map: Face | null;
  private fuel: Face | null;
  private rightWing: Face | null;
  private rightWingDrawn = false;
  /** Called once when the pixel font finishes loading, so the owner can redraw straight away. */
  onFontLoaded: (() => void) | null = null;

  constructor(model: AssetModel) {
    this.info = makeFace(model, "screenInfo");
    this.map = makeFace(model, "screenMap");
    this.fuel = makeFace(model, "screenFuel");
    this.rightWing = makeFace(model, "screenRightWing");
    // The UI's CSS loads the VT323 font; wait for it before relying on it (the plain monospace is used meanwhile).
    try {
      void document.fonts?.load(`20px "VT323"`).then(() => this.onFontLoaded?.());
    } catch {
      // not important: the fallback font is fine
    }
  }

  /** Redraws all three pictures. Call about 4 times a second, not every frame. */
  draw(frame: ScreenFrame): void {
    if (this.info) {
      drawInfo(this.info.ctx, this.info.canvas.width, this.info.canvas.height, frame.info);
      this.info.texture.needsUpdate = true;
    }
    if (this.map) {
      drawMap(this.map.ctx, this.map.canvas.width, this.map.canvas.height, frame.map);
      this.map.texture.needsUpdate = true;
    }
    if (this.rightWing && !this.rightWingDrawn) {
      drawRightWing(this.rightWing.ctx, this.rightWing.canvas.width, this.rightWing.canvas.height);
      this.rightWing.texture.needsUpdate = true;
      this.rightWingDrawn = true; // it never changes
    }
    if (this.fuel) {
      drawFuel(this.fuel.ctx, this.fuel.canvas.width, this.fuel.canvas.height, frame.fuel);
      this.fuel.texture.needsUpdate = true;
    }
  }

  /** The textures are not freed with the cockpit's geometry and materials, so free them here. */
  dispose(): void {
    for (const face of [this.info, this.map, this.fuel, this.rightWing]) {
      face?.texture.dispose();
      face?.material.dispose();
    }
  }
}
