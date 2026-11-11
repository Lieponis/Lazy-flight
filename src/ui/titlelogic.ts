// Title screen (Agent 7b): the pure parts, tested in tests/title.test.ts. No browser, no Three.js.
// Andy's choices (2026-11-11): name LAZY FLIGHT, tagline below, option B "deep space" (navy space, coloured
// twinkling stars, the game's own planets and a station above the name), "LOADING" with three blinking dots, then PLAY.

export const GAME_NAME = "LAZY FLIGHT";
export const TAGLINE = "SPACE HAULING AT THE SPEED OF NAP";

// ------------------------------------------------------------------ chunky 5x7 pixel letters (no font file)

/** Only the letters the name needs (plus a few spares). Each row is 5 cells: "1" = filled. */
export const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  A: ["11111", "10001", "10001", "11111", "10001", "10001", "10001"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["11111", "10000", "10000", "10111", "10001", "10001", "11111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  Y: ["10001", "10001", "11011", "01110", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  " ": ["000", "000", "000", "000", "000", "000", "000"],
};
export const GLYPH_HEIGHT = 7;

/** Width of a word in cells (one empty column between letters). Unknown letters count as a space. */
export function wordWidth(text: string): number {
  let w = -1;
  for (const ch of text) w += (GLYPHS[ch] ?? GLYPHS[" "]!)[0]!.length + 1;
  return Math.max(0, w);
}

/** The filled cells of a word, left to right, as [x, y]. */
export function wordCells(text: string): [number, number][] {
  const out: [number, number][] = [];
  let x = 0;
  for (const ch of text) {
    const g = GLYPHS[ch] ?? GLYPHS[" "]!;
    g.forEach((row, y) => {
      for (let i = 0; i < row.length; i++) if (row[i] === "1") out.push([x + i, y]);
    });
    x += g[0]!.length + 1;
  }
  return out;
}

/** Portrait screens split the name over two lines ("LAZY" / "FLIGHT"); wide screens keep one line. */
export function titleLines(name: string, portrait: boolean): string[] {
  const parts = name.split(" ");
  return portrait && parts.length > 1 ? parts : [name];
}

/** How big one letter cell is in CSS pixels, so the name fills about `share` of the width but never gets too tall. */
export function titleCellSize(lines: string[], screenW: number, screenH: number, share = 0.84): number {
  const cells = Math.max(1, ...lines.map(wordWidth));
  const byWidth = (screenW * share) / cells;
  const byHeight = (screenH * 0.2) / (lines.length * (GLYPH_HEIGHT + 2));
  return Math.max(2, Math.floor(Math.min(byWidth, byHeight)));
}

// ------------------------------------------------------------------ low-resolution picture (the PS1 look)

/** About as many pixels as the game itself draws (320 x 180), stretched up without smoothing. */
export const TITLE_PIXEL_BUDGET = 320 * 180;

export function lowResSize(screenW: number, screenH: number, budget = TITLE_PIXEL_BUDGET): { w: number; h: number } {
  const W = Math.max(1, screenW);
  const H = Math.max(1, screenH);
  const k = Math.min(1, Math.sqrt(budget / (W * H)));
  return { w: Math.max(1, Math.round(W * k)), h: Math.max(1, Math.round(H * k)) };
}

// ------------------------------------------------------------------ where things sit

/** Screen spots in -1..1 (x right, y up) and sizes as a share of the screen height. */
export interface TitleLayout {
  station: { x: number; y: number; size: number };
  bigPlanet: { x: number; y: number; size: number };
  smallPlanet: { x: number; y: number; size: number };
}

export function titleLayout(aspect: number): TitleLayout {
  if (aspect < 1) {
    // phone upright: station high above the name, planets low
    return {
      station: { x: 0, y: 0.66, size: 0.36 },
      bigPlanet: { x: -0.4, y: -0.74, size: 0.17 },
      smallPlanet: { x: 0.55, y: -0.9, size: 0.07 },
    };
  }
  // wide: station above the name, planets in the lower corners
  return {
    station: { x: 0, y: 0.62, size: 0.5 },
    bigPlanet: { x: -0.8, y: -0.55, size: 0.36 },
    smallPlanet: { x: 0.82, y: -0.62, size: 0.15 },
  };
}

// ------------------------------------------------------------------ loading, then PLAY

/** Show "LOADING" at least this long, so the three dots are seen (and the first game frame is ready). */
export const MIN_LOADING_MS = 1200;
export const DOT_STEP_MS = 400;

export function titleReady(elapsedMs: number, gameReady: boolean): boolean {
  return gameReady && elapsedMs >= MIN_LOADING_MS;
}

/** "LOADING", "LOADING.", "LOADING..", "LOADING..." then again; the width stays the same (no jumping). */
export function loadingText(elapsedMs: number): string {
  const dots = Math.floor(Math.max(0, elapsedMs) / DOT_STEP_MS) % 4;
  return `LOADING${".".repeat(dots)}${" ".repeat(3 - dots)}`;
}
