// SHIP LIVERIES (paint jobs). Cosmetic only: a livery swaps the colours of the paint parts of a ship (hull, panels,
// dark parts, underside, company marks); shapes, triangle counts and anchors stay exactly the same. Glass, lights and
// engine flames are never repainted. No livery (or "standard") = the ship exactly as before.
// DECIDED (Andy, 2026-11-11): 3 new liveries plus the standard look per ship; smart company-fleet colours; nothing
// jokey; each ship's set suits its job; colours only (no new markings).

import type { PalKey } from "./palette";

/** The paint parts a livery may repaint. `marks` = the ship's company-colour patches. */
export interface LiveryColours {
  hull?: number; // paintWhite: the main paint
  panels?: number; // paintGrey: the second paint
  dark?: number; // metalDark: dark metal parts
  underside?: number; // underside: the belly
  marks?: number; // the company-colour patches (orange / blue / teal)
}

export interface Livery {
  id: string;
  name: string;
  description: string;
  colours: LiveryColours;
}

/** Every ship's default livery id: the look from before liveries existed. */
export const DEFAULT_LIVERY = "standard";

/** Which palette colour plays each paint role on each ship. (The Scout's body is the grey paint and its side pods
 *  are dark metal, so on the Scout "hull" = paintGrey and "panels" = metalDark.) */
const ROLES: Record<string, Partial<Record<keyof LiveryColours, PalKey>>> = {
  "cargo-hauler": { hull: "paintWhite", panels: "paintGrey", dark: "metalDark", underside: "underside", marks: "orange" },
  "passenger-liner": { hull: "paintWhite", panels: "paintGrey", dark: "metalDark", underside: "underside", marks: "blue" },
  scout: { hull: "paintGrey", panels: "metalDark", underside: "underside", marks: "teal" },
};

const STANDARD: Livery = { id: DEFAULT_LIVERY, name: "Standard", description: "The original paint.", colours: {} };

/** Liveries per ship id, the standard one first. */
export const LIVERIES: Record<string, Livery[]> = {
  // Option C (Andy): bright company colours, the whole hull in one bold colour.
  "cargo-hauler": [
    STANDARD,
    { id: "hazard-yellow", name: "Hazard Yellow", description: "Yellow hull with black panels and white marks, like heavy site machinery.", colours: { hull: 0xf2c230, panels: 0x2c2f36, dark: 0x3a3d45, marks: 0xe6e8ec } },
    { id: "teal-line", name: "Teal Line", description: "White hull with teal panels and navy marks: a tidy freight company.", colours: { hull: 0xe6e8ec, panels: 0x2fb5a8, dark: 0x3c4a55, marks: 0x2f3d5c } },
    { id: "orange-express", name: "Orange Express", description: "Orange hull with white panels and navy marks: the fast parcel service.", colours: { hull: 0xf08a3c, panels: 0xe6e8ec, dark: 0x3c4150, marks: 0x2f3d5c } },
  ],
  // Airline colours.
  "passenger-liner": [
    STANDARD,
    { id: "sky-blue", name: "Sky Blue Air", description: "Sky blue hull with white panels and yellow marks: a cheerful holiday airline.", colours: { hull: 0x5aa7e6, panels: 0xe6e8ec, dark: 0x3c4150, marks: 0xffd23d } },
    { id: "royal-purple", name: "Royal Purple", description: "Deep purple hull with white panels and gold marks: the luxury line.", colours: { hull: 0x6a4fb5, panels: 0xe6e8ec, dark: 0x3a3550, marks: 0xffd23d } },
    { id: "coral-sunset", name: "Coral Sunset", description: "Coral hull with cream panels and navy marks: a warm tour company.", colours: { hull: 0xef6f5a, panels: 0xf2e6d8, dark: 0x4a3c3c, marks: 0x2f3d5c } },
  ],
  // Explorer colours.
  scout: [
    STANDARD,
    { id: "survey-lime", name: "Survey Lime", description: "Lime hull with black side pods and white marks: the survey office, easy to find on a rock.", colours: { hull: 0xa6d13a, panels: 0x2c2f36, marks: 0xe6e8ec } },
    { id: "rescue-red", name: "Rescue Red", description: "Red hull with white side pods and dark marks: search and rescue.", colours: { hull: 0xd9483b, panels: 0xe6e8ec, marks: 0x2c2f36 } },
    { id: "electric-blue", name: "Electric Blue", description: "Bright blue hull with white side pods and yellow marks: a sporty explorer.", colours: { hull: 0x3d7fe0, panels: 0xe6e8ec, marks: 0xffd23d } },
  ],
};

/** The liveries of a ship (just the standard one for unknown ids). */
export function liveriesFor(shipId: string): Livery[] {
  return LIVERIES[shipId] ?? [STANDARD];
}

/** Palette colour overrides for a ship's livery; empty for the standard look or an unknown id. */
export function liveryRecolour(shipId: string, liveryId: string | undefined): Partial<Record<PalKey, number>> {
  const livery = liveriesFor(shipId).find((l) => l.id === liveryId);
  if (!livery) return {};
  const roles = ROLES[shipId] ?? {};
  const out: Partial<Record<PalKey, number>> = {};
  for (const [role, colour] of Object.entries(livery.colours) as [keyof LiveryColours, number][]) {
    const key = roles[role];
    if (key) out[key] = colour;
  }
  return out;
}
