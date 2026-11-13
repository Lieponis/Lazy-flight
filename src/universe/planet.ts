// LAYER 3: planets. Uses the system layer. Colors are only data (hex text), nothing is drawn here.

import { PLANET_NICKNAMES } from "./data/words";
import { romanNumeral } from "./names";
import { rngFor, type Rng, type Seed } from "./random";
import type { StarSystem } from "./system";

export type PlanetType = "ROCKY" | "DESERT" | "OCEAN" | "ICE" | "LAVA" | "GAS" | "JUNGLE" | "BARREN";

interface PlanetKind {
  type: PlanetType;
  radius: [number, number]; // in Earth radii
  hue: [number, number]; // 0-360
  saturation: [number, number]; // 0-100
  lightness: [number, number]; // 0-100
}

const KINDS: Record<PlanetType, PlanetKind> = {
  ROCKY: { type: "ROCKY", radius: [0.6, 1.6], hue: [15, 35], saturation: [50, 70], lightness: [38, 52] },
  DESERT: { type: "DESERT", radius: [0.5, 1.5], hue: [30, 50], saturation: [70, 90], lightness: [52, 64] },
  OCEAN: { type: "OCEAN", radius: [0.8, 2.0], hue: [195, 225], saturation: [70, 90], lightness: [42, 56] },
  ICE: { type: "ICE", radius: [0.3, 1.4], hue: [180, 200], saturation: [55, 75], lightness: [72, 84] },
  LAVA: { type: "LAVA", radius: [0.5, 1.4], hue: [0, 14], saturation: [85, 100], lightness: [42, 54] },
  GAS: { type: "GAS", radius: [5, 11], hue: [0, 360], saturation: [60, 85], lightness: [48, 62] },
  JUNGLE: { type: "JUNGLE", radius: [0.7, 1.7], hue: [100, 140], saturation: [60, 80], lightness: [36, 48] },
  BARREN: { type: "BARREN", radius: [0.2, 0.7], hue: [260, 300], saturation: [45, 60], lightness: [42, 54] },
};

type Zone = "INNER" | "MIDDLE" | "OUTER";

const ZONE_WEIGHTS: Record<Zone, [PlanetType, number][]> = {
  INNER: [["LAVA", 3], ["DESERT", 3], ["ROCKY", 2], ["BARREN", 1]],
  MIDDLE: [["ROCKY", 3], ["OCEAN", 2], ["JUNGLE", 2], ["DESERT", 1], ["BARREN", 1]],
  OUTER: [["GAS", 3], ["ICE", 3], ["BARREN", 1], ["ROCKY", 1]],
};

export interface PlanetColors {
  primary: string;
  secondary: string;
  accent: string;
}

export interface Planet {
  /** "<system id>/<planet number>", e.g. "3:-2:5:0/2". If the planet has a dock, the dock uses this same id. */
  id: string;
  systemId: string;
  /** 0 = closest to the star. */
  index: number;
  /** Unique in the whole universe: "<system name> II". */
  name: string;
  /** Optional flavour nickname ("Big Marge"). Not unique, never used as the name. */
  nickname?: string;
  type: PlanetType;
  /** In Earth radii (1 = Earth sized). */
  radius: number;
  colors: PlanetColors;
  /** Distance from the star in made-up units, always growing with index. */
  orbitRadius: number;
  /** Where on its orbit the planet starts, 0 to 1. */
  orbitPhase: number;
}

function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(100, s)) / 100;
  const ll = Math.max(0, Math.min(100, l)) / 100;
  const k = (n: number) => (n + hh / 30) % 12;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n: number) => ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function makeColors(rng: Rng, kind: PlanetKind): PlanetColors {
  const hue = rng.float(kind.hue[0], kind.hue[1]);
  const sat = rng.float(kind.saturation[0], kind.saturation[1]);
  const light = rng.float(kind.lightness[0], kind.lightness[1]);
  return {
    primary: hslToHex(hue, sat, light),
    secondary: hslToHex(hue + rng.float(-25, 25), sat - 5, light + rng.float(-12, 12)),
    accent: hslToHex(hue + rng.float(90, 180), Math.max(sat, 55), Math.min(light + 8, 70)),
  };
}

export function generatePlanet(seed: Seed, system: StarSystem, index: number): Planet {
  const rng = rngFor(seed, "planet", system.id, index);
  const fraction = system.planetCount > 1 ? index / (system.planetCount - 1) : 0.5;
  const zone: Zone = fraction < 0.34 ? "INNER" : fraction < 0.67 ? "MIDDLE" : "OUTER";
  const [type] = rng.weighted(ZONE_WEIGHTS[zone], (entry) => entry[1]);
  const kind = KINDS[type];
  // The old nickname draws stay, so the radius, colours and orbit below come out exactly as before.
  const nickname = rng.chance(0.25) ? rng.pick(PLANET_NICKNAMES) : undefined;
  return {
    id: `${system.id}/${index}`,
    systemId: system.id,
    index,
    name: `${system.name} ${romanNumeral(index + 1)}`,
    ...(nickname ? { nickname } : {}),
    type,
    radius: Math.round(rng.float(kind.radius[0], kind.radius[1]) * 100) / 100,
    colors: makeColors(rng, kind),
    orbitRadius: Math.round((0.4 + index * 0.9 + rng.float(0, 0.5)) * 100) / 100,
    orbitPhase: Math.round(rng.next() * 1000) / 1000,
  };
}

/** All planets of a system, closest to the star first. */
export function generatePlanets(seed: Seed, system: StarSystem): Planet[] {
  const planets: Planet[] = [];
  for (let i = 0; i < system.planetCount; i++) planets.push(generatePlanet(seed, system, i));
  return planets;
}
