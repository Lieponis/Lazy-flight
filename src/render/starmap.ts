// SCREEN 1: the starmap. Nearby star systems as small chunky diamonds, colored by star type.

import * as THREE from "three";
import { distance, listSystemsNear, type Seed, type StarSystem } from "../universe";
import { RENDER_HEIGHT, RENDER_WIDTH } from "../settings";
import {
  hexToNumber,
  nearestScreenPoint,
  starfieldPositions,
  starmapStarSize,
  type ScreenPoint,
} from "./helpers";
import type { Hud } from "./hud";
import { OrbitView } from "./input";
import type { Screen } from "./screen";
import { STARFIELD_COUNT, STARMAP_RADIUS_LY, TAP_RADIUS_PX } from "./settings";
import { starLabelText, starmapCameraLimits, starmapHint } from "./starmapradius";
import type { StateStore } from "./state";

export interface StarMapOptions {
  seed: Seed;
  host: HTMLElement; // the canvas
  hud: Hud;
  state: StateStore;
  current: StarSystem;
  onOpenSystem: (systemId: string) => void;
  /** The map shows every system closer than this (light years). Default 35. */
  radiusLy?: number;
  /** True when the ship can fly farther than the map shows: the hint then says so. */
  farNote?: boolean;
}

function makeMarker(color: number): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
  return new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color }));
}

export class StarMapScreen implements Screen {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, RENDER_WIDTH / RENDER_HEIGHT, 0.5, 700); // far is set for the map size in the constructor

  private view: OrbitView;
  private systems: StarSystem[];
  private positions: THREE.Vector3[];
  private selectedIndex = -1;
  private selectionMarker = makeMarker(0xffffff);
  private currentMarker = makeMarker(0x5dff7a);
  private temp = new THREE.Vector3();

  constructor(private opts: StarMapOptions) {
    const origin = opts.current.position;
    const radius = opts.radiusLy ?? STARMAP_RADIUS_LY;
    const limits = starmapCameraLimits(radius);
    this.camera.far = limits.far;
    this.camera.updateProjectionMatrix();
    this.systems = listSystemsNear(opts.seed, origin, radius);
    // The map is centered on the current system, so the current system sits at (0,0,0).
    this.positions = this.systems.map(
      (s) => new THREE.Vector3(s.position.x - origin.x, s.position.y - origin.y, s.position.z - origin.z),
    );

    // Stars: ONE instanced mesh (one draw call for all of them).
    const count = Math.max(1, this.systems.length);
    const stars = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      count,
    );
    stars.frustumCulled = false;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    this.systems.forEach((s, i) => {
      const size = starmapStarSize(s.star.radius);
      matrix.makeScale(size, size, size);
      const p = this.positions[i];
      if (p) matrix.setPosition(p);
      stars.setMatrixAt(i, matrix);
      color.setHex(hexToNumber(s.star.color));
      stars.setColorAt(i, color);
    });
    stars.instanceMatrix.needsUpdate = true;
    if (stars.instanceColor) stars.instanceColor.needsUpdate = true;
    this.scene.add(stars);

    // Background stars: single dots far away.
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.BufferAttribute(starfieldPositions(STARFIELD_COUNT, limits.backdropRadius), 3));
    this.scene.add(new THREE.Points(bg, new THREE.PointsMaterial({ color: 0x8890c8, size: 1, sizeAttenuation: false })));

    this.selectionMarker.visible = false;
    this.scene.add(this.selectionMarker, this.currentMarker);

    this.view = new OrbitView(this.camera, opts.host, 8, limits.maxDist, 52);
    this.view.onTap = (x, y) => this.handleTap(x, y);
  }

  enter(): void {
    this.view.attach();
    const { hud, current } = this.opts;
    hud.setTitle(`STARMAP - you are in ${current.name} (${current.star.label})`);
    this.refreshHud();
  }

  exit(): void {
    this.view.detach();
  }

  update(): void {
    this.view.apply();
    // Keep the markers about the same size on screen, however far you zoom.
    const s = this.view.dist * 0.045;
    this.currentMarker.scale.setScalar(s * 1.3);
    this.selectionMarker.scale.setScalar(s);
    this.selectionMarker.rotation.y += 0.02;
  }

  private handleTap(clientX: number, clientY: number): void {
    const rect = this.opts.host.getBoundingClientRect();
    this.camera.updateMatrixWorld();
    const points: ScreenPoint[] = this.positions.map((p) => {
      this.temp.copy(p).project(this.camera);
      if (this.temp.z > 1) return { x: Infinity, y: Infinity }; // behind the camera
      return { x: ((this.temp.x + 1) / 2) * rect.width, y: ((1 - this.temp.y) / 2) * rect.height };
    });
    this.select(nearestScreenPoint(points, clientX - rect.left, clientY - rect.top, TAP_RADIUS_PX));
  }

  private select(index: number): void {
    this.selectedIndex = index;
    const system = this.systems[index];
    const position = this.positions[index];
    if (system && position) {
      this.selectionMarker.position.copy(position);
      this.selectionMarker.visible = true;
      this.opts.state.set({ selectedSystemId: system.id });
    } else {
      this.selectionMarker.visible = false;
      this.opts.state.set({ selectedSystemId: null });
    }
    this.refreshHud();
  }

  private refreshHud(): void {
    const { hud, current } = this.opts;
    const system = this.systems[this.selectedIndex];
    if (system) {
      const d = distance(system.position, current.position);
      const here = system.id === current.id;
      hud.setLabel(starLabelText(system.name, system.star.label, d, here));
    } else {
      hud.setLabel(starmapHint(this.opts.farNote === true));
    }
    hud.setButtons([
      {
        text: "Open system",
        disabled: !system,
        onClick: () => {
          if (system) this.opts.onOpenSystem(system.id);
        },
      },
    ]);
  }
}
