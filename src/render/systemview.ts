// SCREEN 2: one star system. The star in the middle, planets on orbit lines,
// each planet with its dock (an OUTPOST on the surface, or a STATION in orbit).

import * as THREE from "three";
import { getDock, getPlanetsOfSystem, getSystem, type Dock, type Planet, type Seed } from "../universe";
import { RENDER_HEIGHT, RENDER_WIDTH } from "../settings";
import { chooseLook, hasCloud, surfaceColour, type EarthStyle, type PlanetLook } from "./planetlook";
import {
  clamp,
  dockKindLabel,
  faceShade,
  hexToNumber,
  nearestScreenPoint,
  planetDisplayRadius,
  planetOrbitPosition,
  planetTypeLabel,
  starDisplayRadius,
  starfieldPositions,
  type ScreenPoint,
} from "./helpers";
import type { AssetModel } from "./assets";
import type { Hud } from "./hud";
import { OrbitView } from "./input";
import { buildDockModel } from "./models3d";
import { fitDistance, focusDistance, orbitRadii, planetDetail, planetFootprint, stationOrbitFor, systemSummary } from "./systemlayout";
import { markParts, type MarkStyle } from "./systemmarks";
import type { Screen } from "./screen";
import {
  STARFIELD_COUNT,
  SYSTEM_LANE_DOCK,
  SYSTEM_LANE_OLD,
  SYSTEM_LANE_SCENERY,
  SYSTEM_MARK_STYLE,
  SYSTEM_MIN_ZOOM_DIST,
  SYSTEM_OUTPOST_SCALE,
  SYSTEM_OUTPOST_SCALE_MAX,
  SYSTEM_OUTPOST_SCALE_MIN,
  SYSTEM_STATION_SCALE,
  TAP_RADIUS_PX,
} from "./settings";
import type { StateStore } from "./state";

export interface SystemViewOptions {
  seed: Seed;
  host: HTMLElement; // the canvas
  hud: Hud;
  state: StateStore;
}

interface PlanetEntry {
  planet: Planet;
  /** Null for a planet without a dock: it is only scenery (drawn and tappable for its info, but you cannot travel there). */
  dock: Dock | null;
  group: THREE.Group;
  radius: number;
  /** The dock design drawn small next to the planet (blinking lights, the station ring turning). */
  model: AssetModel | null;
  /** Set only for stations: they slowly circle their planet. */
  station: { object: THREE.Object3D; orbit: number; angle: number } | null;
}

export function disposeAll(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else if (material) material.dispose();
  });
}

/** What extras a planet gets. Rings and clouds are off where they would cut through the dock (docked views). */
export interface PlanetExtras {
  rings?: boolean;
  clouds?: boolean;
  /** How high the clouds float, as a share of the radius (default 0.05). Lower near a station that sits close above. */
  cloudLift?: number;
  /** Only for the /planets.html comparison of Earth looks (7f); the game leaves it out (mix of A and C). */
  earthStyle?: EarthStyle;
}

/**
 * A planet is a low-poly ball. Its patches are colored once (flat colours + 4 brightness steps), no lights needed.
 * The colours, ice caps, craters, stripes, clouds and rings come from the planet's LOOK (src/render/planetlook.ts,
 * Agent 7c option B), picked from its id: the same planet always looks the same, and src/universe is untouched.
 */
export function makePlanetMesh(planet: Planet, radius: number, toStar: THREE.Vector3, detail = 2, extras: PlanetExtras = {}): THREE.Mesh {
  const look = chooseLook(planet, extras.earthStyle);
  const geometry = new THREE.IcosahedronGeometry(radius, detail); // not indexed: every triangle has its own 3 corners
  const position = geometry.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  const base = new THREE.Color();
  const n = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let face = 0; face + 2 < position.count; face += 3) {
    n.set(0, 0, 0);
    for (let k = 0; k < 3; k++) n.add(v.set(position.getX(face + k), position.getY(face + k), position.getZ(face + k)));
    n.normalize();
    const c = surfaceColour(planet.type, look, n.x, n.y, n.z);
    base.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
    const shade = faceShade(n.dot(toStar));
    for (let k = 0; k < 3; k++) {
      colors[(face + k) * 3] = base.r * shade;
      colors[(face + k) * 3 + 1] = base.g * shade;
      colors[(face + k) * 3 + 2] = base.b * shade;
    }
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true }));
  if (extras.clouds !== false && look.clouds) {
    const clouds = makeCloudShell(look, radius, toStar, Math.min(detail, 5), extras.cloudLift ?? 0.05);
    if (clouds) mesh.add(clouds);
  }
  if (extras.rings !== false && look.rings) mesh.add(makeRings(look, radius, toStar));
  return mesh;
}

/** Cloud patches: a slightly bigger ball that keeps only its cloudy triangles, white with the same 4 light steps. */
function makeCloudShell(look: PlanetLook, radius: number, toStar: THREE.Vector3, detail: number, lift: number): THREE.Mesh | null {
  const shell = new THREE.IcosahedronGeometry(radius * (1 + lift), Math.max(2, detail));
  const p = shell.getAttribute("position");
  const pos: number[] = [];
  const col: number[] = [];
  const n = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let face = 0; face + 2 < p.count; face += 3) {
    n.set(0, 0, 0);
    for (let k = 0; k < 3; k++) n.add(v.set(p.getX(face + k), p.getY(face + k), p.getZ(face + k)));
    n.normalize();
    if (!hasCloud(look, n.x, n.y, n.z)) continue;
    const shade = faceShade(n.dot(toStar));
    for (let k = 0; k < 3; k++) {
      pos.push(p.getX(face + k), p.getY(face + k), p.getZ(face + k));
      col.push(shade, shade, shade);
    }
  }
  shell.dispose();
  if (pos.length === 0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }));
  m.name = "clouds";
  return m;
}

/** Rings: flat bands in rock colours, tilted; the half facing away from the star is a step darker. */
function makeRings(look: PlanetLook, radius: number, toStar: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  group.name = "rings";
  const lit = toStar.y >= 0 ? 1 : 0.72; // which face of the ring plane the star lights
  for (const band of look.rings ?? []) {
    const geo = new THREE.RingGeometry(radius * band.inner, radius * band.outer, RING_SEGMENTS, 1);
    const c = new THREE.Color().setRGB(band.colour[0], band.colour[1], band.colour[2], THREE.SRGBColorSpace).multiplyScalar(lit);
    const mat = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, transparent: true, opacity: band.opacity, depthWrite: false });
    group.add(new THREE.Mesh(geo, mat));
  }
  group.rotation.x = Math.PI / 2 - look.ringTilt.x;
  group.rotation.y = look.ringTilt.y;
  return group;
}

/** Segments around each ring band (2 triangles each). 40 keeps rings round enough at the game's low resolution. */
export const RING_SEGMENTS = 40;

// Kept for the viewer's "compare with old shape" (models.html). The game screens use Agent 8's designs now.
/** OUTPOST: a little building (box + pointed roof) standing on the planet surface, on the side facing outwards. */
export function makeOutpost(planet: Planet, radius: number, outward: THREE.Vector3): THREE.Group {
  const s = clamp(radius * 0.8, 0.6, 1.1);
  const group = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.55 * s, 0.35 * s, 0.55 * s), new THREE.MeshBasicMaterial({ color: 0xfff0b8 }));
  wall.position.y = 0.175 * s;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(0.4 * s, 0.4 * s, 4),
    new THREE.MeshBasicMaterial({ color: hexToNumber(planet.colors.accent) }),
  );
  roof.position.y = 0.35 * s + 0.2 * s;
  roof.rotation.y = Math.PI / 4;
  group.add(wall, roof);
  // Stand it on the surface, tilted so it faces away from the star (towards the camera's usual side).
  const up = new THREE.Vector3(0, 1, 0);
  const dir = outward.clone().multiplyScalar(0.6).add(up.clone().multiplyScalar(0.8)).normalize();
  group.position.copy(dir).multiplyScalar(radius * 0.97);
  group.quaternion.setFromUnitVectors(up, dir);
  return group;
}

// Kept for the viewer's "compare with old shape" (models.html). The game screens use Agent 8's designs now.
/** STATION: a small boxy body with two flat solar wings. */
export function makeStation(): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.7), new THREE.MeshBasicMaterial({ color: 0xe3e7ff }));
  const wingMaterial = new THREE.MeshBasicMaterial({ color: 0x4fc3ff });
  const wings = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 0.5), wingMaterial);
  group.add(body, wings);
  return group;
}

export class SystemViewScreen implements Screen {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, RENDER_WIDTH / RENDER_HEIGHT, 0.05, 700);

  private view: OrbitView;
  private content = new THREE.Group();
  private entries: PlanetEntry[] = [];
  private selectionMarker: THREE.LineSegments;
  private selected = -1;
  private systemName = "";
  private starLabel = "";
  private temp = new THREE.Vector3();
  private clockT = 0;
  private systemId: string | null = null;
  private markStyle: MarkStyle = SYSTEM_MARK_STYLE;
  private summary = "";
  private triangles = 0;
  private fitDist = 40;
  private footprints: number[] = [];

  constructor(private opts: SystemViewOptions) {
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.BufferAttribute(starfieldPositions(STARFIELD_COUNT, 450), 3));
    this.scene.add(new THREE.Points(bg, new THREE.PointsMaterial({ color: 0x8890c8, size: 1, sizeAttenuation: false })));
    this.scene.add(this.content);

    this.selectionMarker = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: 0xffffff }),
    );
    this.selectionMarker.visible = false;
    this.scene.add(this.selectionMarker);

    this.view = new OrbitView(this.camera, opts.host, SYSTEM_MIN_ZOOM_DIST, 90, 40);
    this.view.onTap = (x, y) => this.handleTap(x, y);
  }

  /** Marks docks with bright orbit lines ("A", the default) or the old look ("off"). Rebuilds the picture but keeps the camera. */
  setMarkStyle(style: MarkStyle): void {
    this.markStyle = style;
    if (!this.systemId) return;
    const { yaw, pitch, dist } = this.view;
    this.open(this.systemId);
    this.view.yaw = yaw;
    this.view.pitch = pitch;
    this.view.dist = clamp(dist, this.view.minDist, this.view.maxDist);
  }

  /** How many triangles the whole picture has now (planets, clouds, rings, star and dock models). For the preview readout. */
  triangleCount(): number {
    return this.triangles;
  }

  /** Builds the picture of one system. Call before enter(). */
  open(systemId: string): boolean {
    const { seed } = this.opts;
    const system = getSystem(seed, systemId);
    if (!system) return false;

    // Throw away the previous system.
    disposeAll(this.content);
    this.content.clear();
    this.entries = [];
    this.selected = -1;
    this.selectionMarker.visible = false;
    this.systemName = system.name;
    this.starLabel = system.star.label;

    const star = new THREE.Mesh(
      new THREE.IcosahedronGeometry(starDisplayRadius(system.star.radius), 1),
      new THREE.MeshBasicMaterial({ color: hexToNumber(system.star.color) }),
    );
    this.content.add(star);

    const parts = markParts(this.markStyle);
    const planets = getPlanetsOfSystem(seed, system.id);
    const docks = planets.map((planet) => getDock(seed, planet.id)); // null: this planet has no dock
    const radii = planets.map((planet) => planetDisplayRadius(planet.type, planet.radius));
    const footprints = planets.map((planet, i) => {
      const ringOuter = Math.max(0, ...(chooseLook(planet).rings ?? []).map((band) => band.outer));
      return planetFootprint(radii[i] ?? 1, docks[i]?.kind === "STATION", ringOuter);
    });
    const orbits = orbitRadii(footprints, starDisplayRadius(system.star.radius));
    const laneMaterial = (hasDock: boolean): THREE.LineBasicMaterial =>
      new THREE.LineBasicMaterial({ color: !parts.lanes ? SYSTEM_LANE_OLD : hasDock ? SYSTEM_LANE_DOCK : SYSTEM_LANE_SCENERY });
    const dockLane = laneMaterial(true);
    const sceneryLane = laneMaterial(false);

    let outermost = 6;
    planets.forEach((planet, index) => {
      const dock = docks[index] ?? null;
      const radius = radii[index] ?? 1;
      const orbit = orbits[index] ?? 5;
      outermost = Math.max(outermost, orbit + (footprints[index] ?? 1));

      // Orbit line: bright for a planet with a dock, dim for scenery.
      const ring: THREE.Vector3[] = [];
      for (let i = 0; i < 64; i++) {
        const p = planetOrbitPosition(orbit, i / 64);
        ring.push(new THREE.Vector3(p.x, 0, p.z));
      }
      this.content.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ring), dock ? dockLane : sceneryLane));

      // Planet. Crowded systems use lighter balls: see planetDetail.
      const at = planetOrbitPosition(orbit, planet.orbitPhase);
      const group = new THREE.Group();
      group.position.set(at.x, 0, at.z);
      const outward = new THREE.Vector3(at.x, 0, at.z).normalize();
      const toStar = outward.clone().negate();
      group.add(makePlanetMesh(planet, radius, toStar, planetDetail(planets.length, planet.type === "GAS")));

      // The dock: the design picked for it, drawn small. (Its own `parking` spot is at the model's origin.)
      // A planet without a dock gets no model at all.
      const model = dock ? buildDockModel(dock.kind, planet.id, planet).model : null;
      let station: PlanetEntry["station"] = null;
      if (!model || !dock) {
        // scenery only
      } else if (dock.kind === "OUTPOST") {
        const scale = clamp(radius * SYSTEM_OUTPOST_SCALE, SYSTEM_OUTPOST_SCALE_MIN, SYSTEM_OUTPOST_SCALE_MAX);
        const up = new THREE.Vector3(0, 1, 0);
        const dir = outward.clone().multiplyScalar(0.6).add(up.clone().multiplyScalar(0.8)).normalize();
        model.group.scale.setScalar(scale);
        model.group.position.copy(dir).multiplyScalar(radius * 0.985);
        model.group.quaternion.setFromUnitVectors(up, dir);
        group.add(model.group);
      } else {
        const object = model.group;
        const orbitAroundPlanet = stationOrbitFor(radius);
        object.scale.setScalar(SYSTEM_STATION_SCALE);
        group.add(object);
        station = { object, orbit: orbitAroundPlanet, angle: planet.index * 1.7 };
        object.position.set(Math.cos(station.angle) * orbitAroundPlanet, Math.sin(station.angle) * orbitAroundPlanet * 0.3, Math.sin(station.angle) * orbitAroundPlanet);
      }

      this.content.add(group);
      this.entries.push({ planet, dock, group, radius, model, station });
    });

    this.systemId = system.id;
    this.summary = systemSummary(
      planets.length,
      docks.filter((d): d is Dock => d !== null).map((d) => ({ name: d.name, kind: dockKindLabel(d.kind) })),
    );
    this.triangles = this.countTriangles();

    // Camera: far enough that every planet fits, with the same look-down angle as before.
    this.view.pitch = 0.6;
    this.view.yaw = 0.7;
    this.view.maxDist = clamp(outermost * 3, 30, 120);
    this.view.dist = clamp(fitDistance(outermost, this.camera.fov, this.camera.aspect, this.view.pitch), 14, this.view.maxDist);
    this.view.resetFocus(); // looking at the star again
    this.fitDist = this.view.dist;
    this.footprints = footprints;
    return true;
  }

  enter(): void {
    this.view.attach();
    this.opts.hud.setTitle(`SYSTEM - ${this.systemName} (${this.starLabel})`);
    this.refreshHud();
  }

  exit(): void {
    this.view.detach();
  }

  update(seconds: number): void {
    this.view.glide(seconds);
    this.view.apply();
    this.clockT += seconds;
    for (const entry of this.entries) {
      entry.model?.update(this.clockT); // blinking lights, the ring habitat turning
      const st = entry.station;
      if (!st) continue;
      st.angle += seconds * 0.6;
      st.object.position.set(Math.cos(st.angle) * st.orbit, Math.sin(st.angle) * st.orbit * 0.3, Math.sin(st.angle) * st.orbit);
    }
    const chosen = this.entries[this.selected];
    if (chosen) {
      this.selectionMarker.position.copy(chosen.group.position);
      this.selectionMarker.scale.setScalar(chosen.radius * 2.6 + (chosen.station ? chosen.station.orbit : 0.6));
      this.selectionMarker.rotation.y += 0.02;
    }
  }

  private countTriangles(): number {
    let total = 0;
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const g = mesh.geometry;
      total += g.index ? g.index.count / 3 : g.getAttribute("position").count / 3;
    });
    return Math.round(total);
  }

  /**
   * Tap a planet: it selects it AND becomes the middle of the picture (the camera glides there and moves in a little;
   * dragging then circles around that planet). Tap the star or empty space: back to the whole system.
   */
  private handleTap(clientX: number, clientY: number): void {
    const rect = this.opts.host.getBoundingClientRect();
    this.camera.updateMatrixWorld();
    const project = (v: THREE.Vector3): ScreenPoint => {
      this.temp.copy(v).project(this.camera);
      if (this.temp.z > 1) return { x: Infinity, y: Infinity };
      return { x: ((this.temp.x + 1) / 2) * rect.width, y: ((1 - this.temp.y) / 2) * rect.height };
    };
    const points: ScreenPoint[] = this.entries.map((e) => project(e.group.position));
    points.push(project(new THREE.Vector3(0, 0, 0))); // the star is the last point
    const hit = nearestScreenPoint(points, clientX - rect.left, clientY - rect.top, TAP_RADIUS_PX * 1.4);
    if (hit === this.entries.length || hit < 0) {
      // The star, or empty space: unselect and look at the whole system again.
      this.selected = -1;
      this.view.focusOn(0, 0, 0, this.fitDist);
    } else {
      this.selected = hit;
      const chosen = this.entries[hit];
      if (chosen) {
        const p = chosen.group.position;
        this.view.focusOn(p.x, p.y, p.z, focusDistance(this.footprints[hit] ?? 1.5, this.view.dist, this.view.minDist));
      }
    }
    const chosen = this.entries[this.selected];
    this.selectionMarker.visible = chosen !== undefined;
    this.opts.state.set({ selectedPlanetId: chosen ? chosen.planet.id : null });
    this.refreshHud();
  }

  private refreshHud(): void {
    const { hud } = this.opts;
    const chosen = this.entries[this.selected];
    if (chosen) {
      const planet = chosen.planet;
      const dock = chosen.dock;
      const size = `${planet.radius.toFixed(1)}x Earth size`;
      const second = dock ? `${dockKindLabel(dock.kind)}: ${dock.name}` : "No dock here - nothing to visit";
      hud.setLabel(`${planet.name} - ${planetTypeLabel(planet.type)}, ${size}\n${second}`);
    } else {
      hud.setLabel(this.summary);
    }
    hud.setButtons([]); // the System | Galaxy switch and CLOSE live in src/ui (Agent 5)
  }
}
