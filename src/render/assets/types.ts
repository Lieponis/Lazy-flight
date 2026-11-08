// The shapes of things in the asset system. No drawing here.
//
// Words used:
//   asset   = one design (a ship, an outpost or a station), with an id like "cargo-hauler".
//   variant = one of several looks of the same asset (outposts and stations have 4).
//   anchor  = a named point on the model that other code uses (where the ship parks, where the engine is).
//   tint    = the planet's colour, used to colour some parts so the model suits its planet.

import type * as THREE from "three";

export type AssetKind = "ship" | "outpost" | "station" | "reference";

/** A named point. `dir` is the way it faces (for example where the cockpit camera looks). */
export interface Anchor {
  pos: THREE.Vector3;
  dir: THREE.Vector3;
}

export type Anchors = Record<string, Anchor>;

/** Things that move. The game (and the viewer) call `update(seconds)` every frame; nothing else changes per frame. */
export interface AssetAnimation {
  /** Blinking lights: meshes that are shown and hidden. Group "A" and group "B" take turns. */
  blinkers: { mesh: THREE.Mesh; group: "A" | "B" }[];
  /** Parts that turn slowly, for example a station ring. Speed in radians per second. */
  spinners: { object: THREE.Object3D; axis: THREE.Vector3; speed: number }[];
  /** Engine flames. Scale them along Z (length) for launch and warp. Kept short when parked. */
  flames: THREE.Mesh[];
}

export interface AssetModel {
  group: THREE.Group;
  anchors: Anchors;
  animation: AssetAnimation;
  /** Moves the declared animations to time `t` (seconds since start). Cheap. */
  update(t: number): void;
}

export interface BuildOptions {
  /** Which look (0, 1, 2, ...). Ignored by assets with one look. */
  variant?: number;
  /** Planet colour as a number, e.g. 0xff8844. Only parts marked "tinted" use it. */
  tint?: number;
}

export interface AssetEntry {
  id: string;
  name: string;
  kind: AssetKind;
  /** One line for menus and the catalog. */
  description: string;
  /** How many looks it has (1 for ships). */
  variants: number;
  /** Builds a fresh model. Same options give the same model every time. */
  build(options?: BuildOptions): AssetModel;
  /** Names of the anchors it provides. */
  anchorNames: readonly string[];
  /** Triangle count of the largest variant (checked by the tests against the real number). */
  triangles: number;
  status: "DRAFT" | "APPROVED" | "INTEGRATED";
}
