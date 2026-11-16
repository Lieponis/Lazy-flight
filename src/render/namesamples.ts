// SAMPLE NAMES FOR THE LONG-NAME PREVIEW (stage 3i, pure logic). Picks the longest and the shortest real names of a region of the universe
// (from data the caller passes in; this file reads nothing itself) and adds worst cases made up to the length limits.
// Limits (src/universe): system 42 letters, planet 47, dock full name 75.

import { splitCodedName } from "./namefit";

/** The longest a name can be (the same numbers as src/universe MAX_*_LENGTH; checked by tests/namefit.test.ts via the made-up names). */
export const LIMIT_SYSTEM = 42;
export const LIMIT_PLANET = 47;
export const LIMIT_DOCK_FULL = 75;

/** Made-up worst cases: as long as the universe allows. */
export const WORST_SYSTEM = "Fizniploo Jambazook Quindleberry Smo 89-3R"; // 42
export const WORST_PLANET = `${WORST_SYSTEM} VIII`; // 47
export const WORST_DOCK = "Lonely Basin Outpost Hub"; // the dock's own short name
export const WORST_DOCK_FULL = `${WORST_DOCK}, ${WORST_PLANET}`; // 73
/** The longest code the generator makes (RP5N3-MT662) on a normal word. */
export const WORST_CODE_PLANET = "Kopipex RP5N3-MT662 II";

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
  add("WORST CASE: DOCK + PLACE (73 letters)", WORST_DOCK_FULL);
  add("WORST CASE: PLANET (47)", WORST_PLANET);
  add("WORST CASE: SYSTEM (42)", WORST_SYSTEM);
  add("LONGEST CODE (RP5N3-MT662)", WORST_CODE_PLANET);
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
