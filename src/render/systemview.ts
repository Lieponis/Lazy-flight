// SCREEN 2: one star system. The star in the middle, planets on orbit lines,
// each planet with its dock (an OUTPOST on the surface, or a STATION in orbit).

import * as THREE from "three";
import { generateDock, getPlanetsOfSystem, getSystem, type Dock, type Planet, type Seed } from "../universe";
import { RENDER_HEIGHT, RENDER_WIDTH } from "../settings";
import {
  clamp,
  dockKindLabel,
  faceShade,
  hexToNumber,
  nearestScreenPoint,
  orbitDisplayRadius,
  planetColorMix,
  planetDisplayRadius,
  planetOrbitPosition,
  planetTypeLabel,
  starDisplayRadius,
  starfieldPositions,
  type ScreenPoint,
} from "./helpers";
import type { Hud } from "./hud";
import { OrbitView } from "./input";
import type { Screen } from "./screen";
import { STARFIELD_COUNT, TAP_RADIUS_PX } from "./settings";
import type { StateStore } from "./state";

export interface SystemViewOptions {
  seed: Seed;
  host: HTMLElement; // the canvas
  hud: Hud;
  state: StateStore;
  onBack: () => void;
}

interface PlanetEntry {
  planet: Planet;
  dock: Dock;
  group: THREE.Group;
  radius: number;
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

/** A planet is a low-poly ball. Its patches are colored once (two colors + 4 flat brightness steps), no lights needed. */
export function makePlanetMesh(planet: Planet, radius: number, toStar: THREE.Vector3): THREE.Mesh {
  const geometry = new THREE.IcosahedronGeometry(radius, 1); // not indexed: every triangle has its own 3 corners
  const position = geometry.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  const main = new THREE.Color(hexToNumber(planet.colors.primary));
  const second = new THREE.Color(hexToNumber(planet.colors.secondary));
  const mixed = new THREE.Color();
  const n = new THREE.Vector3();
  for (let face = 0; face + 2 < position.count; face += 3) {
    n.set(0, 0, 0);
    for (let k = 0; k < 3; k++) n.add(new THREE.Vector3(position.getX(face + k), position.getY(face + k), position.getZ(face + k)));
    n.normalize();
    const t = planetColorMix(planet.type, n.x, n.y, n.z);
    mixed.copy(main).lerp(second, t);
    const shade = faceShade(n.dot(toStar));
    for (let k = 0; k < 3; k++) {
      colors[(face + k) * 3] = mixed.r * shade;
      colors[(face + k) * 3 + 1] = mixed.g * shade;
      colors[(face + k) * 3 + 2] = mixed.b * shade;
    }
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true }));
}

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
  readonly camera = new THREE.PerspectiveCamera(50, RENDER_WIDTH / RENDER_HEIGHT, 0.5, 700);

  private view: OrbitView;
  private content = new THREE.Group();
  private entries: PlanetEntry[] = [];
  private selectionMarker: THREE.LineSegments;
  private selected = -1;
  private systemName = "";
  private starLabel = "";
  private temp = new THREE.Vector3();

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

    this.view = new OrbitView(this.camera, opts.host, 8, 90, 40);
    this.view.onTap = (x, y) => this.handleTap(x, y);
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

    let outermost = 6;
    for (const planet of getPlanetsOfSystem(seed, system.id)) {
      const dock = generateDock(seed, planet);
      const radius = planetDisplayRadius(planet.type, planet.radius);
      const orbit = orbitDisplayRadius(planet.index, planet.orbitRadius);
      outermost = Math.max(outermost, orbit);

      // Orbit line.
      const ring: THREE.Vector3[] = [];
      for (let i = 0; i < 64; i++) {
        const p = planetOrbitPosition(orbit, i / 64);
        ring.push(new THREE.Vector3(p.x, 0, p.z));
      }
      this.content.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ring), new THREE.LineBasicMaterial({ color: 0x2a3170 })));

      // Planet.
      const at = planetOrbitPosition(orbit, planet.orbitPhase);
      const group = new THREE.Group();
      group.position.set(at.x, 0, at.z);
      const outward = new THREE.Vector3(at.x, 0, at.z).normalize();
      const toStar = outward.clone().negate();
      group.add(makePlanetMesh(planet, radius, toStar));

      let station: PlanetEntry["station"] = null;
      if (dock.kind === "OUTPOST") {
        group.add(makeOutpost(planet, radius, outward));
      } else {
        const object = makeStation();
        const orbitAroundPlanet = radius * 1.7 + 0.9;
        group.add(object);
        station = { object, orbit: orbitAroundPlanet, angle: planet.index * 1.7 };
        object.position.set(Math.cos(station.angle) * orbitAroundPlanet, Math.sin(station.angle) * orbitAroundPlanet * 0.3, Math.sin(station.angle) * orbitAroundPlanet);
      }
      this.content.add(group);
      this.entries.push({ planet, dock, group, radius, station });
    }

    this.view.maxDist = clamp(outermost * 3, 30, 120);
    this.view.dist = clamp(outermost * 1.7 + 8, 22, this.view.maxDist);
    this.view.yaw = 0.7;
    this.view.pitch = 0.6;
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
    this.view.apply();
    for (const entry of this.entries) {
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

  private handleTap(clientX: number, clientY: number): void {
    const rect = this.opts.host.getBoundingClientRect();
    this.camera.updateMatrixWorld();
    const points: ScreenPoint[] = this.entries.map((e) => {
      this.temp.copy(e.group.position).project(this.camera);
      if (this.temp.z > 1) return { x: Infinity, y: Infinity };
      return { x: ((this.temp.x + 1) / 2) * rect.width, y: ((1 - this.temp.y) / 2) * rect.height };
    });
    this.selected = nearestScreenPoint(points, clientX - rect.left, clientY - rect.top, TAP_RADIUS_PX * 1.4);
    const chosen = this.entries[this.selected];
    this.selectionMarker.visible = chosen !== undefined;
    this.opts.state.set({ selectedPlanetId: chosen ? chosen.planet.id : null });
    this.refreshHud();
  }

  private refreshHud(): void {
    const { hud, onBack } = this.opts;
    const chosen = this.entries[this.selected];
    if (chosen) {
      const { planet, dock } = chosen;
      hud.setLabel(`${planet.name} - ${planetTypeLabel(planet.type)}\n${dockKindLabel(dock.kind)}: ${dock.name}`);
    } else {
      hud.setLabel("Tap a planet to see its name and dock.\nDrag to turn the view, scroll or pinch to zoom.");
    }
    hud.setButtons([{ text: "Back to map", onClick: onBack }]);
  }
}
