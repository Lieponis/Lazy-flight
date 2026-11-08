// THE FOUR STATIONS (large, orbiting). Origin = station centre. Up is +Y.
// Every station has an Elite-style docking SLOT in its front face (the face looking to -Z). The bay is a room inside:
// the ship parks on the bay floor, nose towards the slot. Andy chose "camera goes inside": the docked camera moves into
// the bay (Agent 3's job), so every station gives a `bayCamera` anchor as a suggested camera spot.
// Andy's direction: grand Elite-like, all large, mixed colours by variant (industrial = orange/yellow,
// grand = cyan/blue), the ring habitat spins, every station has blinking bay lights and lit windows, no funny touches.
//
//   station-ring       Ring habitat       grand       spinning ring of 24 segments around a hub; slot on the spin axis
//   station-starport   Coriolis starport  grand       huge faceted block with the slot in its front face
//   station-cargo      Cargo terminal     industrial  command block with the slot, long spine, container racks, cranes
//   station-refinery   Fuel refinery      industrial  docking block, round tanks with bands, pipes, a burning flare stack

import { ModelKit, type ColorName } from "./kit";
import { BAY_SIZE, RING_SPIN_SPEED } from "./style";
import type { AssetModel, BuildOptions } from "./types";

const W = BAY_SIZE.width; // inside width of the bay
const H = BAY_SIZE.height;
const D = BAY_SIZE.depth;
const WALL = 0.6;
const SX = W / 2 + WALL; // half size of the slot opening, walls included
const SY = H / 2 + WALL;

interface Block {
  zFront: number;
  zBack: number;
  w: number;
  h: number;
  ct: number;
  cb: number;
}

/**
 * A big faceted block whose front face has the docking slot cut into it.
 * The front face is made of six flat pieces around the opening.
 */
function slotBlock(k: ModelKit, name: string, b: Block, color: ColorName, faceColor: ColorName): void {
  // The face pieces only fit if the block is clearly bigger than the slot (the checker catches it otherwise).
  if (b.h / 2 - Math.max(b.ct, b.cb) <= SY || b.w / 2 <= SX) throw new Error(`${name}: too small for the docking slot`);
  k.loft(name, [
    { z: b.zFront, w: b.w, h: b.h, y: 0, ct: b.ct, cb: b.cb },
    { z: b.zBack, w: b.w, h: b.h, y: 0, ct: b.ct, cb: b.cb },
  ], color, { openFront: true });
  const hw = b.w / 2;
  const hh = b.h / 2;
  const A: [number, number] = [-hw + b.cb, -hh];
  const B: [number, number] = [hw - b.cb, -hh];
  const C: [number, number] = [hw, -hh + b.cb];
  const Dp: [number, number] = [hw, hh - b.ct];
  const E: [number, number] = [hw - b.ct, hh];
  const F: [number, number] = [-hw + b.ct, hh];
  const G: [number, number] = [-hw, hh - b.ct];
  const Hp: [number, number] = [-hw, -hh + b.cb];
  const r1: [number, number] = [-SX, -SY];
  const r2: [number, number] = [SX, -SY];
  const r3: [number, number] = [SX, SY];
  const r4: [number, number] = [-SX, SY];
  const z0 = b.zFront;
  const z1 = b.zFront + WALL;
  k.prism(`${name} face top`, [G, Dp, E, F], z0, z1, faceColor);
  k.prism(`${name} face upper`, [r4, r3, Dp, G], z0, z1, faceColor);
  k.prism(`${name} face right`, [r2, C, Dp, r3], z0, z1, faceColor);
  k.prism(`${name} face left`, [Hp, r1, r4, G], z0, z1, faceColor);
  k.prism(`${name} face lower`, [Hp, C, r2, r1], z0, z1, faceColor);
  k.prism(`${name} face bottom`, [A, B, C, Hp], z0, z1, faceColor);
}

/**
 * The bay: a room from the slot mouth (zMouth) inwards (+Z). Floor, ceiling, side walls, back wall,
 * landing marks, glowing strips along the floor, ceiling lights, and blinking lights round the mouth.
 * Sets the anchors parking, dockEntrance and bayCamera.
 */
function bay(k: ModelKit, zMouth: number, strip: ColorName, mark: ColorName): void {
  const zc = zMouth + D / 2;
  k.box("bay floor", W + 2 * WALL, WALL, D, "paintGrey", { at: [0, -H / 2 - WALL / 2, zc] });
  k.box("bay ceiling", W + 2 * WALL, WALL, D, "metalDark", { at: [0, H / 2 + WALL / 2, zc] });
  for (const s of [1, -1]) {
    k.box(`bay wall ${s > 0 ? "right" : "left"}`, WALL, H, D, "metalDark", { at: [s * (W / 2 + WALL / 2), 0, zc] });
    k.box(`bay floor strip ${s > 0 ? "right" : "left"}`, 0.25, 0.2, D - 0.4, strip, { at: [s * (W / 2 - 0.2), -H / 2 + 0.1, zc], layer: "glow" });
  }
  k.box("bay back wall", W + 2 * WALL, H + 2 * WALL, WALL, "metalDark", { at: [0, 0, zMouth + D + WALL / 2] });
  // Landing square on the floor, under the parked ship.
  const pz = zMouth + 7;
  for (const s of [1, -1]) {
    k.box(`bay mark x${s}`, 7, 0.04, 0.3, mark, { at: [0, -H / 2 + 0.02, pz + 4 * s] });
    k.box(`bay mark z${s}`, 0.3, 0.04, 8, mark, { at: [3.5 * s, -H / 2 + 0.02, pz] });
  }
  for (const dz of [-4, 0, 4]) k.box(`bay ceiling light ${dz}`, 1.4, 0.1, 0.7, "window", { at: [0, H / 2 - 0.05, pz + dz], layer: "glow" });
  // Blinking lights at the four corners of the mouth.
  [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sy], i) => {
    k.box(`mouth light ${i + 1}`, 0.45, 0.45, 0.45, "lightGreen", {
      at: [sx! * (SX + 0.4), sy! * (SY + 0.4), zMouth - 0.15],
      layer: i % 2 === 0 ? "blinkA" : "blinkB",
    });
  });
  k.anchor("parking", [0, -H / 2, pz]);
  k.anchor("dockEntrance", [0, 0, zMouth], [0, 0, -1]);
  // Suggested camera: high in a back corner of the bay, looking past the ship out through the slot.
  k.anchor("bayCamera", [4.2, 2.8, zMouth + D - 0.4], [-4.2, -H / 2 - 1.8, 7 - (D - 0.4)]);
}

/** A row of lit windows on a flat side wall (x = constant), along Z. */
function windowRow(k: ModelKit, name: string, x: number, y: number, z0: number, z1: number, count: number, color: ColorName): void {
  const step = (z1 - z0) / count;
  for (let i = 0; i < count; i++) {
    k.box(`${name} ${i + 1}`, 0.2, 0.5, step * 0.6, color, { at: [x, y, z0 + step * (i + 0.5)], layer: "glow" });
  }
}

// ------------------------------------------------------------------ Ring habitat (grand, cyan/blue, spins)

export function buildStationRing(_o: BuildOptions = {}): AssetModel {
  const k = new ModelKit();
  const zMouth = -10;
  slotBlock(k, "hub", { zFront: zMouth, zBack: 10, w: 18, h: 18, ct: 4.5, cb: 4.5 }, "paintWhite", "paintWhite");
  bay(k, zMouth, "cyan", "yellow");
  k.loft("hub tail", [
    { z: 10, w: 12, h: 12, y: 0, ct: 3, cb: 3 },
    { z: 14, w: 6, h: 6, y: 0, ct: 1.5, cb: 1.5 },
  ], "paintGrey");
  k.box("antenna", 0.5, 0.5, 4, "metalDark", { at: [0, 0, 16] });
  for (const s of [1, -1]) {
    k.box(`hub band ${s}`, 0.2, 2.5, 18, "blue", { at: [9.05 * s, 0, 0] });
    k.box(`hub glow ${s}`, 0.25, 0.3, 16, "cyan", { at: [9.1 * s, 2.0, 0], layer: "glow" });
  }
  // The ring: 24 chunky segments with lit windows on the front, joined to the hub by 4 spokes. All of it spins.
  const R = 19;
  const n = 24;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * R;
    const y = Math.sin(a) * R;
    const len = 2 * R * Math.sin(Math.PI / n) + 0.25;
    k.box(`ring segment ${i + 1}`, 3, len, 3.4, i % 6 === 0 ? "paintGrey" : "paintWhite", { at: [x, y, 0], rot: [0, 0, a], layer: "ring" });
    k.box(`ring windows ${i + 1}`, 0.5, len * 0.7, 0.15, i % 2 === 0 ? "window" : "cyan", { at: [x, y, -1.75], rot: [0, 0, a], layer: "ring" });
  }
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const r = (8.6 + 17.6) / 2;
    k.box(`spoke ${i + 1}`, 17.6 - 8.6 + 0.4, 1.6, 1.6, "paintGrey", { at: [Math.cos(a) * r, Math.sin(a) * r, 0], rot: [0, 0, a], layer: "ring" });
  }
  k.spin([0, 0, 0], [0, 0, 1], RING_SPIN_SPEED);
  k.anchor("spinAxis", [0, 0, 0], [0, 0, 1]);
  return k.finish();
}

// ------------------------------------------------------------------ Coriolis-style starport (grand, cyan/blue)

export function buildStationStarport(_o: BuildOptions = {}): AssetModel {
  const k = new ModelKit();
  const zMouth = -17;
  // A huge faceted block: narrow faces front and back, widest in the middle.
  slotBlock(k, "front", { zFront: zMouth, zBack: -9, w: 24, h: 24, ct: 7, cb: 7 }, "paintWhite", "paintGrey");
  k.loft("middle", [
    { z: -9, w: 36, h: 36, y: 0, ct: 10.5, cb: 10.5 },
    { z: 9, w: 36, h: 36, y: 0, ct: 10.5, cb: 10.5 },
  ], "paintWhite");
  k.loft("front shoulder", [
    { z: -16.4, w: 24, h: 24, y: 0, ct: 7, cb: 7 },
    { z: -9, w: 36, h: 36, y: 0, ct: 10.5, cb: 10.5 },
  ], "paintWhite");
  k.loft("back", [
    { z: 9, w: 36, h: 36, y: 0, ct: 10.5, cb: 10.5 },
    { z: 17, w: 24, h: 24, y: 0, ct: 7, cb: 7 },
  ], "paintWhite");
  bay(k, zMouth, "cyan", "yellow");
  // Slot frame glow and company marks.
  for (const s of [1, -1]) {
    k.box(`slot glow side ${s}`, 0.3, 2 * SY + 0.6, 0.3, "cyan", { at: [s * (SX + 0.15), 0, zMouth - 0.1], layer: "glow" });
    k.box(`slot glow edge ${s}`, 2 * SX + 0.6, 0.3, 0.3, "cyan", { at: [0, s * (SY + 0.15), zMouth - 0.1], layer: "glow" });
    k.box(`blue band ${s}`, 15, 0.2, 3, "blue", { at: [0, s * 18.05, 0] });
    windowRow(k, `windows side ${s} high`, s * 18.05, 4, -8, 8, 8, "window");
    windowRow(k, `windows side ${s} low`, s * 18.05, -4, -8, 8, 8, "window");
  }
  k.box("antenna top", 0.6, 4, 0.6, "metalDark", { at: [0, 20, 4] });
  k.box("antenna back", 0.6, 0.6, 4, "metalDark", { at: [0, 0, 19] });
  return k.finish();
}

// ------------------------------------------------------------------ Cargo terminal (industrial, orange/yellow)

export function buildStationCargo(_o: BuildOptions = {}): AssetModel {
  const k = new ModelKit();
  const zMouth = -20;
  slotBlock(k, "command block", { zFront: zMouth, zBack: -6, w: 16, h: 14, ct: 3, cb: 3 }, "paintGrey", "paintGrey");
  bay(k, zMouth, "orange", "yellow");
  for (const s of [1, -1]) {
    k.box(`hazard stripe ${s}`, 0.2, 1.2, 12, "yellow", { at: [8.05 * s, 3.0, -13] });
    windowRow(k, `windows ${s}`, 8.05 * s, 1.2, -18, -8, 6, "window");
  }
  // The long spine with container racks.
  k.loft("spine", [
    { z: -6, w: 6, h: 6, y: 0, ct: 1.5, cb: 1.5 },
    { z: 20, w: 6, h: 6, y: 0, ct: 1.5, cb: 1.5 },
  ], "metalDark");
  const colors: ColorName[] = ["orange", "yellow", "hullMid", "rust", "teal"];
  let c = 0;
  for (const z of [-2, 4, 10, 16]) {
    k.box(`rack frame ${z}`, 14, 14, 0.5, "paintGrey", { at: [0, 0, z - 2.7] });
    for (const [x, y, w, h] of [[5.2, 0, 4, 5], [-5.2, 0, 4, 5], [0, 5.2, 5, 4], [0, -5.2, 5, 4]] as const) {
      k.box(`container ${z} ${x} ${y}`, w, h, 4.8, colors[c++ % colors.length]!, { at: [x, y, z] });
    }
  }
  // Two yellow crane arms over the racks.
  for (const s of [1, -1]) {
    k.box(`crane mast ${s}`, 0.8, 4, 0.8, "yellow", { at: [6.5 * s, 9, 1] });
    k.box(`crane arm ${s}`, 0.8, 0.8, 10, "yellow", { at: [6.5 * s, 11, 5] });
  }
  // Power block and solar wings at the back.
  k.box("power block", 8, 8, 4, "paintGrey", { at: [0, 0, 22] });
  for (const s of [1, -1]) {
    k.box(`solar strut ${s}`, 6, 0.6, 0.6, "metalDark", { at: [s * 7, 0, 22] });
    k.box(`solar wing ${s}`, 12, 0.3, 5, "glassDark", { at: [s * 15, 0, 22] });
  }
  return k.finish();
}

// ------------------------------------------------------------------ Fuel refinery (industrial, orange/yellow)

export function buildStationRefinery(_o: BuildOptions = {}): AssetModel {
  const k = new ModelKit();
  const zMouth = -18;
  slotBlock(k, "docking block", { zFront: zMouth, zBack: -4, w: 16, h: 14, ct: 3, cb: 3 }, "paintGrey", "paintGrey");
  bay(k, zMouth, "orange", "yellow");
  for (const s of [1, -1]) {
    k.box(`hazard stripe ${s}`, 0.2, 1.2, 12, "orange", { at: [8.05 * s, 3.0, -11] });
    windowRow(k, `windows ${s}`, 8.05 * s, 1.2, -16, -6, 6, "window");
  }
  // Central truss.
  k.box("truss", 3, 3, 22, "metalDark", { at: [0, 0, 7] });
  // Four big round tanks with orange bands, piped to the truss.
  for (const [x, y, z] of [[7, 0, 3], [-7, 0, 3], [0, 7, 11], [0, -7, 11]] as const) {
    k.ball(`tank ${x} ${y}`, 4.5, 1, "paintWhite", { at: [x, y, z] });
    k.ring(`tank band ${x} ${y}`, 4.45, 0.35, 12, "orange", { at: [x, y, z] });
    const len = Math.hypot(x, y) - 1;
    k.box(`pipe ${x} ${y}`, x !== 0 ? len : 1, y !== 0 ? len : 1, 1, "metalDark", { at: [x / 2, y / 2, z] });
  }
  // Two long cylinder tanks under the truss.
  for (const s of [1, -1]) k.cyl(`long tank ${s}`, 2.3, 2.3, 10, 8, "paintGrey", { at: [4.5 * s, -5.5, 15], rot: [Math.PI / 2, 0, 0] });
  k.box("long tank cradle", 12, 1, 2, "metalDark", { at: [0, -3.5, 15] });
  // Flare stack with a burning flame on top.
  k.cyl("flare stack", 0.8, 1.1, 11, 8, "metalDark", { at: [0, 6.5, 16] });
  k.box("flare stripe", 2.4, 1, 2.4, "yellow", { at: [0, 10, 16] });
  k.cone("flare flame", 1.3, 3, 6, "engine", { at: [0, 13.5, 16], layer: "glow" });
  return k.finish();
}
