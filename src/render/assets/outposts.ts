// THE FOUR OUTPOSTS (buildings with a landing pad on a planet surface).
// Origin = centre of the landing pad on the ground. Up is +Y. The pad top is at y = 0.34. Buildings stand on the +X side.
// Andy's direction: look mixed by variant (the depot is rugged, the rest are clean), size varies by variant,
// the planet colour goes ONLY on the ground and dust (buildings stay white/grey), subtle close-up quirks,
// a blinking beacon, blinking pad lights and lit windows.
//
//   outpost-depot   Supply depot   (rugged, medium)  hangar, fuel tanks, control tower.       Quirk: a crooked mailbox.
//   outpost-domes   Dome habitat   (clean, medium)   big dome, greenhouse, small dome, round pad.  Quirk: laundry on a line.
//   outpost-comms   Comms station  (clean, small)    module, dish, mast, solar, pad painted on the dust with flags.  Quirk: a deck chair.
//   outpost-hub     Passenger hub  (clean, large)    glass dome concourse, glass tube, holo sign, transit tube.  Quirk: a forgotten suitcase.

import { ModelKit, type ColorName } from "./kit";
import { PAD_DIAMETER } from "./style";
import type { AssetModel, BuildOptions } from "./types";

const PAD_TOP = 0.34;
const GROUND = 0.16; // top of the planet-coloured ground plate

/** Supply depot pad (patched steel octagon): dark octagon, light inner deck, yellow marks, four green lights that blink in turn. */
function pad(k: ModelKit, rugged: boolean): void {
  const r = PAD_DIAMETER / 2 / Math.cos(Math.PI / 8);
  k.cyl("pad base", r, r, 0.3, 8, "metalDark", { at: [0, 0.15, 0], rot: [0, Math.PI / 8, 0] });
  k.cyl("pad deck", r * 0.84, r * 0.84, 0.34, 8, "paintGrey", { at: [0, 0.17, 0], rot: [0, Math.PI / 8, 0] });
  for (const s of [1, -1]) {
    k.box(`pad mark x${s}`, 0.3, 0.04, 1.2, "yellow", { at: [3.0 * s, 0.36, 0] });
    k.box(`pad mark z${s}`, 1.2, 0.04, 0.3, "yellow", { at: [0, 0.36, 3.0 * s] });
  }
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    k.box(`pad light ${i + 1}`, 0.3, 0.3, 0.3, "lightGreen", {
      at: [Math.cos(a) * 4.1, 0.45, Math.sin(a) * 4.1],
      layer: i % 2 === 0 ? "blinkA" : "blinkB",
    });
  }
  if (rugged) {
    k.box("pad rust patch", 1.2, 0.04, 0.9, "rust", { at: [-2.2, 0.36, 1.6], rot: [0, 0.3, 0] });
    k.box("pad odd plate", 0.9, 0.04, 0.9, "hullMid", { at: [1.8, 0.36, -2.0], rot: [0, -0.2, 0] });
  }
  k.anchor("parking", [0, PAD_TOP, 0]);
}

/** Dome habitat pad: round, white deck, a yellow marking ring and eight lights around the edge. */
function padRound(k: ModelKit): void {
  k.cyl("pad base", 4.6, 4.6, 0.3, 16, "metalDark", { at: [0, 0.15, 0] });
  k.cyl("pad deck", 3.9, 3.9, 0.34, 16, "paintGrey", { at: [0, 0.17, 0] });
  k.ring("pad ring", 2.4, 0.1, 16, "yellow", { at: [0, 0.36, 0] });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    k.box(`pad light ${i + 1}`, 0.26, 0.26, 0.26, "lightGreen", {
      at: [Math.cos(a) * 4.25, 0.42, Math.sin(a) * 4.25],
      layer: i % 2 === 0 ? "blinkA" : "blinkB",
    });
  }
  k.anchor("parking", [0, PAD_TOP, 0]);
}

/** Comms station pad: a square painted on the dust, a cross in the middle, four flag poles with lights. */
function padMarked(k: ModelKit): void {
  k.box("pad dust", 8.4, GROUND, 8.4, "tintDark", { at: [0, GROUND / 2, 0] });
  const y = GROUND + 0.015;
  for (const s of [1, -1]) {
    k.box(`paint edge x${s}`, 7, 0.03, 0.3, "paintWhite", { at: [0, y, 3.35 * s] });
    k.box(`paint edge z${s}`, 0.3, 0.03, 7, "paintWhite", { at: [3.35 * s, y, 0] });
  }
  k.box("paint cross a", 2, 0.03, 0.3, "yellow", { at: [0, y, 0] });
  k.box("paint cross b", 0.3, 0.03, 2, "yellow", { at: [0, y, 0] });
  [[1, 1], [1, -1], [-1, -1], [-1, 1]].forEach(([sx, sz], i) => {
    const x = 3.9 * sx!;
    const z = 3.9 * sz!;
    k.box(`flag pole ${i + 1}`, 0.15, 1.8, 0.15, "metalDark", { at: [x, GROUND + 0.9, z] });
    k.box(`flag ${i + 1}`, 0.7, 0.45, 0.04, "orange", { at: [x + 0.35, GROUND + 1.55, z] });
    k.box(`flag light ${i + 1}`, 0.22, 0.22, 0.22, "lightGreen", { at: [x, GROUND + 1.9, z], layer: i % 2 === 0 ? "blinkA" : "blinkB" });
  });
  k.anchor("parking", [0, GROUND + 0.03, 0]);
}

/** Passenger hub pad: one big dark octagon with a glowing cyan ring and cyan lights. */
function padHub(k: ModelKit): void {
  const r = 5.2 / Math.cos(Math.PI / 8);
  k.cyl("pad base", r, r, 0.3, 8, "metalDark", { at: [0, 0.15, 0], rot: [0, Math.PI / 8, 0] });
  k.cyl("pad deck", r * 0.86, r * 0.86, 0.34, 8, "underside", { at: [0, 0.17, 0], rot: [0, Math.PI / 8, 0] });
  k.ring("pad glow ring", 3.4, 0.12, 16, "cyan", { at: [0, 0.36, 0], layer: "glow" });
  k.cyl("pad centre", 0.8, 0.8, 0.36, 8, "paintWhite", { at: [0, 0.18, 0] });
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i / 8) * Math.PI * 2;
    k.box(`pad light ${i + 1}`, 0.28, 0.28, 0.28, "cyan", {
      at: [Math.cos(a) * 4.7, 0.45, Math.sin(a) * 4.7],
      layer: i % 2 === 0 ? "blinkA" : "blinkB",
    });
  }
  k.anchor("parking", [0, PAD_TOP, 0]);
}

/** A beacon light on top of something, and the anchor that marks it. */
function beacon(k: ModelKit, at: [number, number, number]): void {
  k.box("beacon", 0.32, 0.32, 0.32, "lightRed", { at, layer: "blinkA" });
  k.anchor("beacon", at, [0, 1, 0]);
}

/** A door on a wall that faces the pad (-X), with a lit strip above it. Sets the entrance anchor. */
function door(k: ModelKit, x: number, z: number, w: number, h: number): void {
  k.box("door", 0.06, h, w, "metalDark", { at: [x - 0.02, GROUND + h / 2, z] });
  k.box("door light", 0.06, 0.18, w, "window", { at: [x - 0.03, GROUND + h + 0.12, z], layer: "glow" });
  k.anchor("entrance", [x - 0.1, GROUND, z], [-1, 0, 0]);
}

/** A control tower: dark shaft, cab with lit glass, roof and beacon. */
function tower(k: ModelKit, x: number, z: number, height: number, cab: ColorName): void {
  k.cyl("tower shaft", 0.5, 0.6, height, 8, "metalDark", { at: [x, GROUND + height / 2, z] });
  const y = GROUND + height;
  k.cyl("tower cab", 1.0, 0.8, 0.5, 8, cab, { at: [x, y + 0.2, z] });
  k.cyl("tower glass", 1.0, 1.0, 0.5, 8, "glassDark", { at: [x, y + 0.7, z] });
  k.cyl("tower windows", 1.03, 1.03, 0.18, 8, "window", { at: [x, y + 0.7, z], layer: "glow" });
  k.cyl("tower roof", 0.7, 1.1, 0.3, 8, cab, { at: [x, y + 1.1, z] });
  beacon(k, [x, y + 1.42, z]);
}

// ------------------------------------------------------------------ Supply depot (rugged, medium)

export function buildOutpostDepot(o: BuildOptions = {}): AssetModel {
  const k = new ModelKit({ tint: o.tint });
  pad(k, true);
  k.box("dusty ground", 10.6, GROUND, 14, "tintDark", { at: [9.8, GROUND / 2, 0] });
  k.cone("dust pile 1", 1.0, 0.5, 6, "tint", { at: [14.2, GROUND + 0.2, -6.0] });
  k.cone("dust pile 2", 0.8, 0.45, 6, "tint", { at: [12.8, GROUND + 0.18, 6.2] });
  // Hangar with worn plates.
  k.loft("hangar", [
    { x: 10, z: -3.5, w: 5.2, h: 3.2, y: GROUND + 1.6, ct: 1.3 },
    { x: 10, z: 3.5, w: 5.2, h: 3.2, y: GROUND + 1.6, ct: 1.3 },
  ], "paintGrey");
  k.box("rust patch", 0.06, 0.8, 1.2, "rust", { at: [7.38, 1.6, -2.4] });
  k.box("odd plate", 0.06, 0.9, 1.0, "hullMid", { at: [7.38, 0.8, 2.6] });
  k.box("roof patch", 1.4, 0.06, 1.2, "rust", { at: [10.4, GROUND + 3.21, 1.5] });
  door(k, 7.4, 0, 2.8, 1.7);
  // Fuel tanks, one of them an old rusty one.
  for (const [x, color] of [[8.8, "paintGrey"], [11.0, "rust"]] as const) {
    k.cyl(`fuel tank ${x}`, 0.9, 0.9, 2.4, 8, color, { at: [x, GROUND + 1.2, -5.6] });
    k.cyl(`tank band ${x}`, 0.93, 0.93, 0.25, 8, "metalDark", { at: [x, GROUND + 1.8, -5.6] });
    k.dome(`tank top ${x}`, 0.9, 8, "paintGrey", { at: [x, GROUND + 2.4, -5.6] });
  }
  k.box("fuel pipe", 2.2, 0.25, 0.25, "metalDark", { at: [9.9, 0.6, -5.6] });
  k.box("crate 1", 1, 1, 1, "rust", { at: [12.8, GROUND + 0.5, 4.2] });
  k.box("crate 2", 0.8, 0.8, 0.8, "teal", { at: [13.0, GROUND + 0.4, 3.1], rot: [0, 0.4, 0] });
  tower(k, 8.0, 5.2, 3.2, "paintGrey");
  // Quirk: a crooked mailbox by the pad.
  k.box("mailbox post", 0.18, 0.9, 0.18, "metalDark", { at: [5.6, GROUND + 0.45, -3.6], rot: [0, 0, 0.18] });
  k.box("mailbox", 0.5, 0.35, 0.3, "red", { at: [5.69, GROUND + 0.95, -3.6], rot: [0, 0, 0.18] });
  return k.finish();
}

// ------------------------------------------------------------------ Dome habitat (clean, medium)

export function buildOutpostDomes(o: BuildOptions = {}): AssetModel {
  const k = new ModelKit({ tint: o.tint });
  padRound(k);
  k.cyl("ground", 6.8, 6.8, GROUND, 10, "tintDark", { at: [11, GROUND / 2, 0] });
  // The big dome on a ring wall with lit windows all round.
  k.cyl("dome wall", 3.32, 3.32, 0.8, 12, "paintGrey", { at: [11, GROUND + 0.4, 0] });
  k.dome("big dome", 3.3, 12, "paintWhite", { at: [11, GROUND + 0.64, 0] });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    if (Math.abs(Math.cos(a) + 1) < 0.2) continue; // leave room for the airlock
    k.box(`window ${i + 1}`, 0.1, 0.3, 0.7, "window", {
      at: [11 + Math.cos(a) * 3.34, GROUND + 0.45, Math.sin(a) * 3.34],
      rot: [0, -a, 0],
      layer: "glow",
    });
  }
  k.box("airlock", 1.6, 1.7, 1.8, "paintGrey", { at: [7.4, GROUND + 0.85, 0] });
  door(k, 6.6, 0, 1.0, 1.3);
  // Greenhouse (dark glass) and a small living dome, joined by tubes.
  k.cyl("greenhouse wall", 1.82, 1.82, 0.4, 10, "paintGrey", { at: [11, GROUND + 0.2, -5.6] });
  k.dome("greenhouse", 1.8, 10, "glassDark", { at: [11, GROUND + 0.38, -5.6] });
  k.box("tube to greenhouse", 1.0, 1.0, 1.4, "paintGrey", { at: [11, GROUND + 0.6, -3.6] });
  k.cyl("small dome wall", 1.52, 1.52, 0.5, 10, "paintGrey", { at: [11, GROUND + 0.25, 5.3] });
  k.dome("small dome", 1.5, 10, "paintWhite", { at: [11, GROUND + 0.48, 5.3] });
  k.box("tube to small dome", 1.0, 1.0, 1.4, "paintGrey", { at: [11, GROUND + 0.6, 3.65] });
  k.box("window small dome", 0.1, 0.3, 0.6, "window", { at: [9.5, GROUND + 0.3, 5.3], layer: "glow" });
  // Antenna and beacon on top of the big dome.
  const top = GROUND + 0.64 + 3.3;
  k.box("antenna", 0.2, 1.2, 0.2, "metalDark", { at: [11, top + 0.5, 0] });
  beacon(k, [11, top + 1.25, 0]);
  // Quirk: laundry drying on a line.
  for (const z of [3.2, 5.6]) k.box(`laundry post ${z}`, 0.18, 1.6, 0.18, "metalDark", { at: [14.6, GROUND + 0.8, z] });
  k.box("laundry line", 0.06, 0.06, 2.4, "hullLight", { at: [14.6, GROUND + 1.55, 4.4] });
  ([[3.8, "teal"], [4.4, "pink"], [5.0, "yellow"]] as const).forEach(([z, c]) =>
    k.box(`laundry ${c}`, 0.04, 0.62, 0.45, c, { at: [14.6, GROUND + 1.23, z] }),
  );
  return k.finish();
}

// ------------------------------------------------------------------ Comms station (clean, small)

export function buildOutpostComms(o: BuildOptions = {}): AssetModel {
  const k = new ModelKit({ tint: o.tint });
  padMarked(k);
  k.cyl("ground", 5.3, 5.3, GROUND, 8, "tintDark", { at: [9.4, GROUND / 2, 0] });
  k.loft("module", [
    { x: 8.6, z: -1.8, w: 3.0, h: 2.2, y: GROUND + 1.1, ct: 0.7, cb: 0.1 },
    { x: 8.6, z: 1.8, w: 3.0, h: 2.2, y: GROUND + 1.1, ct: 0.7, cb: 0.1 },
  ], "paintWhite");
  for (const z of [-1.15, 1.15]) k.box(`window ${z}`, 0.06, 0.3, 0.6, "window", { at: [7.08, GROUND + 1.25, z], layer: "glow" });
  door(k, 7.1, 0, 0.9, 1.3);
  // The big dish on a pedestal.
  k.cyl("dish pedestal", 0.35, 0.45, 2.2, 8, "metalDark", { at: [11.2, GROUND + 1.1, -1.8] });
  // The dish opens up and towards the pad.
  k.cone("dish", 1.8, 0.7, 10, "paintWhite", { at: [11.2, GROUND + 2.6, -1.8], rot: [0, 0, -2.56] });
  k.box("dish feed", 0.2, 1.0, 0.2, "metalDark", { at: [10.95, GROUND + 3.05, -1.8], rot: [0, 0, -2.56] });
  // Tall mast with the beacon.
  k.cyl("mast", 0.2, 0.25, 6.5, 6, "paintGrey", { at: [9.4, GROUND + 3.25, 3.0] });
  for (const y of [4.9, 5.8]) k.box(`mast arm ${y}`, 1.4, 0.15, 0.15, "paintGrey", { at: [9.4, GROUND + y, 3.0] });
  beacon(k, [9.4, GROUND + 6.7, 3.0]);
  // Solar panels on posts.
  for (const z of [1.2, 2.6]) {
    k.box(`solar post ${z}`, 0.2, 0.8, 0.2, "metalDark", { at: [12.0, GROUND + 0.4, z] });
    k.box(`solar panel ${z}`, 1.8, 0.1, 1.1, "glassDark", { at: [12.0, GROUND + 0.95, z], rot: [0, 0, 0.45] });
  }
  // Quirk: a deck chair facing the dish.
  k.box("chair base", 0.4, 0.3, 0.4, "metalDark", { at: [12.4, GROUND + 0.15, -3.6] });
  k.box("chair seat", 0.55, 0.08, 0.5, "teal", { at: [12.4, GROUND + 0.34, -3.6] });
  k.box("chair back", 0.08, 0.55, 0.5, "teal", { at: [12.68, GROUND + 0.58, -3.6], rot: [0, 0, 0.35] });
  return k.finish();
}

// ------------------------------------------------------------------ Passenger hub (clean, large, sci-fi)

export function buildOutpostHub(o: BuildOptions = {}): AssetModel {
  const k = new ModelKit({ tint: o.tint });
  padHub(k);
  k.box("ground", 14, GROUND, 17, "tintDark", { at: [10, GROUND / 2, 2.5] });
  // The glass dome concourse on a white ring wall, with glowing cyan bands.
  const cx = 12.5;
  const wallTop = GROUND + 0.9;
  k.cyl("concourse wall", 4.55, 4.55, 0.9, 16, "paintWhite", { at: [cx, GROUND + 0.45, 0] });
  k.dome("glass concourse", 4.5, 16, "glassDark", { at: [cx, wallTop, 0] });
  k.ring("glow band low", 4.6, 0.1, 16, "cyan", { at: [cx, wallTop, 0], layer: "glow" });
  k.ring("glow band high", 3.9, 0.1, 16, "cyan", { at: [cx, wallTop + 2.25, 0], layer: "glow" });
  k.cyl("dome cap", 1.2, 1.4, 0.3, 8, "paintWhite", { at: [cx, wallTop + 4.4, 0] });
  k.box("antenna", 0.2, 1.4, 0.2, "metalDark", { at: [cx, wallTop + 5.2, 0] });
  beacon(k, [cx, wallTop + 6.05, 0]);
  // Glass tube walkway from the pad to the dome.
  k.cyl("walkway tube", 0.9, 0.9, 3.4, 8, "glassDark", { at: [6.4, 1.1, 0], rot: [0, 0, Math.PI / 2] });
  k.cyl("walkway ring pad end", 1.0, 1.0, 0.3, 8, "paintWhite", { at: [4.9, 1.1, 0], rot: [0, 0, Math.PI / 2] });
  k.cyl("walkway ring dome end", 1.0, 1.0, 0.3, 8, "paintWhite", { at: [8.0, 1.1, 0], rot: [0, 0, Math.PI / 2] });
  k.box("walkway glow", 3.0, 0.15, 0.15, "cyan", { at: [6.4, 0.25, 0], layer: "glow" });
  k.anchor("entrance", [4.7, PAD_TOP, 0], [-1, 0, 0]);
  // Tube transit line running off towards the city, on white pylons, with a cyan strip.
  k.cyl("transit tube", 0.6, 0.6, 6.6, 8, "glassDark", { at: [cx, 1.2, 7.6], rot: [Math.PI / 2, 0, 0] });
  k.box("transit glow", 0.15, 0.12, 6.6, "cyan", { at: [cx, 1.85, 7.6], layer: "glow" });
  for (const z of [7.2, 10.2]) k.box(`transit pylon ${z}`, 0.5, 0.8, 0.5, "paintWhite", { at: [cx, GROUND + 0.35, z] });
  // Holo-style sign by the pad: a glowing panel on a post, with dark "lettering".
  k.box("sign post", 0.25, 2.6, 0.25, "metalDark", { at: [6.6, GROUND + 1.3, -5.4] });
  k.box("sign panel", 0.06, 1.3, 2.2, "cyan", { at: [6.55, GROUND + 3.2, -5.4], layer: "glow" });
  for (const [y, w] of [[3.45, 1.6], [3.15, 1.2], [2.85, 1.5]] as const) {
    k.box(`sign line ${y}`, 0.08, 0.14, w, "glassDark", { at: [6.5, GROUND + y, -5.4] });
  }
  // Quirk: a suitcase someone forgot by the walkway.
  k.box("suitcase", 0.5, 0.38, 0.22, "teal", { at: [5.6, GROUND + 0.19, 1.6] });
  k.box("suitcase handle", 0.2, 0.08, 0.06, "metalDark", { at: [5.6, GROUND + 0.42, 1.6] });
  return k.finish();
}
