// The words on the galaxy map and its testing aid. Pure helpers (no Three.js), so they are easy to test.
// (Until stage G5a this file also sized the map from the ship's reach. The map now shows the nearest stars by COUNT and the reach only
// decides which of them get a diamond, so those helpers are gone.)

import { formatLy } from "./helpers";

/**
 * Testing aid: ?reach=60 pretends the ship can fly 60 ly. Only the diamonds change (the stars inside 60 ly get one); the game rules
 * do not change. Null if absent or nonsense.
 */
export function parseReachParam(search: string): number | null {
  const raw = new URLSearchParams(search).get("reach");
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n <= 1000 ? n : null;
}

/** The map text when no star is selected. */
export function starmapHint(): string {
  return "Tap a star to select it.\nDrag to turn the map, scroll or pinch to zoom.";
}

/** The label of a selected star: its name, star type and distance. (No fuel words: the real fuel numbers are on the planet card.) */
export function starLabelText(name: string, starType: string, distanceLy: number, here: boolean): string {
  return `${name}\n${starType} - ${here ? "you are here" : formatLy(distanceLy)}`;
}
