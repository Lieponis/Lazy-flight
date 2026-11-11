// LAYER 2: a star system. Uses the galaxy layer (its address) and adds name, star and planet count.

import type { SystemSite, Vec3 } from "./galaxy";
import { generateSystemName } from "./names";
import { rngFor, type Seed } from "./random";
import { MAX_PLANETS, MIN_PLANETS } from "./settings";

export type StarType = "RED_DWARF" | "ORANGE" | "YELLOW" | "WHITE" | "BLUE" | "RED_GIANT";

interface StarKind {
  type: StarType;
  label: string;
  color: string; // friendly color as #rrggbb
  radius: number; // relative size for drawing (1 = a normal sun)
  weight: number; // how common
}

const STAR_KINDS: readonly StarKind[] = [
  { type: "RED_DWARF", label: "Red dwarf", color: "#ff5a3c", radius: 0.5, weight: 30 },
  { type: "ORANGE", label: "Orange star", color: "#ff9a3c", radius: 0.8, weight: 22 },
  { type: "YELLOW", label: "Yellow star", color: "#ffe14a", radius: 1.0, weight: 22 },
  { type: "WHITE", label: "White star", color: "#f4f8ff", radius: 1.3, weight: 12 },
  { type: "BLUE", label: "Blue star", color: "#58a6ff", radius: 1.8, weight: 8 },
  { type: "RED_GIANT", label: "Red giant", color: "#ff3b2f", radius: 3.0, weight: 6 },
];

export interface Star {
  type: StarType;
  label: string;
  color: string;
  radius: number;
}

export interface StarSystem {
  /** Same id as its galaxy address, e.g. "3:-2:5:0". */
  id: string;
  name: string;
  position: Vec3;
  star: Star;
  /** 1 to 10. Use getPlanetsOfSystem to get the planets themselves. Only some planets have a dock (see docksOf). */
  planetCount: number;
}

export function generateSystem(seed: Seed, site: SystemSite): StarSystem {
  const rng = rngFor(seed, "system", site.id);
  const name = generateSystemName(rng);
  const kind = rng.weighted(STAR_KINDS, (k) => k.weight);
  const planetCount = rng.int(MIN_PLANETS, MAX_PLANETS);
  return {
    id: site.id,
    name,
    position: site.position,
    star: { type: kind.type, label: kind.label, color: kind.color, radius: kind.radius },
    planetCount,
  };
}
