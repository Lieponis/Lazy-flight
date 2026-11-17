// LAYER 2: a star system. Uses the galaxy layer (its address) and adds name, star and planet count.

import { encodeSystemNumber } from "./galaxy";
import { generateSystemName } from "./names";
import { pureNameOf } from "./purenames";
import { rngFor, type Seed } from "./random";
import { MAX_PLANETS, MIN_PLANETS } from "./settings";
import type { SystemSite, Vec3 } from "./sites";

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
  /** The system number (same as its galaxy address): a plain whole number, safe in JSON and saves. */
  id: number;
  /** The full name, unique in the whole universe: "Kopipex N2R4-5HJ7" (word + code) or a pure name like "Lazy Harbour". */
  name: string;
  /** The word part alone: "Kopipex", or the whole pure name. Not unique by itself. */
  baseName: string;
  /** The short unique code of this system, e.g. "N2R4-5HJ7". Every system has one (also pure-named ones). */
  code: string;
  /** True if the system has a pure name (no code in its name). */
  isPure: boolean;
  position: Vec3;
  star: Star;
  /** 1 to 10. Use getPlanetsOfSystem to get the planets themselves. Only some planets have a dock (see docksOf). */
  planetCount: number;
}

export function generateSystem(seed: Seed, site: SystemSite): StarSystem {
  const rng = rngFor(seed, "system", site.id);
  // The word draw comes first, then the star and the planet count (the same order as in universe versions 1 and 2).
  const word = generateSystemName(rng);
  const code = encodeSystemNumber(site.id);
  const pure = pureNameOf(seed, site.id);
  const baseName = pure ?? word;
  const name = pure ?? `${word} ${code}`;
  const kind = rng.weighted(STAR_KINDS, (k) => k.weight);
  const planetCount = rng.int(MIN_PLANETS, MAX_PLANETS);
  return {
    id: site.id,
    name,
    baseName,
    code,
    isPure: pure !== null,
    position: site.position,
    star: { type: kind.type, label: kind.label, color: kind.color, radius: kind.radius },
    planetCount,
  };
}
