// Exploring: which star systems and planets you have arrived at, discovery credits, and the Explorer rank.
// Stored compactly: `explored` maps a star system id to a whole number whose bits say which planets of that system
// you have arrived at (planet 0 = bit 0, planet 1 = bit 1, ... a system has at most 10 planets, so the number is below 1024).
// A system is "explored" when it has an entry. Pure logic: the universe's own discovery amount is passed in.

import {
  DISCOVERY_MAX_CREDITS,
  DISCOVERY_MIN_CREDITS,
  EXPLORER_DISCOVERIES_NEEDED,
  EXPLORER_DISCOVERY_BONUS_PERCENT,
  MAX_EXPLORED_SYSTEMS,
} from "./settings";
import { hashUnit, type Seed } from "../universe";
import type { GameState } from "./state";

/** The three Explorer rank names (rank 1 is where everybody starts). Andy's names. */
export const EXPLORER_RANK_NAMES: [string, string, string] = ["Lost in Space", "Cartographer", "Mr Galaxy-wide"];

/** The most planets a system can have (the universe never makes more); bits above this are ignored. */
const MAX_PLANET_BITS = 10;
const ALL_BITS = (1 << MAX_PLANET_BITS) - 1;

/** Star system id and planet number of a planet id like "3:-2:5:0/2", or null if it is not that shape. */
export function parsePlanetId(planetId: string): { systemId: string; index: number } | null {
  const cut = planetId.lastIndexOf("/");
  if (cut <= 0) return null;
  const index = Number(planetId.slice(cut + 1));
  if (!Number.isInteger(index) || index < 0 || index >= MAX_PLANET_BITS) return null;
  return { systemId: planetId.slice(0, cut), index };
}

/** The amount (credits, before the rank bonus) this system pays for being explored: the same every time. */
export function discoveryBase(seed: Seed, systemId: string): number {
  const span = DISCOVERY_MAX_CREDITS - DISCOVERY_MIN_CREDITS + 1;
  return DISCOVERY_MIN_CREDITS + Math.floor(hashUnit(seed, "discovery", systemId) * span);
}

/** Repairs a saved explored list: only text ids with whole-number planet masks from 1 to 1023, at most MAX_EXPLORED_SYSTEMS. */
export function cleanExplored(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  let count = 0;
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (id === "" || typeof value !== "number" || !Number.isFinite(value) || value < 1) continue;
    const mask = Math.floor(value) & ALL_BITS;
    if (mask === 0) continue;
    out[id] = mask;
    if (++count >= MAX_EXPLORED_SYSTEMS) break;
  }
  return out;
}

function bitCount(n: number): number {
  let count = 0;
  for (let m = n & ALL_BITS; m !== 0; m &= m - 1) count++;
  return count;
}

/** How many star systems and planets you have explored. */
export function exploredCounts(explored: Record<string, number>): { systems: number; planets: number } {
  let systems = 0;
  let planets = 0;
  for (const mask of Object.values(explored)) {
    systems++;
    planets += bitCount(mask);
  }
  return { systems, planets };
}

export function hasExploredPlanet(explored: Record<string, number>, planetId: string): boolean {
  const p = parsePlanetId(planetId);
  return p !== null && ((explored[p.systemId] ?? 0) & (1 << p.index)) !== 0;
}

export function hasExploredSystem(explored: Record<string, number>, systemId: string): boolean {
  return (explored[systemId] ?? 0) !== 0;
}

/** Total discoveries: systems explored plus planets arrived at. This decides the Explorer rank. */
export function discoveriesOf(explored: Record<string, number>): number {
  const { systems, planets } = exploredCounts(explored);
  return systems + planets;
}

/** 0, 1 or 2 (= rank 1, 2 or 3) for this many discoveries. */
export function explorerRankIndexFor(discoveries: number): 0 | 1 | 2 {
  const [second, third] = EXPLORER_DISCOVERIES_NEEDED;
  return discoveries >= third ? 2 : discoveries >= second ? 1 : 0;
}

/** The Explorer rank screen row. */
export interface ExplorerInfo {
  systems: number;
  planets: number;
  discoveries: number;
  /** 0, 1 or 2. */
  rankIndex: 0 | 1 | 2;
  /** 1, 2 or 3. */
  rankNumber: number;
  rankName: string;
  nextRankName: string | null;
  /** Discoveries still needed for the next rank, or null at the top. */
  discoveriesToNext: number | null;
  /** Extra percent on discovery credits at this rank. */
  discoveryBonusPercent: number;
}

export function explorerInfo(explored: Record<string, number>): ExplorerInfo {
  const { systems, planets } = exploredCounts(explored);
  const discoveries = systems + planets;
  const rankIndex = explorerRankIndexFor(discoveries);
  return {
    systems,
    planets,
    discoveries,
    rankIndex,
    rankNumber: rankIndex + 1,
    rankName: EXPLORER_RANK_NAMES[rankIndex],
    nextRankName: rankIndex === 2 ? null : EXPLORER_RANK_NAMES[rankIndex + 1] ?? null,
    discoveriesToNext: rankIndex === 2 ? null : Math.max(0, EXPLORER_DISCOVERIES_NEEDED[rankIndex] - discoveries),
    discoveryBonusPercent: EXPLORER_DISCOVERY_BONUS_PERCENT[rankIndex],
  };
}

export interface ExplorerRankUp {
  /** The new rank, 2 or 3. */
  rankNumber: number;
  rankName: string;
}

/** What one arrival changed for the explorer. */
export interface Discovery {
  /** Credits paid for exploring a new system (0 if the system was known, or the explored list is full). */
  credits: number;
  newSystem: boolean;
  newPlanet: boolean;
  explorerRankUp: ExplorerRankUp | null;
}

export const NO_DISCOVERY: Discovery = { credits: 0, newSystem: false, newPlanet: false, explorerRankUp: null };

/**
 * Records an arrival at a planet (a dock's id is its planet's id). The first arrival in a system pays discovery credits
 * (`baseCreditsOf(systemId)`, plus the Explorer rank bonus you had BEFORE this arrival). Returns the new explored list
 * and what changed. Credits are NOT added here: the caller adds `discovery.credits`.
 */
export function recordArrival(
  explored: Record<string, number>,
  planetId: string,
  baseCreditsOf: (systemId: string) => number,
): { explored: Record<string, number>; discovery: Discovery } {
  const place = parsePlanetId(planetId);
  if (!place) return { explored, discovery: NO_DISCOVERY };
  const before = explored[place.systemId] ?? 0;
  const bit = 1 << place.index;
  const newSystem = before === 0;
  const newPlanet = (before & bit) === 0;
  if (!newPlanet) return { explored, discovery: NO_DISCOVERY };
  if (newSystem && Object.keys(explored).length >= MAX_EXPLORED_SYSTEMS) return { explored, discovery: NO_DISCOVERY };

  const rankBefore = explorerRankIndexFor(discoveriesOf(explored));
  const bonus = EXPLORER_DISCOVERY_BONUS_PERCENT[rankBefore];
  const credits = newSystem ? Math.round(baseCreditsOf(place.systemId) * (1 + bonus / 100)) : 0;
  const next = { ...explored, [place.systemId]: before | bit };
  const rankAfter = explorerRankIndexFor(discoveriesOf(next));
  const explorerRankUp = rankAfter > rankBefore ? { rankNumber: rankAfter + 1, rankName: EXPLORER_RANK_NAMES[rankAfter] } : null;
  return { explored: next, discovery: { credits, newSystem, newPlanet, explorerRankUp } };
}

/** A state-level shortcut: the explorer rank info of a state. */
export function explorerInfoOf(state: GameState): ExplorerInfo {
  return explorerInfo(state.explored);
}
