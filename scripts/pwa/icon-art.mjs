// The app icon pictures, drawn pixel by pixel in plain JavaScript (no libraries, no image files), so they can be
// redrawn any time:  node scripts/pwa/make-icons.mjs
// Agent 7d (stage P5). Three looks were shown to Andy (A ringed planet, B Scout over a planet, C "LF" emblem);
// ICON_STYLE in make-icons.mjs says which one is used.
// Colours follow the game: the title screen's navy space and twinkling stars, the game's planet colours,
// and the rock tones of the rings (src/render/planetlook.ts RING_COLOURS).

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export const PAL = {
  space: hex("#0b0828"),
  stars: [hex("#ffffff"), hex("#ffe14a"), hex("#9b5cff"), hex("#3fe0f0")],
  sea: [hex("#bfe9ff"), hex("#3fa8e0"), hex("#1f5fb0"), hex("#14306a")], // light .. dark
  land: [hex("#d8ffd0"), hex("#3fe0a0"), hex("#1f9a70"), hex("#0f4a40")],
  cap: hex("#eef3ff"),
  ring: [hex("#dbccb0"), hex("#c9b594"), hex("#9e8f7d"), hex("#736659")],
  desert: [hex("#ffd27a"), hex("#ffb547"), hex("#c8602a"), hex("#6a2a18")],
  glow: hex("#3fe0f0"),
  name: hex("#9ff6ff"),
  nameShadow: hex("#1b2a8a"),
};

// ------------------------------------------------------------------ small helpers

function hash2(x, y, s = 0) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function noise2(x, y, s) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const sm = (t) => t * t * (3 - 2 * t);
  const u = sm(x - xi);
  const v = sm(y - yi);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(hash2(xi, yi, s), hash2(xi + 1, yi, s), u), L(hash2(xi, yi + 1, s), hash2(xi + 1, yi + 1, s), u), v);
}
const fbm = (x, y, s) => 0.65 * noise2(x, y, s) + 0.35 * noise2(x * 2.3, y * 2.3, s + 9);

/** A few twinkle stars: a dot, and some get a little plus. Only drawn where `free` (outside the safe zone for maskable). */
function star(px, py, n) {
  const h = hash2(px, py, 7);
  if (h > 0.016) return null;
  return PAL.stars[Math.floor(hash2(px, py, 3) * 4)];
}

/** Lit sphere: which of 4 shades (0 light .. 3 dark) a point (x, y) inside a circle (cx, cy, r) gets, light from the upper right. */
function sphereShade(x, y, cx, cy, r) {
  const nx = (x - cx) / r;
  const ny = (y - cy) / r;
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  const d = nx * 0.62 - ny * 0.45 + nz * 0.64; // light from the upper right, a bit in front
  return d > 0.75 ? 0 : d > 0.45 ? 1 : d > 0.1 ? 2 : 3;
}

/** Ring bands around (cx, cy): tilted ellipse; returns a ring colour or null. `front` says whether this part is in front of the planet. */
function ringAt(x, y, cx, cy, scale, tilt) {
  const xr = (x - cx) * Math.cos(tilt) + (y - cy) * Math.sin(tilt);
  const yr = -(x - cx) * Math.sin(tilt) + (y - cy) * Math.cos(tilt);
  const e = Math.sqrt((xr / (0.98 * scale)) ** 2 + (yr / (0.3 * scale)) ** 2);
  // three bands with a gap (like Saturn's), in rock tones
  let c = null;
  if (e >= 0.64 && e < 0.74) c = PAL.ring[2];
  else if (e >= 0.74 && e < 0.86) c = PAL.ring[1];
  else if (e >= 0.89 && e <= 1.0) c = PAL.ring[0];
  return c ? { c, front: yr > 0 } : null;
}

// ------------------------------------------------------------------ the three looks
// Each gets (x, y) in -1..1 across the picture area and returns a colour, or null for "space".

/** A: the ringed planet, like the title screen (blue sea, green land, ice cap, rock-tone ring). */
function lookA(x, y) {
  const cx = 0;
  const cy = 0.04;
  const r = 0.46;
  const ring = ringAt(x, y, cx, cy, 1, -0.36);
  if (ring && ring.front) return ring.c;
  if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) {
    const s = sphereShade(x, y, cx, cy, r);
    if ((y - cy) / r < -0.8) return PAL.cap;
    const land = fbm((x + 2) * 3.2, (y + 2) * 3.2, 11) > 0.55;
    return (land ? PAL.land : PAL.sea)[s];
  }
  if (ring) return ring.c;
  return null;
}

// The Scout seen from the side, nose to the right (W white, G grey, D dark, C cyan glass, O orange stripe,
// E engine, Y flame). Each character is one sprite pixel.
const SCOUT = [
  "..........WWW.........",
  "........WWCCCW........",
  "...GGWWWWWCCCCWW......",
  "EEDGGWWWWWWWWWWWWWW...",
  "EEDGOOOOOOOOOOWWWWWWWW",
  "EEDGGGGGGGGGGGGGGGGW..",
  "...DDDGGGGGGGGGGDD....",
  "....D...........D.....",
];
const SPRITE_COLOURS = { W: hex("#f2f4f8"), G: hex("#a9b0bd"), D: hex("#5a6070"), C: hex("#3fe0f0"), O: hex("#ff8a2a"), E: hex("#ffb547"), Y: hex("#ffe14a") };

/** B: the Scout flying over a big desert planet, engine glowing. */
function lookB(x, y) {
  // ship: sprite centred a bit above the middle, tilted up slightly
  const sw = SCOUT[0].length;
  const sh = SCOUT.length;
  const shipW = 1.42; // share of the picture width
  const sx0 = -0.66;
  const sy0 = -0.42;
  const tiltY = -0.18; // nose higher
  const u = (x - sx0) / shipW;
  const v = (y - sy0 - tiltY * (u - 0.5) * shipW) / ((shipW / sw) * sh);
  if (u >= 0 && u < 1 && v >= 0 && v < 1) {
    const ch = SCOUT[Math.floor(v * sh)][Math.floor(u * sw)];
    if (ch !== ".") return SPRITE_COLOURS[ch];
  }
  // flame trail behind the engine
  const ty = sy0 + tiltY * (0 - 0.5) * shipW + ((shipW / sw) * sh) * 0.55;
  if (x < sx0 && x > sx0 - 0.3 && Math.abs(y - ty - (x - sx0) * 0.15) < 0.05 * (1 + (x - sx0) / 0.3)) return x > sx0 - 0.12 ? SPRITE_COLOURS.Y : SPRITE_COLOURS.E;
  // big planet low on the left, with a thin cyan air glow at its edge
  const pcx = -0.25;
  const pcy = 1.35;
  const pr = 1.05;
  const d = Math.hypot(x - pcx, y - pcy);
  if (d <= pr) {
    const s = sphereShade(x, y, pcx, pcy, pr);
    const band = Math.sin((y - pcy) * 22 + fbm(x * 3, y * 3, 5) * 3) > 0.4;
    return PAL.desert[Math.min(3, s + (band ? 1 : 0))];
  }
  if (d <= pr + 0.035) return PAL.glow;
  return null;
}

// 5x7 letters from the title screen (src/ui/titlelogic.ts GLYPHS)
const L = ["10000", "10000", "10000", "10000", "10000", "10000", "11111"];
const F = ["11111", "10000", "10000", "11110", "10000", "10000", "10000"];

/** C: "LF" in the title's chunky letters over a small ringed planet. */
function lookC(x, y) {
  const cells = 11; // L (5) + gap (1) + F (5)
  const w = 1.36;
  const cell = w / cells;
  const x0 = -w / 2;
  const y0 = -0.62;
  const glyphAt = (gx, gy) => {
    if (gy < 0 || gy >= 7 || gx < 0 || gx >= cells) return false;
    if (gx < 5) return L[gy][gx] === "1";
    if (gx >= 6) return F[gy][gx - 6] === "1";
    return false;
  };
  const gx = Math.floor((x - x0) / cell);
  const gy = Math.floor((y - y0) / cell);
  if (glyphAt(gx, gy)) return PAL.name;
  // shadow one cell-fifth down and right
  const sgx = Math.floor((x - x0 - cell * 0.22) / cell);
  const sgy = Math.floor((y - y0 - cell * 0.22) / cell);
  if (glyphAt(sgx, sgy)) return PAL.nameShadow;
  // small ringed planet behind, lower right
  const cx = 0.42;
  const cy = 0.5;
  const r = 0.3;
  const ring = ringAt(x, y, cx, cy, 0.62, -0.3);
  if (ring && ring.front) return ring.c;
  if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) {
    const s = sphereShade(x, y, cx, cy, r);
    const land = fbm((x + 2) * 4, (y + 2) * 4, 4) > 0.55;
    return (land ? PAL.land : PAL.sea)[s];
  }
  if (ring) return ring.c;
  return null;
}

export const LOOKS = { A: lookA, B: lookB, C: lookC };

/**
 * One logical pixel (px, py) of an n x n icon. `size` = how much of the icon the picture fills
 * (smaller for the "maskable" icon, whose corners a phone may cut into a circle).
 */
export function iconPixel(style, px, py, n, size) {
  const x = (((px + 0.5) / n) * 2 - 1) / size;
  const y = (((py + 0.5) / n) * 2 - 1) / size;
  const c = LOOKS[style](x, y);
  if (c) return c;
  return star(px, py, n) ?? PAL.space;
}
