// A checksum of the nearest systems to a point. Every device must print the SAME number for the same seed
// (it proves the galaxy is identical on every phone and browser). Positions are rounded to 1/1000 ly.

import { nearestSystems } from "./systems";
import type { Vec3 } from "./density";
import type { Seed } from "../random";

export function galaxyChecksum(seed: Seed, center: Vec3, count: number): string {
  let h = 0x811c9dc5;
  const feed = (n: number): void => {
    const hi = Math.floor(n / 4294967296);
    const lo = n - hi * 4294967296;
    for (const part of [lo >>> 0, hi >>> 0]) {
      h ^= part;
      h = Math.imul(h, 0x01000193) >>> 0;
      h ^= h >>> 15;
    }
  };
  for (const s of nearestSystems(seed, center, count)) {
    feed(s.id);
    feed(Math.round(s.x * 1000) + 5e10);
    feed(Math.round(s.y * 1000) + 5e10);
    feed(Math.round(s.z * 1000) + 5e10);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
