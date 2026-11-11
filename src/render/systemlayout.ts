// THE SYSTEM VIEW LAYOUT (stage U3, Agent 3): how far apart the planets sit, how far away the camera stands, how detailed
// each planet ball is, and where the dock name tags go. Pure numbers, no Three.js, so it can be tested.
// Systems have 1 to 10 planets; only 1 to 3 of them have a dock (the rest is scenery).

import { clamp } from "./helpers";

/** How far a station circles its planet (system units). Rocky worlds about 1.6 to 2.3, gas giants 3.1 to 4.1. */
export function stationOrbitFor(planetRadius: number): number {
  return planetRadius * 1.3 + 0.7;
}

/** How much room a planet needs around its centre: the ball, its rings, or its station's circle, whichever is widest. */
export function planetFootprint(planetRadius: number, hasStation: boolean, ringOuter = 0): number {
  let f = planetRadius * 1.15;
  if (ringOuter > 1) f = Math.max(f, planetRadius * ringOuter);
  if (hasStation) f = Math.max(f, stationOrbitFor(planetRadius) + 0.3);
  return f;
}

/** Empty space left between the edges of two neighbouring footprints. */
export const ORBIT_CLEARANCE = 0.5;
/** The closest the first planet may orbit the star. */
export const FIRST_ORBIT_MIN = 4.2;

/**
 * Orbit radius of every planet, nearest the star first. Each orbit is just wide enough that the footprints of
 * two neighbours never touch, so big gas giants get more room and small rocks sit closer: 10 planets stay compact.
 */
export function orbitRadii(footprints: readonly number[], starRadius: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < footprints.length; i++) {
    const own = footprints[i] ?? 1;
    if (i === 0) {
      out.push(Math.max(FIRST_ORBIT_MIN, starRadius + own + 1));
    } else {
      out.push((out[i - 1] ?? 0) + (footprints[i - 1] ?? 1) + own + ORBIT_CLEARANCE);
    }
  }
  return out;
}

/**
 * How far the camera must stand so the whole system fits the picture. `outer` = the farthest edge from the star,
 * `fovDeg` = the camera's up-and-down view angle, `aspect` = width / height, `pitch` = how far the camera looks down (radians).
 */
export function fitDistance(outer: number, fovDeg: number, aspect: number, pitch: number, margin = 1.2): number {
  const halfV = Math.tan((fovDeg * Math.PI) / 360);
  const halfH = halfV * Math.max(0.3, aspect);
  const sideways = (margin * outer) / halfH;
  const upDown = (margin * (outer * Math.sin(pitch) + 2)) / halfV;
  return Math.max(sideways, upDown);
}

/**
 * How round the planet balls are (Three.js "detail": 2 = 180 triangles, 1 = 80, 3 = 320). Crowded systems use smaller balls
 * because each planet is only a few pixels wide then; this keeps a 10-planet system light for phones.
 */
export function planetDetail(planetCount: number, isGas: boolean): number {
  if (planetCount >= 7) return isGas ? 2 : 1;
  return isGas ? 3 : 2;
}

/** Triangles in an icosahedron ball of the given detail (Three.js: 20 x (detail + 1) squared). */
export function ballTriangles(detail: number): number {
  return 20 * (detail + 1) * (detail + 1);
}

export interface TagBox {
  /** Middle of the tag, across (pixels). */
  x: number;
  /** Bottom of the tag, down from the top (pixels). */
  y: number;
  w: number;
  h: number;
}

/**
 * Moves name tags down so no two overlap, and keeps all of them inside the picture. Returns the new bottom edge of each tag
 * (same order as the input). Tags only move up and down, never sideways.
 */
export function spreadTags(boxes: readonly TagBox[], pictureHeight: number, gap = 2): number[] {
  const order = boxes.map((_, i) => i).sort((a, b) => (boxes[a]?.y ?? 0) - (boxes[b]?.y ?? 0));
  const ys = boxes.map((b) => b.y);
  // From the top down: a tag that sits on one above it is pushed below it.
  for (let k = 1; k < order.length; k++) {
    const cur = order[k] as number;
    const c = boxes[cur] as TagBox;
    for (let j = k - 1; j >= 0; j--) {
      const other = order[j] as number;
      const o = boxes[other] as TagBox;
      const sideways = Math.abs(c.x - o.x) < (c.w + o.w) / 2;
      const otherBottom = ys[other] ?? 0;
      const otherTop = otherBottom - o.h;
      const myBottom = ys[cur] ?? 0;
      const myTop = myBottom - c.h;
      if (sideways && myTop < otherBottom + gap && myBottom > otherTop - gap) ys[cur] = otherBottom + gap + c.h;
    }
  }
  return ys.map((y, i) => clamp(y, (boxes[i]?.h ?? 0) + 2, Math.max(pictureHeight - 2, 0)));
}

/** The short summary line shown when nothing is selected: how many planets, which of them can be visited. */
export function systemSummary(planetCount: number, docks: readonly { name: string; kind: string }[]): string {
  const planets = planetCount === 1 ? "1 planet" : `${planetCount} planets`;
  if (docks.length === 0) return `${planets}, no docks.\nTap a planet to see it.`;
  const list = docks.map((d) => `${d.name} (${d.kind})`).join(", ");
  const count = docks.length === 1 ? "1 dock" : `${docks.length} docks`;
  return `${planets}, ${count}: ${list}\nTap a planet to see it. Drag to turn, pinch to zoom.`;
}

/** Marks that are in the picture and facing us: false for points behind the camera or far outside the picture. */
export function onPicture(x: number, y: number, depth: number, width: number, height: number): boolean {
  return depth <= 1 && x > -40 && y > -40 && x < width + 40 && y < height + 40;
}
