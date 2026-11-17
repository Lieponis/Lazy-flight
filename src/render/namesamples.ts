// SAMPLE NAMES FOR THE LONG-NAME PREVIEW (stage 3i, pure logic; names updated for universe v3 in stage G5a). Picks the longest and the
// shortest real names of a region of the universe (from data the caller passes in; this file reads nothing itself) and adds worst
// cases made to the length limits.
// Limits (src/universe, universe v3): system 29 letters, planet 34, dock full name 62.

import { splitCodedName } from "./namefit";

/** The longest a name can be (the same numbers as src/universe MAX_*_LENGTH; tests/namefit.test.ts checks them against the universe). */
export const LIMIT_SYSTEM = 29;
export const LIMIT_PLANET = 34;
export const LIMIT_DOCK_FULL = 62;

/**
 * Worst cases of universe v3, as long as the generator can make them (all parts are real words and a real-looking code):
 * the longest system name (word + "Junction" + code), the longest planet (that system + "VIII"), and the longest dock (the longest
 * station name that exists, "Gleaming Marmalade Station", at that planet).
 */
export const WORST_SYSTEM = "Snugaploo Junction HH8H3-2526"; // 29
export const WORST_PLANET = `${WORST_SYSTEM} VIII`; // 34
export const WORST_DOCK = "Gleaming Marmalade Station"; // the dock's own name, 26: the longest one the word lists make
export const WORST_DOCK_FULL = `${WORST_DOCK}, ${WORST_PLANET}`; // 62
/** A short word with the longest code (10 characters): the code must stay whole, the word gives way. */
export const WORST_CODE_PLANET = "Kopipex HH8H3-2526 VIII";

/** The real names at the start of the universe (seed 12345, checked against the universe by tests/namefit.test.ts). */
export const START_SYSTEM = "Bimvik Deep JR62R-MT37";
export const START_PLANET = "Bimvik Deep JR62R-MT37 III";
export const START_DOCK_FULL = "Breezy Hill Outpost, Bimvik Deep JR62R-MT37 III";

/**
 * Stress names LONGER than universe v3 allows (the lengths of the first prototype: 42, 47 and 73 letters). Not a case that can happen.
 * They keep the proof that the screens fit with room to spare, and they show what a future longer-name universe would look like.
 */
export const STRESS_SYSTEM = "Fizniploo Jambazook Quindleberry Smo 89-3R"; // 42
export const STRESS_PLANET = `${STRESS_SYSTEM} VIII`; // 47
export const STRESS_DOCK_FULL = `Lonely Basin Outpost Hub, ${STRESS_PLANET}`; // 73

export interface NameSample {
  /** What this example is, for the caption under the picture. */
  label: string;
  /** The name as the game would hand it to the screen. */
  text: string;
  /** The caption above the name on the info screen ("TO", "NEXT STOP 2/3" ...). */
  heading: string;
}

/** What the caller reads from the universe for each system of a region. */
export interface SampleSource {
  system: string;
  planets: readonly string[];
  docks: readonly { name: string; fullName: string }[];
}

const longest = (list: readonly string[]): string | undefined => list.reduce<string | undefined>((best, t) => (best === undefined || t.length > best.length ? t : best), undefined);
const shortest = (list: readonly string[]): string | undefined => list.reduce<string | undefined>((best, t) => (best === undefined || t.length < best.length ? t : best), undefined);
const isPure = (name: string): boolean => splitCodedName(name) === null;

/** The examples to show: real ones from the region first, then the made-up worst cases and two tour stops. Missing kinds are left out. */
export function pickSamples(sources: readonly SampleSource[]): NameSample[] {
  const systems = sources.map((s) => s.system);
  const planets = sources.flatMap((s) => s.planets);
  const docksShort = sources.flatMap((s) => s.docks.map((d) => d.name));
  const docksFull = sources.flatMap((s) => s.docks.map((d) => d.fullName));
  const pureSystems = sources.filter((s) => isPure(s.system));
  const purePlanets = pureSystems.flatMap((s) => s.planets);
  const pureDocks = pureSystems.flatMap((s) => s.docks.map((d) => d.fullName));

  const out: NameSample[] = [];
  const add = (label: string, text: string | undefined, heading = "TO"): void => {
    if (text && !out.some((o) => o.text === text && o.heading === heading)) out.push({ label, text, heading });
  };
  add("SHORT DOCK NAME", shortest(docksShort));
  add("LONGEST DOCK NAME HERE (as the game sends it today)", longest(docksShort));
  add("LONGEST DOCK + PLACE HERE (unique full name)", longest(docksFull));
  add("LONGEST PLANET HERE (free trip)", longest(planets));
  add("LONGEST SYSTEM HERE", longest(systems));
  add("PURE NAME: PLANET (no code)", longest(purePlanets));
  add("PURE NAME: DOCK + PLACE (no code)", longest(pureDocks));
  add("REAL START: DOCK + PLACE", START_DOCK_FULL);
  add("REAL START: PLANET", START_PLANET);
  add("REAL START: SYSTEM", START_SYSTEM);
  add(`WORST CASE: DOCK + PLACE (${WORST_DOCK_FULL.length} letters, the universe's limit)`, WORST_DOCK_FULL);
  add(`WORST CASE: PLANET (${WORST_PLANET.length})`, WORST_PLANET);
  add(`WORST CASE: SYSTEM (${WORST_SYSTEM.length})`, WORST_SYSTEM);
  add("SHORT WORD, LONGEST CODE (HH8H3-2526)", WORST_CODE_PLANET);
  add(`STRESS: DOCK + PLACE (${STRESS_DOCK_FULL.length} letters, longer than the universe allows)`, STRESS_DOCK_FULL);
  add("TOUR: NEXT STOP", WORST_DOCK_FULL, "NEXT STOP 2/3");
  add("TOUR: FINAL STOP", longest(docksFull) ?? WORST_DOCK_FULL, "FINAL STOP 3/3");
  return out;
}

/** ?namepreview=1 */
export function parseNamePreview(search: string): boolean {
  const m = /[?&]namepreview=([^&]*)/i.exec(search);
  if (!m) return false;
  const v = (m[1] ?? "").toLowerCase();
  return v !== "0" && v !== "false";
}
