// Test helper (stage G4): "the systems around the start". The old tests asked for every system inside a radius around the
// point 0,0,0; in the spiral galaxy that point is the dense centre (363,000 systems within 80 ly), so tests ask for the
// NEAREST N systems around the start point instead (a count, never a radius).
import { START_POINT, nearestSystems, type Seed, type StarSystem } from "../../src/universe";

/** The nearest `count` systems to the start point, nearest first. */
export function nearStart(seed: Seed, count: number): StarSystem[] {
  return nearestSystems(seed, START_POINT, count).map((n) => n.system);
}
