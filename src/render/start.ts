// Works out which system the player starts in (see src/render/settings.ts).

import { getSystem, startSystem, type Seed, type StarSystem } from "../universe";
import { START_SYSTEM_ID } from "./settings";

export function findStartSystem(seed: Seed): StarSystem | null {
  if (START_SYSTEM_ID) {
    const chosen = getSystem(seed, START_SYSTEM_ID);
    if (chosen) return chosen;
  }
  // The universe decides where a game starts (every layer uses this one function, so they all agree).
  try {
    return startSystem(seed);
  } catch {
    return null;
  }
}
