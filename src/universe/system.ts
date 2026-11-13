// LAYER 2: a star system. Uses the galaxy layer (its address) and adds name, star and planet count.

import type { SystemSite, Vec3 } from "./galaxy";
import { generateSystemName } from "./names";
import { pureNameOf } from "./purenames";
import { rngFor, type Seed } from "./random";
import { MAX_PLANETS, MIN_PLANETS } from "./settings";
import { systemCodeOfId } from "./syscode";

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
  /** The full name, unique in the whole universe: "Kopipex 4F-92" (word + code) or a pure name like "Lazy Harbour". */
  name: string;
  /** The word part alone: "Kopipex", or the whole pure name. Not unique by itself. */
  baseName: string;
  /** The short unique code of this system, e.g. "4F-92". Every system has one (also pure-named ones). */
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
  // The old name draw stays, so the star and planet count below come out exactly as before.
  const legacyWord = generateSystemName(rng);
  const code = systemCodeOfId(site.id) ?? "00-00";
  const pure = pureNameOf(seed, site.id);
  const baseName = pure ?? legacyWord;
  const name = pure ?? `${legacyWord} ${code}`;
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
