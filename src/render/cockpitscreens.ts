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
  canvasHeightFor,
  twoLines,
  type FuelScreenData,
  type InfoScreenData,
  type MapScreenData,
} from "./screendata";

const TEAL = "#1f8a80";
const AMBER = "#c07a22";
const LIGHT = "#e3e7ff";
const CYAN = "#3fe0ff";
const DARK = "#0e2a30";
const FONT = '"VT323", ui-monospace, Menlo, Consolas, monospace'; // the game's pixel font if it is loaded, else a plain monospace

/** How far in front of the glowing screen the picture floats (crates). */
const FLOAT = 0.003;

interface Face {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  mesh: THREE.Mesh;
}

function makeFace(model: AssetModel, name: "screenInfo" | "screenMap" | "screenFuel"): Face | null {
  const a = model.anchors[name];
  if (!a || !a.size) return null;
  const canvas = document.createElement("canvas");
  canvas.width = SCREEN_PIXEL_WIDTH;
  canvas.height = canvasHeightFor(SCREEN_PIXEL_WIDTH, a.size.w, a.size.h);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(a.size.w, a.size.h), material);
  mesh.position.copy(a.pos).addScaledVector(a.dir, FLOAT);
  mesh.lookAt(mesh.position.clone().add(a.dir)); // the picture faces the pilot
  mesh.name = `${name} picture`;
  model.group.add(mesh);
  return { canvas, ctx, texture, mesh };
}

/** Writes `text` centred at x, baseline y, at the biggest size (up to `px`) that fits `maxWidth`. */
function centred(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, maxWidth: number, color: string): void {
  let size = px;
  ctx.font = `${size}px ${FONT}`;
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    ctx.font = `${size}px ${FONT}`;
  }
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
}

function drawInfo(ctx: CanvasRenderingContext2D, w: number, h: number, d: InfoScreenData): void {
  ctx.fillStyle = TEAL;
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2;
  centred(ctx, "TO", cx, h * 0.14, 18, w - 8, CYAN);
  const [l1, l2] = twoLines(d.destination, 11);
  centred(ctx, l1, cx, h * 0.3, 24, w - 8, LIGHT);
  if (l2) centred(ctx, l2, cx, h * 0.43, 24, w - 8, LIGHT);
  centred(ctx, "ARRIVES IN", cx, h * 0.57, 16, w - 8, CYAN);
  centred(ctx, d.countdown, cx, h * 0.75, 36, w - 8, LIGHT);
  centred(ctx, d.phase, cx, h * 0.93, 22, w - 8, CYAN);
}

function drawMap(ctx: CanvasRenderingContext2D, w: number, h: number, d: MapScreenData): void {
  ctx.fillStyle = TEAL;
  ctx.fillRect(0, 0, w, h);
  centred(ctx, "ROUTE", w / 2, h * 0.12, 18, w - 8, CYAN);
  const px = (p: { x: number; y: number }): [number, number] => [Math.round(p.x * w), Math.round(p.y * h)];
  // Stars: single pixels.
  ctx.fillStyle = LIGHT;
  for (const s of d.stars) {
    const [x, y] = px(s);
    ctx.fillRect(x, y, 1, 1);
  }
  const [ox, oy] = px(d.origin);
  const [dx, dy] = px(d.destination);
  const [sx, sy] = px(d.ship);
  // The route: a dotted line, bright where the ship has already been.
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(ox + (dx - ox) * t);
    const y = Math.round(oy + (dy - oy) * t);
    if (i % 2 === 0) {
      const past = Math.hypot(x - ox, y - oy) <= Math.hypot(sx - ox, sy - oy);
      ctx.fillStyle = past ? LIGHT : DARK;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Start (cyan square), destination (ring), ship (bright diamond).
  ctx.fillStyle = CYAN;
  ctx.fillRect(ox - 2, oy - 2, 5, 5);
  ctx.strokeStyle = LIGHT;
  ctx.lineWidth = 1;
  ctx.strokeRect(dx - 3.5, dy - 3.5, 7, 7);
  ctx.fillStyle = DARK;
  ctx.fillRect(sx - 3, sy - 1, 7, 3);
  ctx.fillRect(sx - 1, sy - 3, 3, 7);
  ctx.fillStyle = LIGHT;
  ctx.fillRect(sx - 2, sy, 5, 1);
  ctx.fillRect(sx, sy - 2, 1, 5);
}

function drawFuel(ctx: CanvasRenderingContext2D, w: number, h: number, d: FuelScreenData): void {
  ctx.fillStyle = AMBER;
  ctx.fillRect(0, 0, w, h);
  centred(ctx, "FUEL", w / 2, h * 0.3, 26, w - 8, LIGHT);
  const bx = 8;
  const bw = w - 16;
  const by = Math.round(h * 0.42);
  const bh = Math.max(8, Math.round(h * 0.2));
  ctx.fillStyle = DARK;
  ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
  ctx.fillStyle = AMBER;
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = LIGHT;
  ctx.fillRect(bx, by, Math.round(bw * d.fraction), bh);
  centred(ctx, d.text, w / 2, h * 0.93, 26, w - 8, LIGHT);
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
  /** Called once when the pixel font finishes loading, so the owner can redraw straight away. */
  onFontLoaded: (() => void) | null = null;

  constructor(model: AssetModel) {
    this.info = makeFace(model, "screenInfo");
    this.map = makeFace(model, "screenMap");
    this.fuel = makeFace(model, "screenFuel");
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
    if (this.fuel) {
      drawFuel(this.fuel.ctx, this.fuel.canvas.width, this.fuel.canvas.height, frame.fuel);
      this.fuel.texture.needsUpdate = true;
    }
  }

  /** The textures are not freed with the cockpit's geometry and materials, so free them here. */
  dispose(): void {
    for (const face of [this.info, this.map, this.fuel]) face?.texture.dispose();
  }
}
