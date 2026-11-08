// THE STYLE NUMBERS: budgets, sizes, required anchors, animation speeds.
// docs/STYLE-GUIDE.md explains each one in plain words. The tests and the problem checker read them from here.

import type { AssetKind } from "./types";

/** Size unit: 1 unit = one standard cargo crate (about 2 metres). All models share it. */
export const UNIT_NAME = "crate";

export interface KindRules {
  /** Most triangles allowed. */
  maxTriangles: number;
  /** Most separate meshes (each mesh is one draw call, which costs phones). */
  maxMeshes: number;
  /** Most materials. */
  maxMaterials: number;
  /** Allowed range for the longest side, in crate units. */
  size: { min: number; max: number };
  /** Anchors every model of this kind must have. */
  requiredAnchors: readonly string[];
  /** Ship engines: at least one of these sets must be complete. */
  engineAnchors?: readonly (readonly string[])[];
}

export const RULES: Record<AssetKind, KindRules> = {
  ship: {
    maxTriangles: 1000, // raised from 700 by Andy (2026-11-08) for more detail
    maxMeshes: 4,
    maxMaterials: 2,
    size: { min: 2.5, max: 8 },
    requiredAnchors: ["parking", "eye", "nose"],
    engineAnchors: [["engineL", "engineR"], ["engineMain"]],
  },
  outpost: {
    maxTriangles: 1500,
    maxMeshes: 6,
    maxMaterials: 2,
    size: { min: 8, max: 28 },
    requiredAnchors: ["parking", "beacon", "entrance"],
  },
  station: {
    maxTriangles: 2500,
    maxMeshes: 6,
    maxMaterials: 2,
    size: { min: 16, max: 48 },
    requiredAnchors: ["parking", "dockEntrance"],
  },
  reference: {
    maxTriangles: 700,
    maxMeshes: 4,
    maxMaterials: 2,
    size: { min: 1, max: 20 },
    requiredAnchors: ["parking"],
  },
};

/** Stations that spin must also have this anchor. */
export const SPIN_ANCHOR = "spinAxis";

/** The landing pad and the station bay must fit the biggest ship with room to spare. */
export const PAD_DIAMETER = 9;
export const BAY_SIZE = { width: 9, height: 4, depth: 9 };

/** Thinnest part that still shows at game resolution (about 3 screen pixels in the docked view). */
export const MIN_PART_THICKNESS = 0.2;

/** Blinking lights: one cycle every 2 seconds, on for 1.2 s. Two groups (A and B) take turns. */
export const BLINK_PERIOD = 2;
export const BLINK_ON = 1.2;

/** Spinning rings: radians per second. 0.1 = one full turn in about a minute. Never faster than 0.2. */
export const RING_SPIN_SPEED = 0.1;
export const RING_SPIN_MAX = 0.2;

/** Engine flame length (scale along Z): parked, flying, warp. */
export const FLAME_PARKED = 0.15;
export const FLAME_FLYING = 1;
export const FLAME_WARP = 3;

/** The game's light direction for baked shading (same as src/render/ship.ts). */
export const LIGHT_DIR: readonly [number, number, number] = [0.4, 0.8, 0.45];

/** The game's docked-view camera, so the viewer can show "what the player sees". */
export const GAME_CAMERA = { fov: 50, distance: 14, angleDeg: 28 };
