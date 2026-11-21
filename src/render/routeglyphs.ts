// THE LITTLE PICTURES OF THE MAP MARKERS (stage NAV-2). Pure data, no Three.js.
//
// Plain words: every marker (a hop of the plan, a refuel stop, the target, my start dock / outpost / starred star / recent dock) is a
// tiny pixel picture drawn as text rows below. "#" is the main colour, "+" the second colour, "." is empty. A one-pixel dark edge is
// added around every picture by `glyphTexels`, so the marker stays readable over bright stars and over the sky.

export type GlyphName = "hop" | "refuel" | "target" | "start" | "outpost" | "starred" | "recent";

/**
 * Where the markers can be handed to instead of being drawn inside the small picture: a finer layer above it (src/render/markeroverlay.ts).
 * Positions are in pixels of the small picture and are NOT snapped to whole pixels, so the layer can move them smoothly.
 */
export interface MarkSink {
  /** A new frame starts: forget last frame's markers. */
  begin(): void;
  /** A marker whose middle is at (x, y) of the small picture. */
  add(name: GlyphName, x: number, y: number): void;
  /** The frame is complete: hide what was not added again. */
  end(): void;
  /** Nothing to show at all. */
  clear(): void;
}

export interface GlyphDef {
  rows: readonly string[];
  /** Colours as 0xRRGGBB for "#" and "+". */
  main: number;
  second: number;
}

export const GLYPHS: Readonly<Record<GlyphName, GlyphDef>> = {
  // A stop of the plan: a small solid square.
  hop: { rows: [".....", ".###.", ".###.", ".###.", "....."], main: 0xffb547, second: 0xffb547 },
  // A stop where the ship refuels: a ring with a bright dot.
  refuel: { rows: ["..###..", ".#...#.", "#.....#", "#..+..#", "#.....#", ".#...#.", "..###.."], main: 0xffb547, second: 0xffffff },
  // The target: a bigger diamond.
  target: {
    rows: ["....#....", "...###...", "..#####..", ".#######.", "#########", ".#######.", "..#####..", "...###...", "....#...."],
    main: 0xfff1c4,
    second: 0xffb547,
  },
  // My start dock: a little house.
  start: { rows: ["...#...", "..###..", ".#####.", "#######", ".#####.", ".##+##.", ".##+##."], main: 0x7dff9a, second: 0x1c6b30 },
  // An outpost I own: a flag on a pole.
  outpost: { rows: [".#.....", ".###...", ".#####.", ".###...", ".#.....", ".#.....", ".#....."], main: 0x3fe0d0, second: 0x3fe0d0 },
  // A starred place: a star.
  starred: { rows: ["...#...", "..###..", "#######", ".#####.", "..###..", ".##.##.", ".#...#."], main: 0xffe45e, second: 0xffe45e },
  // A recently visited dock: a hollow square.
  recent: { rows: ["#####", "#...#", "#...#", "#...#", "#####"], main: 0x9fb4d8, second: 0x9fb4d8 },
};

/** Which glyph a place kind uses. */
export const PLACE_GLYPH: Readonly<Record<"start" | "outpost" | "starred" | "recent", GlyphName>> = {
  start: "start",
  outpost: "outpost",
  starred: "starred",
  recent: "recent",
};

export interface GlyphTexels {
  /** Width and height in texels (the picture plus its one-pixel edge). */
  size: number;
  /** RGBA, 4 bytes per texel, the TOP row first. Alpha is 0 (empty), 235 (the dark edge) or 255 (the picture). */
  data: Uint8Array;
}

/** Turns a glyph into texels with a one-pixel dark edge (an empty texel next to a picture texel, up, down, left or right). */
export function glyphTexels(def: GlyphDef): GlyphTexels {
  const inner = def.rows.length;
  const size = inner + 2;
  const filled = new Uint8Array(size * size); // 0 empty, 1 main, 2 second
  for (let y = 0; y < inner; y++) {
    const row = def.rows[y] ?? "";
    for (let x = 0; x < inner; x++) {
      const c = row[x];
      if (c === "#") filled[(y + 1) * size + x + 1] = 1;
      else if (c === "+") filled[(y + 1) * size + x + 1] = 2;
    }
  }
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const at = y * size + x;
      const o = at * 4;
      const f = filled[at]!;
      if (f > 0) {
        const colour = f === 1 ? def.main : def.second;
        data[o] = (colour >> 16) & 255;
        data[o + 1] = (colour >> 8) & 255;
        data[o + 2] = colour & 255;
        data[o + 3] = 255;
        continue;
      }
      const edge =
        (x > 0 && filled[at - 1]! > 0) || (x < size - 1 && filled[at + 1]! > 0) || (y > 0 && filled[at - size]! > 0) || (y < size - 1 && filled[at + size]! > 0);
      if (edge) data[o + 3] = 235; // black, nearly solid
    }
  }
  return { size, data };
}
