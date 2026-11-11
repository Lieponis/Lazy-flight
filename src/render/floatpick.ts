// Picks planets WITHOUT a dock to show in the floating preview: a mix of gas giants, ringed, rocky and ice worlds.
// Pure (no Three.js), so it is easy to test.

import type { Planet, Seed, StarSystem } from "../universe";
import { getDock, getPlanetsOfSystem } from "../universe";
import { chooseLook } from "./planetlook";

export type FloatKind = "GAS GIANT" | "RINGED" | "ROCKY" | "ICE" | "OTHER";

export interface FloatCandidate {
  planetId: string;
  label: string;
  kind: FloatKind;
}

/** What a planet is called in the preview: ringed first (rings are the thing to check), then its type. */
export function floatKind(planet: Planet): FloatKind {
  if (chooseLook(planet).rings) return "RINGED";
  if (planet.type === "GAS") return "GAS GIANT";
  if (planet.type === "ICE") return "ICE";
  if (planet.type === "ROCKY" || planet.type === "BARREN" || planet.type === "DESERT") return "ROCKY";
  return "OTHER";
}

/** Up to `perKind` planets of each kind (no dock), searching the given systems in order. The list is mixed so stepping shows variety. */
export function floatCandidates(seed: Seed, systems: readonly StarSystem[], perKind = 3): FloatCandidate[] {
  const buckets = new Map<FloatKind, FloatCandidate[]>();
  const kinds: FloatKind[] = ["GAS GIANT", "RINGED", "ROCKY", "ICE", "OTHER"];
  for (const k of kinds) buckets.set(k, []);
  for (const system of systems) {
    for (const planet of getPlanetsOfSystem(seed, system.id)) {
      if (getDock(seed, planet.id)) continue;
      const kind = floatKind(planet);
      const bucket = buckets.get(kind);
      if (bucket && bucket.length < perKind) bucket.push({ planetId: planet.id, kind, label: `${kind}: ${planet.name}` });
    }
  }
  // Mix: one of each kind, then the next of each kind, ...
  const out: FloatCandidate[] = [];
  for (let i = 0; i < perKind; i++) for (const k of kinds) { const c = buckets.get(k)?.[i]; if (c) out.push(c); }
  return out;
}
