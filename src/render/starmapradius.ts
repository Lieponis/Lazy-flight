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

/** A place to look at the map from, for testing (not the player's real position). */
export interface MapTestPlace {
  name: string;
  position: { x: number; y: number; z: number };
}

const polar = (radius: number, angle: number): { x: number; y: number; z: number } => ({ x: radius * Math.cos(angle), y: 0, z: radius * Math.sin(angle) });

/**
 * Testing aid: ?mapat=centre|start|middle|rim (or ?mapat=x,y,z in light years) shows the galaxy map and its sky as seen from that place,
 * without moving the ship. The names are the four places of stage G5a: the dense centre, the start, the middle of the disc and the rim.
 * `start` is the game's start point (the caller gives it). Null if absent or nonsense.
 */
export function parseMapAt(search: string, start: { x: number; y: number; z: number }): MapTestPlace | null {
  const raw = new URLSearchParams(search).get("mapat");
  if (raw === null) return null;
  const word = raw.trim().toLowerCase();
  if (word === "centre" || word === "center") return { name: "centre", position: polar(400, 0.3) };
  if (word === "start") return { name: "start", position: { x: start.x, y: start.y, z: start.z } };
  if (word === "middle") return { name: "middle", position: polar(30000, 4.0) };
  if (word === "rim") return { name: "rim", position: polar(48000, 5.2) };
  const parts = word.split(",").map((t) => Number(t));
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) return { name: `${parts[0]},${parts[1]},${parts[2]}`, position: { x: parts[0]!, y: parts[1]!, z: parts[2]! } };
  return null;
}

/** The map text when no star is selected. */
export function starmapHint(): string {
  return "Tap a star to select it.\nDrag to turn the map, scroll or pinch to zoom.";
}

/** The label of a selected star: its name, star type and distance. (No fuel words: the real fuel numbers are on the planet card.) */
export function starLabelText(name: string, starType: string, distanceLy: number, here: boolean): string {
  return `${name}\n${starType} - ${here ? "you are here" : formatLy(distanceLy)}`;
}
