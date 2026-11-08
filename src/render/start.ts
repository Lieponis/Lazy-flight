// Works out which system the player starts in (see src/render/settings.ts).

import { getSystem, listSystemsNear, type Seed, type StarSystem } from "../universe";
import { START_POINT, START_SYSTEM_ID } from "./settings";

export function findStartSystem(seed: Seed): StarSystem | null {
  if (START_SYSTEM_ID) {
    const chosen = getSystem(seed, START_SYSTEM_ID);
    if (chosen) return chosen;
  }
  for (const radius of [10, 20, 40, 80, 160, 320]) {
    const found = listSystemsNear(seed, START_POINT, radius);
    const nearest = found[0];
    if (nearest) return nearest;
  }
  return null;
}
