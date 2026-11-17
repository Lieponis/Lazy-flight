// SCREEN 1: the galaxy map (stage G5a: the real map).
//
// Plain words: the map shows the 60,000 stars nearest to where you are. Every star is one coloured pixel (closer = brighter, fading
// to nothing at the edge so the cloud has no visible edge). Stars inside your ship's reach also get a small diamond. Tap a star and the
// camera glides to it; the label shows its name, its type, how far it is and the distances to its 5 nearest neighbours.
// The stars come from the app as plain lists (a MapSource), asked ONCE each time you arrive somewhere new, never per frame.

import * as THREE from "three";
import { RENDER_HEIGHT, RENDER_WIDTH } from "../settings";
import { nearStarsFromList, nearestLineText, starsWithin, type MapPoint, type MapSource } from "./galaxy/mapdata";
import type { NearStars } from "./galaxy/neardata";
import { NearLayers, type NearCounts } from "./galaxy/nearlayers";
import {
  FLY_TO_DIST_LY,
  MIN_TAP_VISIBILITY,
  MIN_ZOOM_LY,
  ROOM_AROUND_TARGET_LY,
  maxOrbitDistance,
  tapVisibility,
  zoomOutLimit,
} from "./galaxy/previewmath";
import { StarGrid, nearestTo } from "./galaxy/starpick";
import { orbitCameraPosition, starfieldPositions } from "./helpers";
import type { Hud } from "./hud";
import { OrbitView } from "./input";
import type { Screen } from "./screen";
import { MAP_DIAMOND_CAP, MAP_NEAR_STARS, MAP_REACH_FALLBACK_LY, MAP_TAPPABLE_STARS, MAP_TAP_RADIUS_PX, STARFIELD_COUNT } from "./settings";
import { starLabelText, starmapHint } from "./starmapradius";
import type { StateStore } from "./state";

/** The system the player is in: the centre of the map. */
export interface StarMapHere {
  id: number;
  name: string;
  /** For example "Yellow star". */
  starLabel: string;
  /** Galaxy coordinates in light years. */
  position: MapPoint;
}

export interface StarMapOptions {
  /** Where the stars come from. Null = the app gave none (the map then only shows the hint). */
  source: MapSource | null;
  host: HTMLElement; // the canvas
  hud: Hud;
  state: StateStore;
  current: StarMapHere;
  onOpenSystem: (systemId: number) => void;
  /** The ship's reach in light years (decides which stars get a diamond). Null = not known yet. */
  reachLy?: number | null;
}

function makeMarker(color: number): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
  return new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color }));
}

export class StarMapScreen implements Screen {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, RENDER_WIDTH / RENDER_HEIGHT, 0.2, 800);

  private readonly view: OrbitView;
  private readonly layers = new NearLayers();
  private readonly selectionMarker = makeMarker(0xffffff);
  private readonly currentMarker = makeMarker(0x5dff7a);
  private readonly backdrop: THREE.Points;
  private readonly tapRay = new THREE.Vector3();

  private current: StarMapHere;
  private reachLy: number | null;
  private active = false;

  /** The stars around `builtFor` (null = not asked yet). Filled the first time the map is shown after a move. */
  private near: NearStars | null = null;
  private builtFor: number | null = null;
  private grid: StarGrid | null = null;
  /** How visible each tappable star is (0..1): a star too faint to see never wins a tap over a visible one. */
  private tapVis = new Float32Array(0);
  private counts: NearCounts = { diamonds: 0, pixels: 0, triangles: 0 };
  /** The tapped star (index into the star lists), or null. */
  private selected: number | null = null;
  private nearestLine = "";
  /** Milliseconds the last star lookup and set-up took (the app's list plus the grid): for the report. */
  private lastBuildMs = 0;

  constructor(private readonly opts: StarMapOptions) {
    this.current = opts.current;
    this.reachLy = opts.reachLy ?? null;

    this.scene.add(this.layers.group);

    // Background stars: single dots far away (replaced by the sky seen from where you stand in the next step).
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.BufferAttribute(starfieldPositions(STARFIELD_COUNT, 450), 3));
    this.backdrop = new THREE.Points(bg, new THREE.PointsMaterial({ color: 0x8890c8, size: 1, sizeAttenuation: false }));
    this.scene.add(this.backdrop);

    this.selectionMarker.visible = false;
    this.scene.add(this.selectionMarker, this.currentMarker);

    this.view = new OrbitView(this.camera, opts.host, MIN_ZOOM_LY, 150, 60);
    this.view.onTap = (x, y) => this.handleTap(x, y);
  }

  // ------------------------------------------------------------------ what the app tells the map

  /** The player is in another system: the map is centred on it, the stars are asked for again (when the map is next shown). */
  setCurrent(here: StarMapHere): void {
    if (here.id === this.current.id && here.position.x === this.current.position.x && here.position.y === this.current.position.y && here.position.z === this.current.position.z) {
      this.current = here; // same place (maybe a new name text): nothing to rebuild
      return;
    }
    this.current = here;
    this.near = null; // the stars are asked for again the next time the map is shown
    this.builtFor = null;
    this.selected = null;
    this.opts.state.set({ selectedSystemId: null });
    if (this.active) {
      this.ensureData();
      this.refreshTitle();
      this.refreshHud();
    }
  }

  /** The ship's reach changed: only the diamonds change (cheap, the stars are the same). */
  setReachLy(reachLy: number | null): void {
    const clean = reachLy !== null && Number.isFinite(reachLy) && reachLy > 0 ? reachLy : null;
    if (clean === this.reachLy) return;
    this.reachLy = clean;
    if (this.near) this.applyReach();
  }

  // ------------------------------------------------------------------ the stars

  /** Asks the app for the nearest stars around the player (once per move) and sets up the pixels, diamonds and the tap grid. */
  private ensureData(): void {
    if (this.near && this.builtFor === this.current.id) return;
    const source = this.opts.source;
    if (!source) return;
    const t0 = performance.now();
    const near = nearStarsFromList(source.nearest(this.current.position, MAP_NEAR_STARS));
    this.near = near;
    this.builtFor = this.current.id;
    this.selected = null;
    this.nearestLine = "";
    this.selectionMarker.visible = false;
    this.counts = this.layers.setStars(near, this.reachCount(near), MAP_DIAMOND_CAP);
    this.grid = new StarGrid(near.positions, MAP_TAPPABLE_STARS);
    this.refreshTapVisibility(near);
    // The camera can see out to twice the bubble; the backdrop sits beyond the farthest it ever gets.
    this.camera.far = Math.max(800, near.radius * 2.2 + 50);
    this.camera.updateProjectionMatrix();
    this.view.resetFocus();
    this.view.dist = this.defaultDist(near);
    this.lastBuildMs = performance.now() - t0;
  }

  private reachCount(near: NearStars): number {
    return starsWithin(near.distances, near.count, this.reachLy ?? MAP_REACH_FALLBACK_LY);
  }

  private applyReach(): void {
    const near = this.near;
    if (!near) return;
    this.counts = this.layers.setDiamonds(near, this.reachCount(near), MAP_DIAMOND_CAP);
    this.refreshTapVisibility(near);
    this.layers.setSelected(near, this.selected);
  }

  private refreshTapVisibility(near: NearStars): void {
    const grid = this.grid;
    if (!grid) return;
    if (this.tapVis.length !== grid.count) this.tapVis = new Float32Array(grid.count);
    for (let i = 0; i < grid.count; i++) this.tapVis[i] = tapVisibility(near.distances[i] ?? 0, near.radius, i < this.counts.diamonds);
  }

  /** How far the camera may be from the player (light years): out to the nearest-1,000-stars distance of the local spacing. */
  private zoomLimit(near: NearStars): number {
    return zoomOutLimit("near", near.distances, near.count, near.radius, near.zoomNearLy);
  }

  /** The camera starts far enough away to see the stars within reach (at least 60 ly), but never beyond the zoom-out limit. */
  private defaultDist(near: NearStars): number {
    const reach = this.reachLy ?? MAP_REACH_FALLBACK_LY;
    return Math.min(Math.max(60, reach * 1.2), this.zoomLimit(near));
  }

  // ------------------------------------------------------------------ the Screen interface

  enter(): void {
    this.active = true;
    this.ensureData();
    this.view.attach();
    this.refreshTitle();
    this.refreshHud();
  }

  exit(): void {
    this.active = false;
    this.view.detach();
  }

  update(seconds: number): void {
    const near = this.near;
    if (near) {
      this.view.glide(Math.min(0.1, seconds));
      const u = orbitCameraPosition(this.view.yaw, this.view.pitch, 1);
      this.view.maxDist = maxOrbitDistance(this.view.target, u, this.zoomLimit(near), Math.max(this.view.minDist, ROOM_AROUND_TARGET_LY));
      if (this.view.dist > this.view.maxDist) this.view.dist = this.view.maxDist;
    }
    this.view.apply();
    // Keep the markers about the same size on screen, however far you zoom.
    const s = this.view.dist * 0.045;
    this.currentMarker.scale.setScalar(s * 1.3);
    this.selectionMarker.scale.setScalar(s);
    this.selectionMarker.rotation.y += 0.02;
    this.backdrop.position.copy(this.camera.position); // the backdrop dots stay around the camera
  }

  /** What the map holds now, for the developer counters and the report. */
  stats(): { stars: number; diamonds: number; tappable: number; buildMs: number; zoomLimitLy: number; radiusLy: number } {
    const near = this.near;
    return {
      stars: near?.count ?? 0,
      diamonds: this.counts.diamonds,
      tappable: this.grid?.count ?? 0,
      buildMs: this.lastBuildMs,
      zoomLimitLy: near ? this.zoomLimit(near) : 0,
      radiusLy: near?.radius ?? 0,
    };
  }

  // ------------------------------------------------------------------ taps

  /** A tap on the picture: the nearest star to the finger (inside the tap circle) is picked and the camera glides to it. */
  private handleTap(clientX: number, clientY: number): void {
    const near = this.near;
    const grid = this.grid;
    if (!near || !grid) return;
    const rect = this.opts.host.getBoundingClientRect();
    const nx = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const ny = -(((clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
    this.camera.updateMatrixWorld();
    this.tapRay.set(nx, ny, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    const halfFov = (this.camera.fov * Math.PI) / 360;
    const maxAngle = Math.atan((MAP_TAP_RADIUS_PX / (Math.max(1, rect.height) / 2)) * Math.tan(halfFov));
    const p = this.camera.position;
    const hit = grid.pick(p.x, p.y, p.z, this.tapRay.x, this.tapRay.y, this.tapRay.z, maxAngle, this.camera.far, this.camera.near, {
      visibility: this.tapVis,
      minVisible: MIN_TAP_VISIBILITY,
    });
    this.select(hit ? hit.index : null);
  }

  private select(index: number | null): void {
    const near = this.near;
    if (!near || index === null || index < 0 || index >= near.count) {
      this.selected = null;
      this.nearestLine = "";
      this.selectionMarker.visible = false;
      if (near) this.layers.setSelected(near, null);
      this.opts.state.set({ selectedSystemId: null });
      this.refreshHud();
      return;
    }
    this.selected = index;
    this.layers.setSelected(near, index);
    const x = near.positions[index * 3] ?? 0;
    const y = near.positions[index * 3 + 1] ?? 0;
    const z = near.positions[index * 3 + 2] ?? 0;
    this.selectionMarker.position.set(x, y, z);
    this.selectionMarker.visible = true;
    this.view.focusOn(x, y, z, FLY_TO_DIST_LY);
    // The only extra text on the map: the tapped star's 5 nearest neighbours (no label per star in the picture).
    const around = nearestTo(near.positions, Math.min(MAP_TAPPABLE_STARS, near.count), index, 5);
    this.nearestLine = nearestLineText(around.map((n) => n.distance));
    this.opts.state.set({ selectedSystemId: near.ids[index] ?? null });
    this.refreshHud();
  }

  // ------------------------------------------------------------------ the words on screen

  private refreshTitle(): void {
    this.opts.hud.setTitle(`STARMAP - you are in ${this.current.name} (${this.current.starLabel})`);
  }

  private refreshHud(): void {
    const hud = this.opts.hud;
    const source = this.opts.source;
    const near = this.near;
    const index = this.selected;
    const id = near && index !== null ? (near.ids[index] ?? null) : null;
    const info = id !== null && source ? source.describe(id) : null;
    if (near && index !== null && id !== null) {
      const d = near.distances[index] ?? 0;
      const here = id === this.current.id;
      const head = info ? starLabelText(info.name, info.starLabel, d, here) : starLabelText(`System ${id}`, "unknown star", d, here);
      hud.setLabel(this.nearestLine ? `${head}\n${this.nearestLine}` : head);
    } else {
      hud.setLabel(starmapHint());
    }
    hud.setButtons([
      {
        text: "Open system",
        disabled: id === null,
        onClick: () => {
          if (id !== null) this.opts.onOpenSystem(id);
        },
      },
    ]);
  }
}
