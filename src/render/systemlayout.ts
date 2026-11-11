// THE SYSTEM VIEW LAYOUT (stage U3, Agent 3): how far apart the planets sit, how far away the camera stands, how detailed
// each planet ball is. Pure numbers, no Three.js, so it can be tested.
// Systems have 1 to 10 planets; only 1 to 3 of them have a dock (the rest is scenery).

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

/** The short summary line shown when nothing is selected: how many planets, which of them can be visited. */
export function systemSummary(planetCount: number, docks: readonly { name: string; kind: string }[]): string {
  const planets = planetCount === 1 ? "1 planet" : `${planetCount} planets`;
  if (docks.length === 0) return `${planets}, no docks.\nTap a planet to see it.`;
  const list = docks.map((d) => `${d.name} (${d.kind})`).join(", ");
  const count = docks.length === 1 ? "1 dock" : `${docks.length} docks`;
  return `${planets}, ${count}: ${list}\nTap a planet to see it. Drag to turn, pinch to zoom.`;
}
