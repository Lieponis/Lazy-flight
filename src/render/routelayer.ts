// THE FLIGHT-PLAN LINE AND THE PLACE MARKERS, drawn on the galaxy map (stage NAV-2).
//
// Plain words: this is the part that puts things into the map's picture. The line goes from the ship through every stop of the plan
// (A: plain, B: dashed, C: a dim line with little dots moving towards the target). A small marker sits on every stop (a ring where
// the ship refuels), a bigger diamond on the target, and small pictures on my places (start dock, outposts, starred, recent).
// Markers are drawn at a fixed size on the small picture, so they stay readable however far you zoom. A target or place that lies
// beyond the drawn stars (or outside the picture) is pinned to the edge of the picture, in the direction you would turn to find it.
// Everything is a few dozen points and one line, rebuilt only when the plan, the zoom step or the look changes; nothing is built per frame
// except the positions of the markers (at most about 60 of them).

import * as THREE from "three";
import { GLYPHS, PLACE_GLYPH, glyphTexels, type GlyphName, type MarkSink } from "./routeglyphs";
import {
  dashSegments,
  dotPositions,
  fitPeriod,
  ndcOfClip,
  pickPlaces,
  pinToSafeRect,
  placeGlyphKind,
  quantizePeriod,
  tooClose,
  type EdgeSide,
  type MapPlace,
  type MapPlaceKind,
  type RouteLine,
  type RouteLook,
  type SafeRect,
} from "./routemath";
import {
  MAP_MARKER_MIN_SEP_PX,
  MAP_PLACE_EDGE_MAX,
  MAP_PLACE_MAX,
  MAP_ROUTE_DASH_PX,
  MAP_ROUTE_DASH_SHARE,
  MAP_ROUTE_DOT_GAP_PX,
  MAP_ROUTE_DOT_SPEED,
  MAP_ROUTE_MAX_DASHES,
  MAP_ROUTE_MAX_DOTS,
  MAP_ROUTE_MAX_HOPS,
} from "./settings";

const LINE_COLOR = 0xffb547;
const LINE_DIM = 0x7a5620;
const DOT_COLOR = 0xfff1c4;
const NO_INSET: SafeRect = { left: 0, top: 0, right: 0, bottom: 0 };
/** Draw order: after the stars (which draw at 0). */
const ORDER_LINE = 10;
const ORDER_MARKS = 11;

/** A place relative to the ship. */
interface PlaceRel {
  x: number;
  y: number;
  z: number;
  kind: MapPlaceKind;
  distanceLy: number;
}

interface GlyphSet {
  points: THREE.Points;
  attribute: THREE.BufferAttribute;
  positions: Float32Array;
  n: number;
  texture: THREE.DataTexture;
}

/** Where the target marker sits on the picture (pixels of the small picture), for the words next to it. */
export interface TargetTag {
  x: number;
  y: number;
  side: EdgeSide;
}

/** What the layer drew in the last frame (for tests and the developer counters). */
export interface RouteCounts {
  hop: number;
  refuel: number;
  target: number;
  start: number;
  outpost: number;
  starred: number;
  recent: number;
  dashes: number;
  dots: number;
}

function makeGlyphSet(name: GlyphName, max: number): GlyphSet {
  const t = glyphTexels(GLYPHS[name]);
  // A texture's first row is its BOTTOM: turn the rows over.
  const rowBytes = t.size * 4;
  const flipped = new Uint8Array(t.data.length);
  for (let y = 0; y < t.size; y++) flipped.set(t.data.subarray(y * rowBytes, (y + 1) * rowBytes), (t.size - 1 - y) * rowBytes);
  const texture = new THREE.DataTexture(flipped, t.size, t.size, THREE.RGBAFormat);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace; // the picture's colours come out exactly as written
  texture.needsUpdate = true;
  const positions = new Float32Array(max * 3);
  const attribute = new THREE.BufferAttribute(positions, 3);
  attribute.setUsage(THREE.DynamicDrawUsage);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", attribute);
  geometry.setDrawRange(0, 0);
  const material = new THREE.PointsMaterial({ map: texture, size: t.size, sizeAttenuation: false, alphaTest: 0.5, depthTest: false, depthWrite: false });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = ORDER_MARKS;
  points.visible = false;
  return { points, attribute, positions, n: 0, texture };
}

function makeLine(maxPoints: number, color: number, order: number): THREE.Line {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(maxPoints * 3), 3));
  geometry.setDrawRange(0, 0);
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, depthTest: false, depthWrite: false }));
  line.frustumCulled = false;
  line.renderOrder = order;
  line.visible = false;
  return line;
}

export class RouteLayer {
  readonly group = new THREE.Group();

  private look: RouteLook;
  private line: RouteLine | null = null;
  private lineLength = 0;
  private lineVersion = 0;
  private places: PlaceRel[] = [];
  private chosen: number[] = [];
  private lastBall = -1;

  private readonly main = makeLine(MAP_ROUTE_MAX_HOPS + 2, LINE_COLOR, ORDER_LINE);
  private readonly rest = makeLine(2, LINE_DIM, ORDER_LINE);
  private readonly dashes: THREE.LineSegments;
  private readonly dashBuffer = new Float32Array(MAP_ROUTE_MAX_DASHES * 6);
  private dashKey = "";
  private dashCount = 0;
  private readonly dots: THREE.Points;
  private readonly dotBuffer = new Float32Array(MAP_ROUTE_MAX_DOTS * 3);
  private dotCount = 0;
  private dotTime = 0;
  private readonly sets: Record<GlyphName, GlyphSet>;
  /** When set, the markers go there (a finer layer above the picture, not snapped) instead of being drawn inside the picture. */
  private sink: MarkSink | null = null;

  private readonly vp = new THREE.Matrix4();
  private readonly tmp = new THREE.Vector3();
  private readonly accX = new Float32Array(160);
  private readonly accY = new Float32Array(160);
  private accN = 0;

  constructor(look: RouteLook) {
    this.look = look;
    const dashGeometry = new THREE.BufferGeometry();
    dashGeometry.setAttribute("position", new THREE.BufferAttribute(this.dashBuffer, 3));
    dashGeometry.setDrawRange(0, 0);
    this.dashes = new THREE.LineSegments(dashGeometry, new THREE.LineBasicMaterial({ color: LINE_COLOR, depthTest: false, depthWrite: false }));
    this.dashes.frustumCulled = false;
    this.dashes.renderOrder = ORDER_LINE;
    this.dashes.visible = false;

    const dotGeometry = new THREE.BufferGeometry();
    dotGeometry.setAttribute("position", new THREE.BufferAttribute(this.dotBuffer, 3));
    dotGeometry.setDrawRange(0, 0);
    this.dots = new THREE.Points(dotGeometry, new THREE.PointsMaterial({ color: DOT_COLOR, size: 3, sizeAttenuation: false, depthTest: false, depthWrite: false }));
    this.dots.frustumCulled = false;
    this.dots.renderOrder = ORDER_LINE;
    this.dots.visible = false;

    this.sets = {
      hop: makeGlyphSet("hop", MAP_ROUTE_MAX_HOPS),
      refuel: makeGlyphSet("refuel", MAP_ROUTE_MAX_HOPS),
      target: makeGlyphSet("target", 1),
      start: makeGlyphSet("start", MAP_PLACE_MAX),
      outpost: makeGlyphSet("outpost", MAP_PLACE_MAX),
      starred: makeGlyphSet("starred", MAP_PLACE_MAX),
      recent: makeGlyphSet("recent", MAP_PLACE_MAX),
    };
    this.group.add(this.main, this.rest, this.dashes, this.dots);
    for (const set of Object.values(this.sets)) this.group.add(set.points);
    this.group.visible = false;
    this.applyLook();
  }

  // ------------------------------------------------------------------ what the map tells the layer

  /** Hand the markers to a finer layer (null = draw them inside the small picture, snapped to its pixels). */
  setSink(sink: MarkSink | null): void {
    this.sink?.clear();
    this.sink = sink;
    for (const set of Object.values(this.sets)) set.points.visible = false;
  }

  setLook(look: RouteLook): void {
    if (look === this.look) return;
    this.look = look;
    this.applyLook();
  }

  /** The plan as a line relative to the ship (null = no plan). */
  setRoute(line: RouteLine | null): void {
    this.line = line;
    this.lineVersion++;
    this.lineLength = 0;
    if (!line) {
      this.dashCount = 0;
      this.dotCount = 0;
    }
    if (line) {
      const pos = this.main.geometry.getAttribute("position") as THREE.BufferAttribute;
      (pos.array as Float32Array).set(line.points.subarray(0, Math.min(line.points.length, pos.array.length)));
      pos.needsUpdate = true;
      this.main.geometry.setDrawRange(0, Math.min(line.count, MAP_ROUTE_MAX_HOPS + 2));
      for (let i = 0; i + 1 < line.count; i++) {
        const a = i * 3;
        const b = a + 3;
        this.lineLength += Math.hypot(line.points[b]! - line.points[a]!, line.points[b + 1]! - line.points[a + 1]!, line.points[b + 2]! - line.points[a + 2]!);
      }
      const restPos = this.rest.geometry.getAttribute("position") as THREE.BufferAttribute;
      const last = (line.count - 1) * 3;
      const r = restPos.array as Float32Array;
      r[0] = line.points[last]!;
      r[1] = line.points[last + 1]!;
      r[2] = line.points[last + 2]!;
      r[3] = line.target.x;
      r[4] = line.target.y;
      r[5] = line.target.z;
      restPos.needsUpdate = true;
      this.rest.geometry.setDrawRange(0, 2);
    }
    this.applyLook();
    this.refreshVisibility();
  }

  /** My places, in galaxy coordinates; `origin` is where the ship (the map's middle) is. */
  setPlaces(places: readonly MapPlace[], origin: { x: number; y: number; z: number }): void {
    this.places = [];
    for (const p of places) {
      const kind = placeGlyphKind(p.kinds);
      if (!kind) continue;
      const x = p.position.x - origin.x;
      const y = p.position.y - origin.y;
      const z = p.position.z - origin.z;
      this.places.push({ x, y, z, kind, distanceLy: Math.hypot(x, y, z) });
    }
    this.lastBall = -1; // choose again at the next update
    this.refreshVisibility();
  }

  /** The layer is shown only while there is a plan or a place; when there is none, every marker is cleared. Returns whether it is shown. */
  private refreshVisibility(): boolean {
    const any = this.line !== null || this.places.length > 0;
    this.group.visible = any;
    if (!any) {
      this.sink?.clear();
      for (const set of Object.values(this.sets)) {
        set.n = 0;
        set.points.visible = false;
      }
    }
    return any;
  }

  /** The farthest the camera must see for the plan to be whole (light years from the ship), 0 if there is no plan. */
  extentLy(): number {
    return this.line ? this.line.extentLy : 0;
  }

  /** What was drawn in the last frame. */
  counts(): RouteCounts {
    const s = this.sets;
    return {
      hop: s.hop.n,
      refuel: s.refuel.n,
      target: s.target.n,
      start: s.start.n,
      outpost: s.outpost.n,
      starred: s.starred.n,
      recent: s.recent.n,
      dashes: this.dashCount,
      dots: this.dotCount,
    };
  }

  // ------------------------------------------------------------------ every frame

  /**
   * Moves the markers (and the dashes or dots when the look needs it) to match the camera. `width` and `height` are the small picture's
   * size in pixels, `safe` the free area (the title and the label are kept clear), `viewDist` the camera's distance from what it looks at,
   * `ballLy` the radius of the drawn stars (places and a target beyond it are pinned to the edge). Returns where the target marker is.
   */
  update(seconds: number, camera: THREE.PerspectiveCamera, viewDist: number, width: number, height: number, safe: SafeRect, ballLy: number): TargetTag | null {
    if (!this.refreshVisibility()) return null;
    if (ballLy !== this.lastBall) {
      this.lastBall = ballLy;
      this.chosen = pickPlaces(this.places, ballLy, MAP_PLACE_MAX, MAP_PLACE_EDGE_MAX);
    }
    camera.updateMatrixWorld();
    this.vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.sink?.begin();

    // Light years on screen per pixel of the small picture, at the distance the camera looks at: sets the size of dashes and gaps.
    const lyPerPx = (2 * Math.tan((camera.fov * Math.PI) / 360) * Math.max(0.5, viewDist)) / Math.max(1, height);
    this.updateLineLook(seconds, lyPerPx);

    for (const set of Object.values(this.sets)) set.n = 0;
    this.accN = 0;
    let tag: TargetTag | null = null;

    const line = this.line;
    if (line) {
      const far = line.targetLy > ballLy;
      const put = this.put("target", line.target.x, line.target.y, line.target.z, camera, width, height, safe, far, true);
      if (put) tag = { x: put.x, y: put.y, side: put.side };
    }
    for (const index of this.chosen) {
      const place = this.places[index];
      if (!place) continue;
      const far = place.distanceLy > ballLy;
      this.put(PLACE_GLYPH[place.kind], place.x, place.y, place.z, camera, width, height, safe, far, far);
    }
    if (line) {
      // Refuel stops first, then plain stops, so a crowd keeps the more important marker. Stops outside the picture are left out.
      for (const wantRefuel of [true, false]) {
        for (let i = 0; i < line.refuel.length; i++) {
          if (line.refuel[i] !== wantRefuel) continue;
          const o = (i + 1) * 3;
          this.put(wantRefuel ? "refuel" : "hop", line.points[o]!, line.points[o + 1]!, line.points[o + 2]!, camera, width, height, NO_INSET, false, false);
        }
      }
    }
    for (const set of Object.values(this.sets)) {
      set.points.visible = set.n > 0 && this.sink === null;
      set.points.geometry.setDrawRange(0, set.n);
      set.attribute.needsUpdate = true;
    }
    this.sink?.end();
    return tag;
  }

  /** Puts one marker on the picture; returns where, or null when it is left out (outside the picture, or too close to another). */
  private put(
    name: GlyphName,
    x: number,
    y: number,
    z: number,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
    safe: SafeRect,
    forcePin: boolean,
    mayPin: boolean,
  ): { x: number; y: number; side: EdgeSide } | null {
    const set = this.sets[name];
    if (set.n * 3 >= set.positions.length || this.accN >= this.accX.length) return null;
    const e = this.vp.elements;
    const cx = e[0]! * x + e[4]! * y + e[8]! * z + e[12]!;
    const cy = e[1]! * x + e[5]! * y + e[9]! * z + e[13]!;
    const cw = e[3]! * x + e[7]! * y + e[11]! * z + e[15]!;
    const ndc = ndcOfClip(cx, cy, cw);
    const p = pinToSafeRect(ndc.x, ndc.y, ndc.behind, width, height, safe, forcePin);
    if (p.pinned && !mayPin) return null;
    // Drawn inside the small picture: sit on the middle of a pixel, so the little picture lands pixel for pixel (and does not shimmer).
    // Handed to the finer layer: keep the exact spot, that layer moves it smoothly.
    const sink = this.sink;
    const sx = Math.min(width - 0.5, Math.max(0.5, sink ? p.x : Math.floor(p.x) + 0.5));
    const sy = Math.min(height - 0.5, Math.max(0.5, sink ? p.y : Math.floor(p.y) + 0.5));
    if (tooClose(this.accX, this.accY, this.accN, sx, sy, MAP_MARKER_MIN_SEP_PX)) return null;
    this.accX[this.accN] = sx;
    this.accY[this.accN] = sy;
    this.accN++;
    if (sink) {
      sink.add(name, sx, sy);
    } else {
      this.tmp.set((sx / width) * 2 - 1, 1 - (sy / height) * 2, 0.5).unproject(camera);
      const o = set.n * 3;
      set.positions[o] = this.tmp.x;
      set.positions[o + 1] = this.tmp.y;
      set.positions[o + 2] = this.tmp.z;
    }
    set.n++;
    return { x: sx, y: sy, side: p.side };
  }

  // ------------------------------------------------------------------ the look of the line

  private applyLook(): void {
    const has = this.line !== null;
    const look = this.look;
    this.main.visible = has && look !== "dashed";
    (this.main.material as THREE.LineBasicMaterial).color.setHex(look === "dots" ? LINE_DIM : LINE_COLOR);
    this.rest.visible = has && this.line!.hasRest;
    this.dashes.visible = has && look === "dashed";
    this.dots.visible = has && look === "dots";
    this.dashKey = ""; // rebuild at the next frame
  }

  private updateLineLook(seconds: number, lyPerPx: number): void {
    const line = this.line;
    if (!line || line.count < 2) return;
    if (this.look === "dashed") {
      const period = fitPeriod(this.lineLength, quantizePeriod(lyPerPx * MAP_ROUTE_DASH_PX), MAP_ROUTE_MAX_DASHES);
      const key = `${this.lineVersion}|${period.toFixed(5)}`;
      if (key === this.dashKey) return;
      this.dashKey = key;
      this.dashCount = dashSegments(line.points, line.count, period, MAP_ROUTE_DASH_SHARE, this.dashBuffer);
      this.dashes.geometry.setDrawRange(0, this.dashCount * 2);
      (this.dashes.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    } else if (this.look === "dots") {
      const period = Math.max(quantizePeriod(lyPerPx * MAP_ROUTE_DOT_GAP_PX), this.lineLength / (MAP_ROUTE_MAX_DOTS * 0.85));
      this.dotTime += seconds;
      this.dotCount = dotPositions(line.points, line.count, period, this.dotTime * period * MAP_ROUTE_DOT_SPEED, this.dotBuffer);
      this.dots.geometry.setDrawRange(0, this.dotCount);
      (this.dots.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const o of [this.main, this.rest, this.dashes, this.dots]) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
    for (const set of Object.values(this.sets)) {
      set.points.geometry.dispose();
      (set.points.material as THREE.Material).dispose();
      set.texture.dispose();
    }
  }
}
