// How big the galaxy map is, and the words on a star's label. Pure helpers (no Three.js), so they are easy to test.

import { STARMAP_MAX_RADIUS_LY, STARMAP_RADIUS_LY, STARMAP_RADIUS_PAD_LY } from "./settings";
import { formatLy } from "./helpers";

/**
 * The radius (light years) of the galaxy map around the current system.
 * `reachLy` = how far the current ship can fly with the fuel on board (the app works it out and tells the render layer).
 * Never smaller than the normal map (35 ly), a little bigger than the reach so the farthest reachable star is not on the edge,
 * and never bigger than the cap (more stars would slow a phone down).
 */
export function starmapRadius(
  reachLy: number | null | undefined,
  cap: number = STARMAP_MAX_RADIUS_LY,
  base: number = STARMAP_RADIUS_LY,
  pad: number = STARMAP_RADIUS_PAD_LY,
): number {
  const top = Math.max(base, cap);
  if (reachLy === null || reachLy === undefined || !Number.isFinite(reachLy) || reachLy <= 0) return base;
  return Math.min(top, Math.max(base, Math.ceil(reachLy + pad)));
}

/** Testing aid: ?reach=60 pretends the ship can fly 60 ly (map size only; the game rules do not change). Null if absent or nonsense. */
export function parseReachParam(search: string): number | null {
  const raw = new URLSearchParams(search).get("reach");
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n <= 1000 ? n : null;
}

/** True when the ship can fly farther than the map shows (then the map says so). */
export function reachBeyondMap(reachLy: number | null | undefined, cap: number = STARMAP_MAX_RADIUS_LY): boolean {
  return reachLy !== null && reachLy !== undefined && Number.isFinite(reachLy) && reachLy > cap;
}

/** The map text when no star is selected. `farNote` adds the line about stars beyond the edge of the map. */
export function starmapHint(farNote: boolean): string {
  const base = "Tap a star to select it.\nDrag to turn the map, scroll or pinch to zoom.";
  return farNote ? `${base}\nFarther stars are out of the map for now.` : base;
}

/** The label of a selected star: its name, star type and distance. (No fuel words: the real fuel numbers are on the planet card.) */
export function starLabelText(name: string, starType: string, distanceLy: number, here: boolean): string {
  return `${name}\n${starType} - ${here ? "you are here" : formatLy(distanceLy)}`;
}

/** How far the camera may zoom out, how far the background stars and the far clip are, for a map of this radius. */
export function starmapCameraLimits(radiusLy: number): { maxDist: number; backdropRadius: number; far: number } {
  const maxDist = Math.max(90, Math.round(radiusLy * 2.6));
  const backdropRadius = Math.max(450, maxDist * 2);
  return { maxDist, backdropRadius, far: backdropRadius + maxDist + radiusLy + 50 };
}
