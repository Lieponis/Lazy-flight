// SMALL PURE HELPERS for the galaxy map preview page (prototype G2). No Three.js, no page code, so they can be tested.

import { DENSITY_SPACINGS } from "./neardata";
import { TELEPORTS, type LookId, type Teleport } from "./galaxyfield";
import { SKY_LOOKS, type SkyLookId } from "./skylook";
import type { Vec3 } from "./skycube";

/** Orbit camera angles (see OrbitView in ../input.ts) that make the camera LOOK along `dir`. */
export function orbitAnglesFor(dir: Vec3): { yaw: number; pitch: number } {
  const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
  // The camera sits opposite to where it looks: its offset from the target is -dir.
  const ox = -dir.x / len;
  const oy = -dir.y / len;
  const oz = -dir.z / len;
  const pitch = Math.asin(Math.max(-1, Math.min(1, oy)));
  const yaw = Math.hypot(ox, oz) < 1e-6 ? 0 : Math.atan2(ox, oz);
  return { yaw, pitch };
}

export type FaceSize = 32 | 64 | 128;
export const FACE_SIZES: FaceSize[] = [32, 64, 128];
export const REACHES = [55, 80] as const;
export const TAP_COUNTS = [1000, 10000, 20000] as const;
export const DIAMOND_CAPS = [2000, 5000, 10000, 20000] as const;
/** How many nearby stars the preview makes in total (the nearest ones are tappable, all are drawn as pixels). */
export const NEAR_TOTAL = 60000;

export interface PreviewParams {
  place: Teleport["id"];
  look: LookId;
  sky: SkyLookId;
  face: FaceSize;
  /** "auto" = the spacing of the place; or one of 2, 8.6, 30. */
  density: "auto" | (typeof DENSITY_SPACINGS)[number];
  reach: (typeof REACHES)[number];
  tap: (typeof TAP_COUNTS)[number];
  diamonds: (typeof DIAMOND_CAPS)[number];
  glow: boolean;
  dots: boolean;
  pixels: boolean;
  diamondsOn: boolean;
}

export const DEFAULT_PARAMS: PreviewParams = {
  place: "start",
  look: "centre",
  sky: "A",
  face: 64,
  density: "auto",
  reach: 55,
  tap: 10000,
  diamonds: 5000,
  glow: true,
  dots: true,
  pixels: true,
  diamondsOn: true,
};

function pick<T extends string | number>(value: string | null, allowed: readonly T[], fallback: T): T {
  if (value === null) return fallback;
  for (const a of allowed) if (String(a) === value) return a;
  return fallback;
}

function flag(value: string | null, fallback: boolean): boolean {
  if (value === "1" || value === "on") return true;
  if (value === "0" || value === "off") return false;
  return fallback;
}

/** Reads the preview's settings from the page address, for example `?place=rim&look=up&sky=C&face=128`. Wrong values are ignored. */
export function parsePreviewParams(search: string): PreviewParams {
  const q = new URLSearchParams(search);
  const d = DEFAULT_PARAMS;
  const densityText = q.get("density");
  let density: PreviewParams["density"] = "auto"; // a missing or wrong value means "auto"
  for (const spacing of DENSITY_SPACINGS) if (String(spacing) === densityText) density = spacing;
  return {
    place: pick(
      q.get("place"),
      TELEPORTS.map((t) => t.id),
      d.place,
    ),
    look: pick(q.get("look"), ["centre", "rim", "up"] as const, d.look),
    sky: pick(q.get("sky"), Object.keys(SKY_LOOKS) as SkyLookId[], d.sky),
    face: pick(q.get("face"), FACE_SIZES, d.face),
    density,
    reach: pick(q.get("reach"), REACHES, d.reach),
    tap: pick(q.get("tap"), TAP_COUNTS, d.tap),
    diamonds: pick(q.get("diamonds"), DIAMOND_CAPS, d.diamonds),
    glow: flag(q.get("glow"), d.glow),
    dots: flag(q.get("dots"), d.dots),
    pixels: flag(q.get("pixels"), d.pixels),
    diamondsOn: flag(q.get("dia"), d.diamondsOn),
  };
}

/** "16,667 ly" style text. */
export function lyText(n: number): string {
  return `${Math.round(n).toLocaleString("en-US")} ly`;
}

/** Size of one diamond (light years across) for a star of the game's size class: a bit smaller than the game map's diamonds. */
export function diamondSize(starRadius: number): number {
  return 0.6 * (0.55 + 0.3 * Math.max(0.5, Math.min(3, starRadius)));
}

/**
 * Brightness (0..1) of a pixel star: the closer the brighter. `d` = distance from the player, `far` = distance of the farthest
 * drawn star. The shader has the same formula.
 */
export function pixelBrightness(d: number, far: number): number {
  const x = Math.max(0, Math.min(1, d / Math.max(far, 1e-6)));
  return 1 - 0.82 * Math.pow(x, 0.6);
}
