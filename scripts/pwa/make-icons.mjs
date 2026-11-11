// Draws the PLACEHOLDER app icons (a chunky pixel planet with a ring on dark space) and writes PNG files.
// Plain Node, no libraries. Run it only when you want new placeholder icons:  node scripts/pwa/make-icons.mjs
// The real icon art is stage P5. To use real art, just replace the four PNG files in public/icons/ (same names and sizes).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = join(root, "public", "icons");

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const SPACE = hex("#05060d");
const STAR = hex("#7d979c");
const PLANET = [hex("#ffd27a"), hex("#ffb547"), hex("#c8602a")]; // light, middle, shadow
const RING = [hex("#3fe0d0"), hex("#1f8a80")]; // bright, dim

function starAt(px, py) {
  const h = Math.imul(px * 73856093 ^ py * 19349663, 2654435761) >>> 0;
  return h % 41 === 0;
}

/** One logical pixel of the picture. (x, y) run from -1 to 1 across the icon; size is how much of the icon the picture fills. */
function colourAt(px, py, n, size) {
  const x = ((px + 0.5) / n * 2 - 1) / size;
  const y = ((py + 0.5) / n * 2 - 1) / size;
  const inPlanet = x * x + (y - 0.04) * (y - 0.04) <= 0.42 * 0.42;
  const a = -0.38;
  const xr = x * Math.cos(a) + y * Math.sin(a);
  const yr = -x * Math.sin(a) + y * Math.cos(a);
  const e = (xr / 0.95) ** 2 + (yr / 0.27) ** 2;
  const onRing = e >= 0.7 && e <= 1.0;
  const front = yr > 0;
  if (onRing && front) return e > 0.88 ? RING[1] : RING[0];
  if (inPlanet) {
    const shade = x * 0.55 + (y - 0.04) * 0.75; // light comes from the top left
    const band = Math.floor(((y + 1) * 9) % 2);
    const tone = shade < -0.12 ? 0 : shade < 0.2 ? 1 : 2;
    return band === 1 && tone < 2 ? PLANET[tone + 1] : PLANET[tone];
  }
  if (onRing) return e > 0.88 ? RING[1] : RING[0];
  if (size > 0.8 && starAt(px, py)) return STAR;
  return SPACE;
}

/** n x n logical pixels, scaled up to "pixels" x "pixels" with no smoothing (whole-pixel blocks). */
function picture(n, pixels, size) {
  const logical = [];
  for (let py = 0; py < n; py++) for (let px = 0; px < n; px++) logical.push(colourAt(px, py, n, size));
  const rgba = Buffer.alloc(pixels * pixels * 4);
  for (let y = 0; y < pixels; y++) {
    for (let x = 0; x < pixels; x++) {
      const c = logical[Math.floor((y * n) / pixels) * n + Math.floor((x * n) / pixels)];
      const i = (y * pixels + x) * 4;
      rgba[i] = c[0];
      rgba[i + 1] = c[1];
      rgba[i + 2] = c[2];
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

const crcTable = new Uint32Array(256).map((_, i) => {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(pixels, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(pixels, 0);
  header.writeUInt32BE(pixels, 4);
  header[8] = 8; // 8 bits per channel
  header[9] = 6; // RGBA
  const rows = Buffer.alloc((pixels * 4 + 1) * pixels);
  for (let y = 0; y < pixels; y++) {
    rows[y * (pixels * 4 + 1)] = 0; // filter: none
    rgba.copy(rows, y * (pixels * 4 + 1) + 1, y * pixels * 4, (y + 1) * pixels * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// name, size in pixels, logical grid (so each logical pixel is a whole block), how much of the icon the picture fills
const ICONS = [
  ["icon-192.png", 192, 64, 0.92],
  ["icon-512.png", 512, 64, 0.92],
  ["icon-maskable-512.png", 512, 64, 0.78], // the important part stays inside the round "safe zone"
  ["apple-touch-icon-180.png", 180, 60, 0.92],
];

mkdirSync(outDir, { recursive: true });
for (const [name, pixels, grid, size] of ICONS) {
  writeFileSync(join(outDir, name), png(pixels, picture(grid, pixels, size)));
  console.log(`wrote public/icons/${name} (${pixels}x${pixels})`);
}
