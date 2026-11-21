// HOTFIX 2026-11-21: the stored flight plan destination (localStorage "lazy-flight.nav-target") is checked before the game uses it.
// It is a browser preference, not part of the save, so dropping a bad one loses nothing important.
import { getDock, getSystem, type Seed } from "../universe";

export const NAV_TARGET_KEY = "lazy-flight.nav-target";

/** How long after start-up the map's flight plan line is first worked out (milliseconds). Never during start-up itself. */
export const ROUTE_START_DELAY_MS = 3000;

/**
 * The stored destination if it is a real place (a dock id like "43059078545/0", or a star system number as digits), else null.
 * Never throws: anything strange (too long, wrong shape, a place that does not exist) gives null.
 */
export function cleanNavTarget(seed: Seed, raw: unknown): string | null {
  try {
    if (typeof raw !== "string") return null;
    const id = raw.trim();
    if (id.length === 0 || id.length > 40) return null;
    if (/^\d{1,15}\/\d{1,3}$/.test(id)) return getDock(seed, id) ? id : null;
    if (/^\d{1,15}$/.test(id)) return getSystem(seed, Number(id)) ? id : null;
    return null;
  } catch {
    return null;
  }
}
