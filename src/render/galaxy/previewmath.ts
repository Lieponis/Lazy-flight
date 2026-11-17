// SMALL PURE HELPERS for the galaxy map preview page (prototype G2). No Three.js, no page code, so they can be tested.

import { DENSITY_SPACINGS } from "./neardata";
import { TELEPORTS, type LookId, type Teleport } from "./galaxyfield";
import { SKY_LOOKS, type SkyLookId } from "./skylook";
import type { Vec3 } from "./skyglow";

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
/**
 * Ship reach choices in light years: 55 and 80 are the ships of today, 250 and 1,000 stand in for ships Andy will add later
 * (at the rim the stars are about 134 ly apart, so only a long reach has any diamonds there).
 */
export const REACHES = [55, 80, 250, 1000] as const;
/** "auto" picks, for the place you stand at, the shortest reach that holds at least AUTO_REACH_STARS stars. */
export const AUTO_REACH_STARS = 200;
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
  reach: "auto" | (typeof REACHES)[number];
  tap: (typeof TAP_COUNTS)[number];
  zoom: ZoomOutMode;
  diamonds: (typeof DIAMOND_CAPS)[number];
  glow: boolean;
  dots: boolean;
  pixels: boolean;
  diamondsOn: boolean;
}

export const DEFAULT_PARAMS: PreviewParams = {
  place: "start",
  look: "centre",
  sky: "C",
  face: 64,
  density: "auto",
  reach: "auto",
  tap: 10000,
  zoom: "near",
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
    reach: pick<string | number>(q.get("reach"), ["auto", ...REACHES], d.reach) as PreviewParams["reach"],
    tap: pick(q.get("tap"), TAP_COUNTS, d.tap),
    zoom: pick(q.get("zoom"), ZOOM_OUT_MODES, d.zoom),
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

/** The fade starts at this share of the bubble radius. */
export const EDGE_FADE_START = 0.7;

/** How much of a star's light is left at distance `d` when the near-star bubble has radius `radius`: 1 inside, falling smoothly to 0 at the edge. */
export function edgeFade(d: number, radius: number): number {
  const x = Math.max(0, Math.min(1, d / Math.max(radius, 1e-6)));
  const t = Math.max(0, Math.min(1, (x - EDGE_FADE_START) / (1 - EDGE_FADE_START)));
  return 1 - t * t * (3 - 2 * t);
}
/**
 * Brightness (0..1) of a pixel star: the closer the brighter, and it fades to nothing at the edge of the bubble so the bubble
 * has no visible edge. `d` = distance from the player, `far` = radius of the bubble. The shader has the same formula.
 */
export function pixelBrightness(d: number, far: number): number {
  const x = Math.max(0, Math.min(1, d / Math.max(far, 1e-6)));
  return (1 - 0.82 * Math.pow(x, 0.6)) * edgeFade(d, far);
}

/** The camera may never leave the near-star bubble: it stays within this share of the bubble radius from the player. */
export const MAX_ZOOM_SHARE = 0.9;

/**
 * How far the camera may zoom out (Andy: at the rim the zoomed-out ball of stars made no sense, so the limit follows the local
 * star spacing instead of the bubble): "near" = out to the nearest 1,000 stars, "medium" = twice that, "wide" = almost the whole bubble.
 */
export type ZoomOutMode = "near" | "medium" | "wide";
export const ZOOM_OUT_MODES: readonly ZoomOutMode[] = ["near", "medium", "wide"];
/** How many of the nearest stars the "near" zoom-out limit reaches out to. */
export const ZOOM_OUT_STARS = 1000;
/** Near a target the camera can always back off at least this far (light years), even at the bubble's limit. */
export const ROOM_AROUND_TARGET_LY = 12;

/** The zoom-out limit as a distance from the player (light years). `starDistances` = distances of the stars, nearest first. */
export function zoomOutLimit(mode: ZoomOutMode, starDistances: ArrayLike<number>, starCount: number, bubbleRadius: number): number {
  const wide = MAX_ZOOM_SHARE * bubbleRadius;
  if (mode === "wide") return wide;
  const nearest = starDistances[Math.max(0, Math.min(ZOOM_OUT_STARS, starCount) - 1)] ?? bubbleRadius;
  return Math.min(wide, (mode === "near" ? 1 : 2) * nearest);
}
/** Closest zoom (light years from what the camera looks at): a diamond is about 0.7 ly wide, so it fills a good part of the screen. */
export const MIN_ZOOM_LY = 2.5;
/** After tapping a star, the camera glides to this distance from it. */
export const FLY_TO_DIST_LY = 6;

/**
 * The farthest the camera may be from its target so that it stays within `limit` of the player (the player is at 0,0,0):
 * the camera sits at target + dist * u, u being the unit vector from the target to the camera. Never less than `minDist`.
 */
export function maxOrbitDistance(target: Vec3, u: Vec3, limit: number, minDist: number): number {
  const tu = target.x * u.x + target.y * u.y + target.z * u.z;
  const tt = target.x * target.x + target.y * target.y + target.z * target.z;
  const room = tu * tu + limit * limit - tt;
  if (room <= 0) return minDist;
  return Math.max(minDist, -tu + Math.sqrt(room));
}

/** The reach "auto" uses: the shortest of REACHES holding at least AUTO_REACH_STARS stars (the longest if none does). */
export function autoReach(starsWithin: (reach: number) => number): number {
  for (const r of REACHES) if (starsWithin(r) >= AUTO_REACH_STARS) return r;
  return REACHES[REACHES.length - 1] as number;
}
