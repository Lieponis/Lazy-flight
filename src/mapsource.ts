// GLUE: gives the galaxy map (src/render/starmap.ts) its stars from the universe.
//
// Plain words: the render layer asks the universe nothing for the map. This small file sits above both of them: it asks the universe
// for the nearest stars around a point, turns the answer into plain lists of numbers (a position, a distance, a colour and a size for
// every star) and hands those to the map. The map asks once each time the player arrives somewhere new; the last two answers are
// remembered, so going back to the map costs nothing.

import { armFactor, densityAt, generateSystem, getSystem, nearestSites, spacingAt, thicknessAt, type Seed } from "./universe";
import { discDensityAt } from "./universe/galaxy";
import type { MapPoint, MapSource, MapStarList, SkyFunctions } from "./render";
import { placesFromRows, routeFromPlan, type MapPlace, type MapRoute, type PlaceRowLike, type PlanLike } from "./render/routemath";

/** How many answers are remembered (one list of 60,000 stars is about 2.5 MB). */
const KEEP_ANSWERS = 2;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Where the bulge makes up this share of the local density or more, the map uses the real local gap (see `localSpacing`). */
const BULGE_FULL_SHARE = 0.3;

/**
 * The typical gap between neighbouring systems at a point, for the map's zoom limit and diamond size.
 *
 * The map's own number is the universe's `spacingAt` of the distance from the centre. Two things are added for the central bulge:
 * 1. Systems of the bulge lie far above and below the disc plane, where the disc's number is far too small (it would say 1.9 ly where
 *    the gap is 4.6 ly): there the gap follows the local density (gap = density^(-1/3)), never smaller than the disc's number. Between
 *    half the disc's thickness and the full thickness the two numbers are blended, so there is no jump when the point moves up or down.
 * 2. Where the bulge itself is a big part of the density (the bulge's share of the density is 30 % or more, the middle of the galaxy),
 *    the disc's number is too big (1.87 ly where the real gap is 1.53 ly), so the real local gap is used when it is smaller. The share
 *    fades the change in from 0 % to 100 %, so it is exactly zero beyond the bulge's reach: the start place and the rest of the disc keep
 *    exactly the old numbers.
 */
export function localSpacing(centre: MapPoint): number {
  const r = Math.hypot(centre.x, centre.z);
  const base = spacingAt(r);
  const total = densityAt(centre);
  if (!(total > 0)) return base;
  const real = Math.cbrt(1 / total);
  const half = thicknessAt(r) / 2;
  const height = Math.abs(centre.y);
  const old = height <= half ? base : base + (Math.max(base, real) - base) * Math.min(1, (height - half) / half);
  const share = Math.min(1, (total - discDensityAt(centre)) / total / BULGE_FULL_SHARE);
  return share > 0 && real < old ? old - (old - real) * share : old;
}

function buildList(seed: Seed, centre: MapPoint, count: number): MapStarList {
  const sites = nearestSites(seed, centre, count);
  const n = sites.length;
  const list: MapStarList = {
    count: n,
    ids: new Float64Array(n),
    positions: new Float32Array(n * 3),
    distances: new Float32Array(n),
    colors: new Float32Array(n * 3),
    radii: new Float32Array(n),
    spacingLy: localSpacing(centre),
  };
  const colours = new Map<string, [number, number, number]>(); // a handful of star colours: convert each hex text once
  for (let i = 0; i < n; i++) {
    const site = sites[i];
    if (!site) continue;
    list.ids[i] = site.id;
    list.positions[i * 3] = site.position.x - centre.x;
    list.positions[i * 3 + 1] = site.position.y - centre.y;
    list.positions[i * 3 + 2] = site.position.z - centre.z;
    list.distances[i] = site.distance;
    const star = generateSystem(seed, site).star;
    let rgb = colours.get(star.color);
    if (!rgb) {
      rgb = hexToRgb(star.color);
      colours.set(star.color, rgb);
    }
    list.colors[i * 3] = rgb[0];
    list.colors[i * 3 + 1] = rgb[1];
    list.colors[i * 3 + 2] = rgb[2];
    list.radii[i] = star.radius;
  }
  return list;
}

/**
 * The universe's galaxy shape as plain functions for the map's sky (the render layer imports no universe code).
 * `density` reuses one point object, because the sky builder asks it millions of times.
 */
function makeSkyFunctions(): SkyFunctions {
  const point = { x: 0, y: 0, z: 0 };
  return {
    density(x: number, y: number, z: number): number {
      point.x = x;
      point.y = y;
      point.z = z;
      return densityAt(point);
    },
    spacing: spacingAt,
    thickness: thicknessAt,
    armFactor,
  };
}

/** The map's star source for one universe seed. */
export function makeMapSource(seed: Seed): MapSource {
  const answers: { key: string; count: number; list: MapStarList }[] = [];
  return {
    sky: makeSkyFunctions(),
    nearest(centre: MapPoint, count: number): MapStarList {
      const key = `${centre.x},${centre.y},${centre.z}`;
      const found = answers.findIndex((a) => a.key === key && a.count === count);
      if (found >= 0) {
        const [hit] = answers.splice(found, 1) as [(typeof answers)[number]];
        answers.unshift(hit); // most recent first
        return hit.list;
      }
      const list = buildList(seed, centre, count);
      answers.unshift({ key, count, list });
      if (answers.length > KEEP_ANSWERS) answers.pop();
      return list;
    },
    describe(id: number) {
      const system = getSystem(seed, id);
      return system ? { name: system.name, starLabel: system.star.label } : null;
    },
  };
}

/**
 * NAV-2: turns the game's answers about places and the flight plan (docs/nav-api.md) into what the galaxy map draws. The map never asks
 * the universe, so the positions of the stars come from here. `places(game.getPlaces())` and `route(game.planRoute(target))`.
 */
export function makeNavForMap(seed: Seed): { places(rows: readonly PlaceRowLike[]): MapPlace[]; route(plan: PlanLike): MapRoute | null } {
  const positionOf = (id: number): MapPoint | null => getSystem(seed, id)?.position ?? null;
  return {
    places: (rows) => placesFromRows(positionOf, rows),
    route: (plan) => routeFromPlan(positionOf, plan),
  };
}
