// Name and joke generators. They only READ the word lists in ./data and never return an empty name.

import type { Rng } from "./random";
import {
  OUTPOST_ADJECTIVES,
  OUTPOST_NOUNS,
  PLANET_NICKNAMES,
  STATION_ADJECTIVES,
  STATION_NOUNS,
  SYSTEM_ENDS,
  SYSTEM_MIDDLES,
  SYSTEM_STARTS,
  SYSTEM_SUFFIXES,
} from "./data/words";
import { PASSENGER_GROUPS } from "./data/passengers";
import { PASSENGER_BLURBS, TOUR_BLURBS, TRADE_BLURBS } from "./data/blurbs";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export function romanNumeral(n: number): string {
  return ROMAN[n - 1] ?? String(n);
}

export function generateSystemName(rng: Rng): string {
  let name = rng.pick(SYSTEM_STARTS);
  if (rng.chance(0.5)) name += rng.pick(SYSTEM_MIDDLES);
  name += rng.pick(SYSTEM_ENDS);
  if (rng.chance(0.2)) name += " " + rng.pick(SYSTEM_SUFFIXES);
  return name;
}

/** Planet names: "<System> II", or sometimes a friendly nickname like "Big Marge". */
export function generatePlanetName(rng: Rng, systemName: string, index: number): string {
  if (rng.chance(0.25)) return rng.pick(PLANET_NICKNAMES);
  return `${systemName} ${romanNumeral(index + 1)}`;
}

export function generateOutpostName(rng: Rng): string {
  return `${rng.pick(OUTPOST_ADJECTIVES)} ${rng.pick(OUTPOST_NOUNS)} Outpost`;
}

export function generateStationName(rng: Rng): string {
  return `${rng.pick(STATION_ADJECTIVES)} ${rng.pick(STATION_NOUNS)} Station`;
}

export function generatePassengerGroup(rng: Rng): string {
  return rng.pick(PASSENGER_GROUPS);
}

export type BlurbKind = "TRADE" | "PASSENGER" | "TOUR";

export interface BlurbValues {
  amount: number;
  item: string;
  from: string;
  to: string;
  stops: string;
}

export function generateBlurb(rng: Rng, kind: BlurbKind, values: BlurbValues): string {
  const list = kind === "TRADE" ? TRADE_BLURBS : kind === "PASSENGER" ? PASSENGER_BLURBS : TOUR_BLURBS;
  return rng
    .pick(list)
    .replace(/\{amount\}/g, String(values.amount))
    .replace(/\{item\}/g, values.item)
    .replace(/\{from\}/g, values.from)
    .replace(/\{to\}/g, values.to)
    .replace(/\{stops\}/g, values.stops);
}
