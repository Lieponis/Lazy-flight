// Reference models for the viewer. They are NOT game assets and are not in the registry.
//   scale-test   = the size yard: landing pad, one crate, a pilot and three ship-size boxes.
//   broken-demo  = a model broken on purpose, so you can see the problem checker catch things.

import * as THREE from "three";
import { COCKPIT_BASE_WIP } from "./cockpitBase";
import { ModelKit } from "./kit";
import { PAD_DIAMETER } from "./style";
import type { AssetEntry } from "./types";

function buildScaleTest(): ReturnType<ModelKit["finish"]> {
  const k = new ModelKit();
  const r = PAD_DIAMETER / 2 / Math.cos(Math.PI / 8); // octagon whose flat sides are PAD_DIAMETER apart
  k.cyl("pad", r, r, 0.2, 8, "frame", { at: [0, 0.1, 0], rot: [0, Math.PI / 8, 0] });
  k.cyl("pad stripe", r * 0.8, r * 0.8, 0.22, 8, "hullDark", { at: [0, 0.11, 0], rot: [0, Math.PI / 8, 0] });
  // Three ship-size boxes side by side: small (scout), medium (hauler), large (liner).
  k.box("small ship 3.5 long", 2.2, 0.9, 3.5, "red", { at: [-3.1, 0.65, 0] });
  k.box("medium ship 5.5 long", 2.6, 1.4, 5.5, "orange", { at: [0, 0.9, 0] });
  k.box("large ship 7 long", 2.8, 1.6, 7, "hullWhite", { at: [3.0, 1.0, 0] });
  // One crate = one unit.
  k.box("crate", 1, 1, 1, "teal", { at: [0, 0.7, -4.0] });
  // A pilot, about 0.9 crates tall (a person is about half a crate).
  k.box("pilot legs", 0.24, 0.42, 0.18, "frame", { at: [-1.4, 0.41, -4.0] });
  k.box("pilot body", 0.34, 0.34, 0.22, "yellow", { at: [-1.4, 0.79, -4.0] });
  k.ball("pilot head", 0.15, 0, "hullWhite", { at: [-1.4, 1.08, -4.0] });
  // A traffic cone, because every yard has one.
  k.cone("traffic cone", 0.25, 0.6, 6, "orange", { at: [1.5, 0.5, -4.0] });
  k.box("cone foot", 0.5, 0.06, 0.5, "frame", { at: [1.5, 0.23, -4.0] });
  k.box("pad light", 0.3, 0.3, 0.3, "lightGreen", { at: [r * 0.85, 0.35, 0], layer: "blinkA" });
  k.box("pad light 2", 0.3, 0.3, 0.3, "lightRed", { at: [-r * 0.85, 0.35, 0], layer: "blinkB" });
  k.anchor("parking", [0, 0.2, 0], [0, 1, 0]);
  k.anchor("crate", [0, 1.2, -4.0], [0, 1, 0]);
  return k.finish();
}

export const SCALE_TEST: AssetEntry = {
  id: "scale-test",
  name: "Size yard (reference)",
  kind: "reference",
  description: "Landing pad 9 crates wide, one crate, a pilot and three ship-size boxes.",
  variants: 1,
  build: () => buildScaleTest(),
  anchorNames: ["parking", "crate"],
  triangles: 204,
  status: "DRAFT",
};

/** A small shed with four things wrong on purpose. */
export function buildBrokenDemo(): ReturnType<ModelKit["finish"]> {
  const k = new ModelKit();
  k.box("floor", 4, 0.3, 4, "frame", { at: [0, 0.15, 0] });
  k.box("shed", 2, 1.5, 2, "hullMid", { at: [0, 1.05, 0] });
  // Wrong 1: a roof whose faces point inwards (built mirrored).
  const roof = new THREE.ConeGeometry(1.6, 1, 4);
  roof.scale(-1, 1, 1);
  k.add("roof (inside out)", roof, "red", { at: [0, 2.3, 0], rot: [0, Math.PI / 4, 0] });
  // Wrong 2: an antenna floating in the air.
  k.box("antenna (floating)", 0.2, 1.2, 0.2, "hullLight", { at: [1.5, 4.5, 1.5] });
  // Wrong 3: far too many triangles in one decoration.
  k.ball("disco ball (too detailed)", 0.4, 0, "pink", { at: [-1.5, 0.7, 1.5] });
  k.add("bush (too detailed)", new THREE.IcosahedronGeometry(0.5, 9), "teal", { at: [1.4, 0.7, -1.4] });
  // Wrong 4: the "beacon" anchor is missing (only parking is set).
  k.anchor("parking", [0, 0.3, 0], [0, 1, 0]);
  return k.finish();
}

export const BROKEN_DEMO: AssetEntry = {
  id: "broken-demo",
  name: "Broken on purpose (test)",
  kind: "outpost",
  description: "A shed with an inside-out roof, a floating antenna, too many triangles and a missing anchor.",
  variants: 1,
  build: () => buildBrokenDemo(),
  anchorNames: ["parking"],
  triangles: 0,
  status: "DRAFT",
};

export const REFERENCE_ENTRIES: AssetEntry[] = [COCKPIT_BASE_WIP, SCALE_TEST, BROKEN_DEMO];
