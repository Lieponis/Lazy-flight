// THE INFORMATION SCREEN'S PICTURE (split off from cockpitscreens.ts in stage 3i so it can be drawn without Three.js: the cockpit uses it on
// a 3D screen, and the long-name preview (namepreview.ts) uses the very same code on a flat page).

import { layoutInfo } from "./namefit";
import { SCREEN_DESIGN_WIDTH, type InfoScreenData } from "./screendata";

export const AMBER = "#c07a22";
export const LIGHT = "#e3e7ff";
export const CYAN = "#3fe0ff";
export const DARK = "#0e2a30";
export const NAV_BACK = "#0b3138"; // the route screen is darker than the others, for contrast
export const NAV_DIM = "#2f8fa3";
export const FONT = '"VT323", ui-monospace, Menlo, Consolas, monospace'; // the game's pixel font if it is loaded, else a plain monospace

/** Text with a thin outline of its own colour, so the strokes stay visible when the screen is small on the picture. */
export function thick(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size: number): void {
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

/** Draws the information screen. Exported so the name preview (namepreview.ts) can draw the very same picture on a flat page. */
export function drawInfo(ctx: CanvasRenderingContext2D, w: number, h: number, d: InfoScreenData): void {
  const k = w / SCREEN_DESIGN_WIDTH; // everything is laid out on a 96-wide grid and scaled to the picture
  ctx.fillStyle = NAV_BACK; // the same dark background as the route screen (Andy)
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
  // Tours show the next stop (and the tour's end time) instead of the plain destination; the line count stays the same.
  const heading = d.next ? `${d.next.isFinal ? "FINAL" : "NEXT"} STOP ${d.next.number}/${d.next.total}` : "TO";
  // Long unique names (stage 3i): namefit.ts decides the lines and their sizes so the whole screen always fits and the code stays whole.
  const layout = layoutInfo({
    heading,
    name: (d.next ? d.next.name : d.destination).toUpperCase(),
    arrivesLabel: d.next ? "TOUR ENDS IN" : "ARRIVES IN",
    countdown: d.countdown,
    phase: d.phase,
    measureAt: (size) => {
      ctx.font = `${size}px ${FONT}`;
      return (text) => ctx.measureText(text).width;
    },
    width: w,
    height: h,
    scale: k,
    bodySize: BODY,
    top: 0.04,
    bottom: 0.96,
  });
  const area = h * 0.92;
  let y = h * 0.04 + (area - layout.height) / 2;
  for (const row of layout.rows) {
    const lineH = row.size * 0.9;
    ctx.font = `${row.size}px ${FONT}`;
    thick(ctx, row.text, w / 2, y + lineH * 0.82, row.tone === "value" ? LIGHT : CYAN, row.size);
    y += lineH;
  }
}

