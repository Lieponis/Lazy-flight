// THE FLIGHT-PLAN LINE AND THE PLACE MARKERS ON THE GALAXY MAP: the maths (stage NAV-2).
// Pure maths, no Three.js, no universe code, no game code.
//
// Plain words: the app hands the map two plain things: a flight plan (the places the ship hops through, in light years, and the
// final target) and a few "my places" (start dock, outposts, starred, recent). This file turns them into numbers the drawing code
// uses: the points of the line, where a far marker sits on the edge of the picture, the dashes of a dashed line, the dots of a
// moving-dots line, and how far to zoom to frame the first hops. Everything here is plain functions so it can be tested.

import type { MapPoint } from "./galaxy/mapdata";

// ------------------------------------------------------------------ what the app hands over (plain data)

/** One stop of the flight plan. `refuel` = the ship refuels here before the next hop. */
export interface MapRouteHop {
  /** Galaxy coordinates in light years. */
  position: MapPoint;
  refuel: boolean;
}

/** A flight plan: the stops in order (the ship's own place is the start and is not listed) and the final target. */
export interface MapRoute {
  hops: MapRouteHop[];
  target: { position: MapPoint; name: string };
}

export type MapPlaceKind = "start" | "outpost" | "starred" | "recent";

/** One of the player's places. */
export interface MapPlace {
  systemId: number;
  position: MapPoint;
  /** All kinds that apply (a place is drawn as the first of: start, outpost, starred, recent). */
  kinds: readonly MapPlaceKind[];
  name: string;
}

/** The three looks of the plan line (Andy picks one: A plain, B dashed, C moving dots). */
export type RouteLook = "line" | "dashed" | "dots";

/** What the game's flight plan looks like, as far as the map cares (a structural copy of docs/nav-api.md, so no game import). */
export interface PlanLike {
  status: string;
  target: { name: string; systemId: number };
  hops: readonly { systemId: number; refuelBefore: boolean }[];
}

/** What the game's "my places" rows look like, as far as the map cares. */
export interface PlaceRowLike {
  kinds: readonly string[];
  name: string;
  systemId: number;
}

const PLACE_ORDER: readonly MapPlaceKind[] = ["start", "outpost", "starred", "recent"];

/** The kind a place is drawn as: the first of start, outpost, starred, recent that it has (null if none). */
export function placeGlyphKind(kinds: readonly string[]): MapPlaceKind | null {
  for (const kind of PLACE_ORDER) if (kinds.includes(kind)) return kind;
  return null;
}

/** Position of a system by its number (the app owns the universe; null = unknown). */
export type PositionOf = (systemId: number) => MapPoint | null;

/**
 * Turns the game's flight plan into the map's route. A hop with `refuelBefore` means "refuel at the stop you are leaving", so the
 * refuel marker goes on the stop BEFORE it (the ship's own place before the first hop gets no marker). Status "here" (or an unknown
 * target) gives null: nothing to draw. A plan without hops ("stuck", "too far") still gives the target, so the map can show the way.
 */
export function routeFromPlan(positionOf: PositionOf, plan: PlanLike): MapRoute | null {
  if (plan.status === "here") return null;
  const target = positionOf(plan.target.systemId);
  if (!target) return null;
  const hops: MapRouteHop[] = [];
  for (let i = 0; i < plan.hops.length; i++) {
    const hop = plan.hops[i];
    const position = hop ? positionOf(hop.systemId) : null;
    if (!hop || !position) continue;
    hops.push({ position, refuel: plan.hops[i + 1]?.refuelBefore === true });
  }
  return { hops, target: { position: target, name: plan.target.name } };
}

/** Turns the game's "my places" rows into the map's places (rows with an unknown star or no kind are left out). */
export function placesFromRows(positionOf: PositionOf, rows: readonly PlaceRowLike[]): MapPlace[] {
  const out: MapPlace[] = [];
  for (const row of rows) {
    const position = positionOf(row.systemId);
    const kinds = PLACE_ORDER.filter((k) => row.kinds.includes(k));
    if (!position || kinds.length === 0) continue;
    out.push({ systemId: row.systemId, position, kinds, name: row.name });
  }
  return out;
}

// ------------------------------------------------------------------ the line

export interface RouteLine {
  /** x, y, z of the ship (0, 0, 0) and then every hop, in light years relative to the ship. */
  points: Float32Array;
  /** How many points (1 + hops). */
  count: number;
  /** For hop number i (0 = the first hop): the ship refuels there. */
  refuel: boolean[];
  /** The final target relative to the ship. */
  target: MapPoint;
  targetLy: number;
  /** The target lies beyond the last hop (the plan shows only the next hops): a dim straight line goes on to it. */
  hasRest: boolean;
  /** The farthest point of the whole line from the ship (decides how far the camera must see). */
  extentLy: number;
}

/** A target closer than this to the last hop counts as "the last hop is the target" (no extra line). */
export const REST_MIN_LY = 0.5;

function dist3(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  return Math.hypot(ax - bx, ay - by, az - bz);
}

/** The line of a plan relative to the ship at `origin`. Only the first `maxHops` hops are used. */
export function routeLine(origin: MapPoint, route: MapRoute, maxHops: number): RouteLine {
  const hops = route.hops.slice(0, Math.max(0, maxHops));
  const count = 1 + hops.length;
  const points = new Float32Array(count * 3);
  const refuel: boolean[] = [];
  let extent = 0;
  for (let i = 0; i < hops.length; i++) {
    const h = hops[i]!;
    const x = h.position.x - origin.x;
    const y = h.position.y - origin.y;
    const z = h.position.z - origin.z;
    points[(i + 1) * 3] = x;
    points[(i + 1) * 3 + 1] = y;
    points[(i + 1) * 3 + 2] = z;
    refuel.push(h.refuel);
    extent = Math.max(extent, Math.hypot(x, y, z));
  }
  const target = { x: route.target.position.x - origin.x, y: route.target.position.y - origin.y, z: route.target.position.z - origin.z };
  const targetLy = Math.hypot(target.x, target.y, target.z);
  const last = count - 1;
  const lastToTarget = dist3(points[last * 3]!, points[last * 3 + 1]!, points[last * 3 + 2]!, target.x, target.y, target.z);
  const hasRest = lastToTarget > REST_MIN_LY;
  return { points, count, refuel, target, targetLy, hasRest, extentLy: Math.max(extent, hasRest ? targetLy : 0) };
}

/** Light years as short text: one decimal under 10, otherwise whole numbers with thousands commas ("1,240"). */
export function formatLy(ly: number): string {
  if (!Number.isFinite(ly) || ly < 0) return "0";
  if (ly < 10) return ly.toFixed(1);
  return Math.round(ly).toLocaleString("en-US");
}

/** The words next to the target marker: "HOME, 1,240 ly". */
export function targetTagText(name: string, ly: number): string {
  return `${name}, ${formatLy(ly)} ly`;
}

// ------------------------------------------------------------------ markers on the edge of the picture

/** How many pixels at each side of the picture are kept free (the title on top, the label and buttons at the bottom). */
export interface SafeRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type EdgeSide = "inside" | "left" | "right" | "top" | "bottom";

export interface Pinned {
  /** Pixels from the left and from the top of the picture. */
  x: number;
  y: number;
  /** True = the marker was pushed to the edge of the free area (it is not where the star is on the picture). */
  pinned: boolean;
  /** Which edge it sits on ("inside" = not pinned). */
  side: EdgeSide;
}

/**
 * Where a point is on the picture, from its clip coordinates (x, y, w of the projection). In front of the camera that is the usual
 * x / w, y / w. Behind the camera the picture would show it mirrored, so instead the direction to turn is returned: (x, y) pushed far
 * outside, which makes the marker sit on the edge you would turn towards. Dead behind: it sits at the bottom.
 */
export function ndcOfClip(cx: number, cy: number, cw: number): { x: number; y: number; behind: boolean } {
  if (cw > 1e-6) return { x: cx / cw, y: cy / cw, behind: false };
  const m = Math.max(Math.abs(cx), Math.abs(cy));
  if (m < 1e-9) return { x: 0, y: -10, behind: true };
  return { x: (cx / m) * 10, y: (cy / m) * 10, behind: true };
}

/**
 * Keeps a marker inside the free area of the picture. A point already inside stays where it is (unless `forcePin`, used for far things
 * that must always sit on the edge); a point outside, or behind the camera, is moved along the line from the middle of the free area
 * to the point until it touches the edge. `width` and `height` are the picture size in pixels, `ndc` runs -1..1 (y up).
 */
export function pinToSafeRect(ndcX: number, ndcY: number, behind: boolean, width: number, height: number, safe: SafeRect, forcePin: boolean): Pinned {
  let l = safe.left;
  let r = width - safe.right;
  let t = safe.top;
  let b = height - safe.bottom;
  if (r - l < 8) {
    l = 0;
    r = width;
  }
  if (b - t < 8) {
    t = 0;
    b = height;
  }
  const px = (ndcX * 0.5 + 0.5) * width;
  const py = (0.5 - ndcY * 0.5) * height;
  if (!behind && !forcePin && px >= l && px <= r && py >= t && py <= b) return { x: px, y: py, pinned: false, side: "inside" };
  const cx = (l + r) / 2;
  const cy = (t + b) / 2;
  const hw = (r - l) / 2;
  const hh = (b - t) / 2;
  let dx = px - cx;
  let dy = py - cy;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    dx = 0;
    dy = -1; // dead in the middle: put it at the top
  }
  const sx = Math.abs(dx) > 1e-9 ? hw / Math.abs(dx) : Infinity;
  const sy = Math.abs(dy) > 1e-9 ? hh / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  const side: EdgeSide = sx < sy ? (dx < 0 ? "left" : "right") : dy < 0 ? "top" : "bottom";
  return { x: cx + dx * s, y: cy + dy * s, pinned: true, side };
}

/** Free area in window pixels (the same corners the title and the bottom bar leave free). */
export interface CssBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The gap between the marker's middle and the words, in window pixels. */
const GAP = 16;

/**
 * Where the top-left corner of the words goes, given the marker at (x, y), the words' size, which edge the marker sits on and the free
 * area. Pure: the box is placed beside the marker (towards the middle of the picture) and then pushed into the free area.
 */
export function tagPosition(x: number, y: number, w: number, h: number, side: EdgeSide, bounds: CssBounds): { x: number; y: number } {
  let tx: number;
  let ty: number;
  if (side === "left") {
    tx = x + GAP;
    ty = y - h / 2;
  } else if (side === "right") {
    tx = x - GAP - w;
    ty = y - h / 2;
  } else if (side === "top") {
    tx = x - w / 2;
    ty = y + GAP;
  } else if (side === "bottom") {
    tx = x - w / 2;
    ty = y - GAP - h;
  } else {
    // Not on an edge: to the right of the marker, or to the left when there is no room.
    tx = x + GAP + w <= bounds.right ? x + GAP : x - GAP - w;
    ty = y - h / 2;
  }
  tx = Math.max(bounds.left, Math.min(bounds.right - w, tx));
  ty = Math.max(bounds.top, Math.min(bounds.bottom - h, ty));
  return { x: tx, y: ty };
}

/** Is (x, y) closer than `minSep` pixels to one of the first `count` points already taken (xs, ys)? Keeps markers from piling up. */
export function tooClose(xs: ArrayLike<number>, ys: ArrayLike<number>, count: number, x: number, y: number, minSep: number): boolean {
  const limit = minSep * minSep;
  for (let i = 0; i < count; i++) {
    const dx = (xs[i] ?? 0) - x;
    const dy = (ys[i] ?? 0) - y;
    if (dx * dx + dy * dy < limit) return true;
  }
  return false;
}

/**
 * Which places get a marker: the most important first (start, outpost, starred, recent; nearer first inside one kind), at most
 * `maxTotal`, of which at most `maxFar` lie beyond the drawn ball (those become edge markers). Returns indices into `items`.
 */
export function pickPlaces(items: readonly { kind: MapPlaceKind; distanceLy: number }[], ballLy: number, maxTotal: number, maxFar: number): number[] {
  const order = items.map((_, i) => i).sort((a, b) => {
    const ka = PLACE_ORDER.indexOf(items[a]!.kind);
    const kb = PLACE_ORDER.indexOf(items[b]!.kind);
    return ka !== kb ? ka - kb : items[a]!.distanceLy - items[b]!.distanceLy || a - b;
  });
  const out: number[] = [];
  let far = 0;
  for (const i of order) {
    if (out.length >= maxTotal) break;
    const isFar = items[i]!.distanceLy > ballLy;
    if (isFar) {
      if (far >= maxFar) continue;
      far++;
    }
    out.push(i);
  }
  return out;
}

// ------------------------------------------------------------------ dashes and moving dots

/** A period (light years) that keeps the dashes at most `maxDashes` in number over a line of `totalLength`. */
export function fitPeriod(totalLength: number, period: number, maxDashes: number): number {
  return Math.max(period, totalLength / Math.max(1, maxDashes * 0.85));
}

/** A period rounded to steps of 25 %, so a small zoom does not rebuild the dashes. */
export function quantizePeriod(period: number): number {
  const p = Math.max(1e-4, period);
  return Math.pow(1.25, Math.round(Math.log(p) / Math.log(1.25)));
}

/**
 * The dashes of a dashed line along the points (x, y, z each): the pattern starts at the first point and runs on across the corners.
 * Each dash is two points written into `out` (6 numbers); returns how many dashes were written (stops when `out` is full).
 */
export function dashSegments(points: ArrayLike<number>, count: number, period: number, share: number, out: Float32Array): number {
  const maxDash = Math.floor(out.length / 6);
  if (!(period > 1e-6) || count < 2) return 0;
  const dashLen = period * Math.min(0.95, Math.max(0.05, share));
  let n = 0;
  let phase = 0; // distance into the current period
  for (let i = 0; i + 1 < count && n < maxDash; i++) {
    const ax = points[i * 3]!;
    const ay = points[i * 3 + 1]!;
    const az = points[i * 3 + 2]!;
    const bx = points[(i + 1) * 3]!;
    const by = points[(i + 1) * 3 + 1]!;
    const bz = points[(i + 1) * 3 + 2]!;
    const len = dist3(ax, ay, az, bx, by, bz);
    if (!(len > 0)) continue;
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    const uz = (bz - az) / len;
    let s = 0;
    while (s < len && n < maxDash) {
      if (phase < dashLen) {
        const e = Math.min(len, s + (dashLen - phase));
        const o = n * 6;
        out[o] = ax + ux * s;
        out[o + 1] = ay + uy * s;
        out[o + 2] = az + uz * s;
        out[o + 3] = ax + ux * e;
        out[o + 4] = ay + uy * e;
        out[o + 5] = az + uz * e;
        n++;
        phase += e - s;
        s = e;
        if (phase >= dashLen - 1e-9) phase = dashLen;
      } else {
        const e = Math.min(len, s + (period - phase));
        phase += e - s;
        s = e;
        if (phase >= period - 1e-9) phase = 0;
      }
    }
  }
  return n;
}

/**
 * The dots of a moving-dots line: one dot every `period` light years along the points, the first one `offset` along (so the dots
 * travel when `offset` grows). Written into `out` (x, y, z each); returns how many dots (stops when `out` is full).
 */
export function dotPositions(points: ArrayLike<number>, count: number, period: number, offset: number, out: Float32Array): number {
  const maxDots = Math.floor(out.length / 3);
  if (!(period > 1e-6) || count < 2) return 0;
  let n = 0;
  let next = ((offset % period) + period) % period;
  let walked = 0;
  for (let i = 0; i + 1 < count && n < maxDots; i++) {
    const ax = points[i * 3]!;
    const ay = points[i * 3 + 1]!;
    const az = points[i * 3 + 2]!;
    const bx = points[(i + 1) * 3]!;
    const by = points[(i + 1) * 3 + 1]!;
    const bz = points[(i + 1) * 3 + 2]!;
    const len = dist3(ax, ay, az, bx, by, bz);
    if (!(len > 0)) continue;
    while (next <= walked + len && n < maxDots) {
      const t = (next - walked) / len;
      out[n * 3] = ax + (bx - ax) * t;
      out[n * 3 + 1] = ay + (by - ay) * t;
      out[n * 3 + 2] = az + (bz - az) * t;
      n++;
      next += period;
    }
    walked += len;
  }
  return n;
}

// ------------------------------------------------------------------ camera help

/**
 * Where the camera should look, and how far away, to see the first `count` points of a line (relative to the ship) whole.
 * `vfovDeg` is the vertical field of view, `aspect` width / height; the narrower side decides. `margin` > 1 leaves room around.
 */
export function frameBounds(points: ArrayLike<number>, count: number, vfovDeg: number, aspect: number, margin: number): { centre: MapPoint; dist: number } {
  const n = Math.max(1, Math.min(count, Math.floor(points.length / 3)));
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = points[i * 3]!;
    const y = points[i * 3 + 1]!;
    const z = points[i * 3 + 2]!;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }
  const centre = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 };
  let radius = 0;
  for (let i = 0; i < n; i++) radius = Math.max(radius, dist3(points[i * 3]!, points[i * 3 + 1]!, points[i * 3 + 2]!, centre.x, centre.y, centre.z));
  const half = (Math.max(1, vfovDeg) * Math.PI) / 360;
  const halfH = Math.atan(Math.tan(half) * Math.max(0.2, aspect));
  const dist = Math.max(1, (radius * Math.max(1, margin)) / Math.sin(Math.min(half, halfH)));
  return { centre, dist };
}

// ------------------------------------------------------------------ testing aids (address words)

/** `?mapline=a|b|c` (or line | dashed | dots): the look of the plan line while Andy chooses. Null = not given. */
export function parseMapLine(search: string): RouteLook | null {
  const raw = new URLSearchParams(search).get("mapline");
  if (raw === null) return null;
  const word = raw.trim().toLowerCase();
  if (word === "a" || word === "line" || word === "plain") return "line";
  if (word === "b" || word === "dashed" || word === "dash") return "dashed";
  if (word === "c" || word === "dots" || word === "dot") return "dots";
  return null;
}

/** `?mapplan=N`: show a made-up plan of N hops (1 to 40) and some made-up places on the map, to look at the line. Null = not asked. */
export function parseMapPlan(search: string): number | null {
  const raw = new URLSearchParams(search).get("mapplan");
  if (raw === null) return null;
  const n = Math.floor(Number(raw.trim()));
  return Number.isFinite(n) && n >= 1 ? Math.min(40, n) : null;
}

/** The map's near stars, as far as the made-up plan needs them (positions relative to the ship). */
export interface DemoNear {
  count: number;
  positions: ArrayLike<number>;
  ids: ArrayLike<number>;
}

/**
 * A made-up plan for the testing aid `?mapplan=N`: from the ship `hops` hops towards one direction, each hop to the real near star
 * (within `hopMaxLy`) that gets farthest along the way, and when the near stars run out, straight steps of 85 % of a hop. Every fifth
 * stop is a refuel stop. The target lies 1,240 ly away in that direction. Also five places on real stars and two far ones.
 */
export function demoPlan(origin: MapPoint, near: DemoNear, hopMaxLy: number, hops: number): { route: MapRoute; places: MapPlace[] } {
  const dir = { x: 0.6, y: 0.04, z: 0.8 };
  const len = Math.hypot(dir.x, dir.y, dir.z);
  dir.x /= len;
  dir.y /= len;
  dir.z /= len;
  const reach = Math.max(5, hopMaxLy);
  const stops: MapRouteHop[] = [];
  let cx = 0;
  let cy = 0;
  let cz = 0;
  let chain = true;
  for (let i = 1; i <= hops; i++) {
    let best = -1;
    let bestProgress = 0;
    if (chain) {
      for (let j = 1; j < near.count; j++) {
        const dx = near.positions[j * 3]! - cx;
        const dy = near.positions[j * 3 + 1]! - cy;
        const dz = near.positions[j * 3 + 2]! - cz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > reach * reach || d2 < 1) continue;
        const progress = dx * dir.x + dy * dir.y + dz * dir.z;
        if (progress > bestProgress) {
          bestProgress = progress;
          best = j;
        }
      }
    }
    if (best >= 0) {
      cx = near.positions[best * 3]!;
      cy = near.positions[best * 3 + 1]!;
      cz = near.positions[best * 3 + 2]!;
    } else {
      chain = false;
      const step = reach * 0.85;
      cx += dir.x * step;
      cy += dir.y * step;
      cz += dir.z * step;
    }
    stops.push({ position: { x: origin.x + cx, y: origin.y + cy, z: origin.z + cz }, refuel: i % 5 === 0 });
  }
  const route: MapRoute = {
    hops: stops,
    target: { position: { x: origin.x + dir.x * 1240, y: origin.y + dir.y * 1240, z: origin.z + dir.z * 1240 }, name: "DEMO TARGET" },
  };
  const places: MapPlace[] = [];
  const onStar = (index: number, kinds: MapPlaceKind[], name: string): void => {
    if (index >= near.count) return;
    places.push({
      systemId: near.ids[index] ?? -1,
      position: { x: origin.x + near.positions[index * 3]!, y: origin.y + near.positions[index * 3 + 1]!, z: origin.z + near.positions[index * 3 + 2]! },
      kinds,
      name,
    });
  };
  onStar(6, ["start"], "Demo start dock");
  onStar(14, ["outpost"], "Demo outpost");
  onStar(22, ["starred"], "Demo starred star");
  onStar(9, ["recent"], "Demo recent dock");
  onStar(31, ["recent"], "Demo recent dock 2");
  places.push({ systemId: -1, position: { x: origin.x - 2100, y: origin.y + 40, z: origin.z + 1300 }, kinds: ["starred"], name: "Demo far star" });
  places.push({ systemId: -2, position: { x: origin.x + 3500, y: origin.y - 60, z: origin.z - 2500 }, kinds: ["outpost"], name: "Demo far outpost" });
  return { route, places };
}
