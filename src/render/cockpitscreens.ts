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
  SCREEN_DESIGN_WIDTH,
  type FuelScreenData,
  type InfoScreenData,
  type MapScreenData,
} from "./screendata";

const TEAL = "#1f8a80";
const STATUS_BLUE = "#14215e"; // the info screen: dark blue, for contrast with the light text
const AMBER = "#c07a22";
const LIGHT = "#e3e7ff";
const CYAN = "#3fe0ff";
const DARK = "#0e2a30";
const NAV_BACK = "#0b3138"; // the route screen is darker than the others, for contrast
const NAV_DIM = "#2f8fa3";
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
  texture.magFilter = THREE.LinearFilter; // smooth, not blocky: the picture is bigger than the screen's share of the game picture
  texture.minFilter = THREE.LinearMipmapLinearFilter; // averaged down cleanly instead of dropping pixels (no broken letters)
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
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
  while (size > 8 && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    ctx.font = `${size}px ${FONT}`;
  }
  thick(ctx, text, x, y, color, size);
}

/** Text with a thin outline of its own colour, so the strokes stay visible when the screen is small on the picture. */
function thick(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size: number): void {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, size * 0.07);
  ctx.lineJoin = "round";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

/** Breaks `text` into lines no wider than `maxWidth` at the current font. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Lines of text, all the same size (the biggest up to `maxSize` that fits the width and the height), centred as a block. */
function drawBlock(ctx: CanvasRenderingContext2D, w: number, h: number, lines: { text: string; color: string }[], maxSize: number, top: number, bottom: number): void {
  const maxW = w - 8 * (w / SCREEN_DESIGN_WIDTH);
  const area = h * (bottom - top);
  let size = maxSize;
  for (; size > 8; size -= 1) {
    ctx.font = `${size}px ${FONT}`;
    if (lines.length * size * 0.9 <= area && lines.every((l) => ctx.measureText(l.text).width <= maxW)) break;
  }
  ctx.font = `${size}px ${FONT}`;
  const lineH = size * 0.9;
  let y = h * top + (area - lines.length * lineH) / 2 + lineH * 0.82;
  for (const l of lines) {
    thick(ctx, l.text, w / 2, y, l.color, size);
    y += lineH;
  }
}

function drawInfo(ctx: CanvasRenderingContext2D, w: number, h: number, d: InfoScreenData): void {
  const k = w / SCREEN_DESIGN_WIDTH; // everything is laid out on a 96-wide grid and scaled to the picture
  ctx.fillStyle = STATUS_BLUE;
  ctx.fillRect(0, 0, w, h);
  const BODY = 19 * k; // one text size on both pages, so nothing overlaps
  if (d.page === "message") {
    // A funny line from the ship's computer, wrapped to the screen.
    ctx.font = `${BODY}px ${FONT}`;
    let size = BODY;
    let lines = wrap(ctx, d.message, w - 8 * k);
    while (size > 12 * k && lines.length * size * 0.9 > h * 0.72) {
      size -= k;
      ctx.font = `${size}px ${FONT}`;
      lines = wrap(ctx, d.message, w - 8 * k);
    }
    drawBlock(ctx, w, h, [{ text: "SHIP COMPUTER", color: CYAN }, ...lines.map((text) => ({ text, color: LIGHT }))], size, 0.04, 0.96);
    return;
  }
  ctx.font = `${BODY}px ${FONT}`;
  const destLines = wrap(ctx, d.destination.toUpperCase(), w - 8 * k).slice(0, 2);
  drawBlock(
    ctx,
    w,
    h,
    [
      { text: "TO", color: CYAN },
      ...destLines.map((text) => ({ text, color: LIGHT })),
      { text: "ARRIVES IN", color: CYAN },
      { text: d.countdown, color: LIGHT },
      { text: d.phase, color: CYAN },
    ],
    BODY,
    0.04,
    0.96,
  );
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
