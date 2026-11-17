// NearCache: "who is near this point" asked once, reused many times.
// The starmap and the job boards need the nearest 10,000 systems (or the nearest docks) around the player. Working that
// out costs milliseconds to tens of milliseconds (see the README), so it must not happen again on every click.
// A NearCache remembers the answer for the few positions asked most recently. Asking for fewer systems than are
// remembered gives the first part of the remembered list (the nearest N of a bigger list are the nearest N), and asking
// for more works the bigger list out again and remembers that instead.

import { docksOfSites, type NearDock } from "./lookup";
import type { Seed } from "./random";
import { generateSystem, type StarSystem } from "./system";
import { nearestSites, type NearSite, type Vec3 } from "./sites";

interface Entry {
  key: string;
  sites: NearSite[];
  /** How many systems were asked for when `sites` was worked out. If `sites` is shorter, the galaxy had no more. */
  asked: number;
  docks: NearDock[];
  /** How many of the first `sites` the docks list has been built from. */
  dockSystems: number;
  /** True when the galaxy ran out of systems (only happens for absurdly large counts). */
  exhausted: boolean;
}

export class NearCache {
  private readonly entries: Entry[] = [];

  constructor(
    readonly seed: Seed,
    /** How many positions are remembered (the most recently asked ones). */
    private readonly maxPositions = 4,
  ) {}

  /** Forget everything (for example after a seed change in a developer page). */
  clear(): void {
    this.entries.length = 0;
  }

  private entryFor(center: Vec3): Entry {
    const key = `${center.x},${center.y},${center.z}`;
    const found = this.entries.findIndex((e) => e.key === key);
    if (found >= 0) {
      const [hit] = this.entries.splice(found, 1) as [Entry];
      this.entries.unshift(hit); // most recent first
      return hit;
    }
    const fresh: Entry = { key, sites: [], asked: 0, docks: [], dockSystems: 0, exhausted: false };
    this.entries.unshift(fresh);
    if (this.entries.length > this.maxPositions) this.entries.pop();
    return fresh;
  }

  private ensureSites(entry: Entry, center: Vec3, count: number): void {
    if (entry.asked >= count) return;
    entry.sites = nearestSites(this.seed, center, count);
    entry.asked = count;
    entry.exhausted = entry.sites.length < count;
    // The docks list was built from the old, shorter list; it is still correct (a prefix), so it is kept.
  }

  /** The nearest `count` systems (addresses and distances), nearest first. */
  sites(center: Vec3, count: number): readonly NearSite[] {
    const entry = this.entryFor(center);
    this.ensureSites(entry, center, count);
    return entry.sites.length <= count ? entry.sites : entry.sites.slice(0, count);
  }

  /** The nearest `count` systems as full systems (names, stars, planet counts), nearest first. Built each time from `sites`. */
  systems(center: Vec3, count: number): { system: StarSystem; distance: number }[] {
    return this.sites(center, count).map((s) => ({ system: generateSystem(this.seed, s), distance: s.distance }));
  }

  /** The nearest `count` docks, nearest first. */
  docks(center: Vec3, count: number): readonly NearDock[] {
    const entry = this.entryFor(center);
    while (entry.docks.length < count && !entry.exhausted) {
      const want = Math.max(4, Math.ceil(count / 1.4) + 2, Math.ceil(entry.dockSystems * 1.5));
      this.ensureSites(entry, center, want);
      const upTo = Math.min(entry.sites.length, want);
      docksOfSites(this.seed, entry.sites.slice(0, upTo), entry.docks, entry.dockSystems);
      entry.dockSystems = upTo;
      if (entry.sites.length < want) entry.exhausted = true;
    }
    return entry.docks.length <= count ? entry.docks : entry.docks.slice(0, count);
  }
}
