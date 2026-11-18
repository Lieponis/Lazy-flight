// A very small PNG reader (8-bit RGB/RGBA, no interlace: what the browser's screenshots are), so the offline
// checks can find planets on a screenshot without an image library. Plain Node.

import { inflateSync } from "node:zlib";

/** Decodes a PNG buffer into { width, height, rgba: Uint8Array }. */
export function decodePng(buf) {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) throw new Error("not a PNG");
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[12] !== 0) throw new Error("only 8-bit, non-interlaced PNG");
      colorType = data[9];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!bpp) throw new Error(`PNG colour type ${colorType} not supported`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = new Uint8Array(width * height * 4);
  const prev = new Uint8Array(stride);
  const cur = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 255;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      out[o] = cur[x * bpp];
      out[o + 1] = cur[x * bpp + 1];
      out[o + 2] = cur[x * bpp + 2];
      out[o + 3] = bpp === 4 ? cur[x * bpp + 3] : 255;
    }
    prev.set(cur);
  }
  return { width, height, rgba: out };
}

/**
 * Finds round-ish coloured blobs (planets, the star) on a dark space picture. Thin orbit lines and tiny stars are
 * skipped. Returns [{ x, y, size }] sorted biggest first. `skip(x, y)` can exclude areas (menus).
 */
export function findBlobs({ width, height, rgba }, skip = () => false, minSize = 10) {
  const lit = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    lit[i] = Math.max(r, g, b) > 70 ? 1 : 0;
  }
  const seen = new Uint8Array(width * height);
  const blobs = [];
  const stack = [];
  for (let start = 0; start < width * height; start++) {
    if (!lit[start] || seen[start]) continue;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let count = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      const x = i % width;
      const y = (i - x) / width;
      count++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (const n of [i - 1, i + 1, i - width, i + width]) {
        if (n < 0 || n >= width * height || seen[n] || !lit[n]) continue;
        if ((n === i - 1 && x === 0) || (n === i + 1 && x === width - 1)) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const cx = Math.round((minX + maxX) / 2);
    const cy = Math.round((minY + maxY) / 2);
    // A planet is a filled roundish patch; an orbit ring is long and hollow (low fill), a star dot is tiny.
    if (w >= minSize && h >= minSize && w < width / 3 && h < height / 3 && count / (w * h) > 0.45 && Math.max(w, h) / Math.min(w, h) < 1.8 && !skip(cx, cy)) {
      blobs.push({ x: cx, y: cy, size: Math.max(w, h) });
    }
  }
  return blobs.sort((a, b) => b.size - a.size);
}
