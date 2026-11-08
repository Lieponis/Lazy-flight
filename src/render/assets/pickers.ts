// VARIANT PICKERS: which outpost or station design a dock gets.
// Pure functions: the same dock always gets the same design. Nothing is stored.
// They use the universe's hash helper only (render may import universe; universe never imports render).
//
// The lists are filled when the designs exist: outposts in stage S2, stations in stage S3.
// Until then the pickers return null ("no design yet, keep the old shape").

import { hashString } from "../../universe";

/** Outpost asset ids, in a fixed order. Adding one changes which docks get which look, so add only before integration. */
export const OUTPOST_IDS: readonly string[] = [];

/** Station asset ids, in a fixed order. */
export const STATION_IDS: readonly string[] = [];

/** The outpost design for a dock, e.g. pickOutpostVariant("3:-2:5:0/2", "DESERT"). */
export function pickOutpostVariant(dockId: string, planetType: string): string | null {
  if (OUTPOST_IDS.length === 0) return null;
  return OUTPOST_IDS[hashString(`outpost|${planetType}|${dockId}`) % OUTPOST_IDS.length] ?? null;
}

/** The station design for a dock, e.g. pickStationVariant("3:-2:5:0/2"). */
export function pickStationVariant(dockId: string): string | null {
  if (STATION_IDS.length === 0) return null;
  return STATION_IDS[hashString(`station|${dockId}`) % STATION_IDS.length] ?? null;
}
