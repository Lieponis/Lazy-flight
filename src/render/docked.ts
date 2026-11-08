// SCREEN: the docked view (the home screen). The camera is above the player's ship, which rests at its dock.
//   OUTPOST: the ship stands on a landing pad on the curved planet surface, next to the outpost building.
//   STATION: the ship is parked on a bay platform beside the station, with the planet big in the background.
// All shapes are built in code. Colors, dock kind and names come from the universe.

import * as THREE from "three";
import { generateDock, getPlanet, getSystem, type Seed } from "../universe";
import { RENDER_HEIGHT, RENDER_WIDTH } from "../settings";
import {
  camPosition,
  defaultDockedCam,
  degToRad,
  driftCam,
  pinchFactor,
  rotateCam,
  wheelFactor,
  zoomCam,
  type CamLimits,
  type OrbitCam,
} from "./dockedcam";
import { dockKindLabel, hexToNumber, planetTypeLabel, starfieldPositions } from "./helpers";
import type { Hud } from "./hud";
import type { Screen } from "./screen";
import {
  DOCKED_ANGLE_MAX_DEG,
  DOCKED_ANGLE_MIN_DEG,
  DOCKED_CAMERA_ANGLE_DEG,
  DOCKED_CAMERA_DISTANCE,
  DOCKED_DRIFT_SPEED,
  DOCKED_ZOOM_MAX,
  DOCKED_ZOOM_MIN,
  STARFIELD_COUNT,
} from "./settings";
import { buildCargoHauler, shadedGeometry } from "./ship";
import { disposeAll, makeOutpost, makePlanetMesh, makeStation } from "./systemview";

const LIMITS: CamLimits = {
  minDist: DOCKED_ZOOM_MIN,
  maxDist: DOCKED_ZOOM_MAX,
  minPitch: degToRad(DOCKED_ANGLE_MIN_DEG),
  maxPitch: degToRad(DOCKED_ANGLE_MAX_DEG),
};

const LIGHT = new THREE.Vector3(0.3, 0.85, -0.4).normalize(); // where the sun is, same as in the flight view
const OUTPOST_GROUND_RADIUS = 30; // small enough that you can see the planet curve away to the horizon
const STATION_PLANET_RADIUS = 70;

export interface DockedOptions {
  seed: Seed;
  host: HTMLElement; // the canvas (drag and zoom listen here)
  hud: Hud;
  /** The temporary "Map" button was pressed. Gets the id of the system the ship is in. */
  onMap: (systemId: string) => void;
}

/** Drag to turn, scroll or pinch to zoom. Between touches the camera drifts slowly by itself. */
class DockedControls {
  cam: OrbitCam = defaultDockedCam(DOCKED_CAMERA_ANGLE_DEG, DOCKED_CAMERA_DISTANCE, LIMITS);
  private pointers = new Map<number, { x: number; y: number }>();
  private lastPinch = 0;

  constructor(private el: HTMLElement) {}

  attach(): void {
    this.el.style.touchAction = "none";
    this.el.addEventListener("pointerdown", this.onDown);
    this.el.addEventListener("pointermove", this.onMove);
    this.el.addEventListener("pointerup", this.onUp);
    this.el.addEventListener("pointercancel", this.onUp);
    this.el.addEventListener("wheel", this.onWheel, { passive: false });
  }

  detach(): void {
    this.el.removeEventListener("pointerdown", this.onDown);
    this.el.removeEventListener("pointermove", this.onMove);
    this.el.removeEventListener("pointerup", this.onUp);
    this.el.removeEventListener("pointercancel", this.onUp);
    this.el.removeEventListener("wheel", this.onWheel);
    this.pointers.clear();
  }

  update(seconds: number): void {
    if (this.pointers.size === 0) this.cam = driftCam(this.cam, seconds, DOCKED_DRIFT_SPEED);
  }

  private fingerDistance(): number {
    const pts = [...this.pointers.values()];
    const a = pts[0];
    const b = pts[1];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private onDown = (e: PointerEvent): void => {
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      // not important
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) this.lastPinch = this.fingerDistance();
  };

  private onMove = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pointers.size === 1) {
      this.cam = rotateCam(this.cam, dx, dy, LIMITS);
    } else if (this.pointers.size === 2) {
      const d = this.fingerDistance();
      this.cam = zoomCam(this.cam, pinchFactor(this.lastPinch, d), LIMITS);
      this.lastPinch = d;
    }
  };

  private onUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.lastPinch = 0;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.cam = zoomCam(this.cam, wheelFactor(e.deltaY), LIMITS);
  };
}

function solid(geometry: THREE.BufferGeometry, hex: number): THREE.Mesh {
  return new THREE.Mesh(shadedGeometry(geometry, hex), new THREE.MeshBasicMaterial({ vertexColors: true }));
}

export class DockedScreen implements Screen {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, RENDER_WIDTH / RENDER_HEIGHT, 0.1, 900);

  private controls: DockedControls;
  private content = new THREE.Group();
  private target = new THREE.Vector3(0, 0.8, 0);
  private lights: { material: THREE.MeshBasicMaterial; offset: number; onHex: number }[] = [];
  private clockT = 0;
  private titleText = "";
  private labelText = "";
  private systemId = "";

  constructor(private opts: DockedOptions) {
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.BufferAttribute(starfieldPositions(STARFIELD_COUNT, 450), 3));
    this.scene.add(new THREE.Points(bg, new THREE.PointsMaterial({ color: 0x8890c8, size: 1, sizeAttenuation: false })));
    this.scene.add(this.content);
    this.controls = new DockedControls(opts.host);
  }

  /** Builds the scene for one dock. Call before enter(). Returns false if the dock does not exist. */
  open(dockId: string): boolean {
    const { seed } = this.opts;
    const planet = getPlanet(seed, dockId);
    if (!planet) return false;
    const dock = generateDock(seed, planet);
    const system = getSystem(seed, planet.systemId);

    disposeAll(this.content);
    this.content.clear();
    this.lights = [];
    this.systemId = planet.systemId;

    // The sun, far away, in the direction the light comes from.
    if (system) {
      const sun = new THREE.Mesh(
        new THREE.IcosahedronGeometry(6 + system.star.radius * 4, 1),
        new THREE.MeshBasicMaterial({ color: hexToNumber(system.star.color) }),
      );
      sun.position.copy(LIGHT).multiplyScalar(500);
      this.content.add(sun);
    }

    // The ship, resting.
    const ship = buildCargoHauler();
    for (const flame of ship.flames) flame.scale.z = 0.15;
    ship.group.position.set(0, 0.5, 0);
    this.content.add(ship.group);

    if (dock.kind === "OUTPOST") this.buildOutpost(planet, ship.group);
    else this.buildStation(planet);

    this.titleText = `DOCKED - ${system?.name ?? "?"}`;
    this.labelText = `${dockKindLabel(dock.kind)}: ${dock.name}\n${planet.name} - ${planetTypeLabel(planet.type)}`;
    return true;
  }

  private buildOutpost(planet: NonNullable<ReturnType<typeof getPlanet>>, shipGroup: THREE.Group): void {
    this.target.set(1.5, 0.8, 0);
    shipGroup.position.x = 0;

    // The ground: a small planet, so the surface curves away to a horizon. Its top point is at (0, 0, 0).
    const ground = makePlanetMesh(planet, OUTPOST_GROUND_RADIUS, LIGHT, 5);
    ground.position.y = -OUTPOST_GROUND_RADIUS;
    this.content.add(ground);

    // Landing pad: a flat octagon with a lighter inner octagon and four blinking corner lights.
    const padBase = new THREE.CylinderGeometry(3.6, 3.6, 0.5, 8);
    padBase.translate(0, -0.15, 0); // top at 0.1, sunk into the ground so the curve never shows a gap
    const pad = solid(padBase, 0x3a3f66);
    const padTop = new THREE.CylinderGeometry(2.6, 2.6, 0.5, 8);
    padTop.translate(0, -0.13, 0);
    this.content.add(pad, solid(padTop, 0x59608f));
    const accent = hexToNumber(planet.colors.accent);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const material = new THREE.MeshBasicMaterial({ color: accent });
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), material);
      light.position.set(Math.cos(a) * 3.1, 0.22, Math.sin(a) * 3.1);
      this.content.add(light);
      this.lights.push({ material, offset: i * 0.5, onHex: accent });
    }

    // The outpost building next to the pad, plus a mast and two crates.
    const building = makeOutpost(planet, 1.3, new THREE.Vector3(1, 0, 0));
    building.quaternion.identity();
    building.position.set(7, 0, -2);
    building.scale.setScalar(3.2);
    building.rotation.y = planet.orbitPhase * Math.PI * 2;
    this.content.add(building);
    const mast = solid(new THREE.BoxGeometry(0.14, 3.4, 0.14), 0x8d99c9);
    mast.position.set(9, 1.6, -3.6);
    const mastLight = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0xff5a3c }));
    mastLight.position.set(9, 3.5, -3.6);
    const crateA = solid(new THREE.BoxGeometry(0.9, 0.9, 0.9), 0xff8a3d);
    crateA.position.set(4.6, 0.4, 3.4);
    const crateB = solid(new THREE.BoxGeometry(0.7, 0.7, 0.7), 0x3dd6c6);
    crateB.position.set(5.6, 0.3, 4.2);
    this.content.add(mast, mastLight, crateA, crateB);
  }

  private buildStation(planet: NonNullable<ReturnType<typeof getPlanet>>): void {
    this.target.set(-3, 0.8, 0);

    // The planet, large and below. Seen from any side you look down onto it.
    const world = makePlanetMesh(planet, STATION_PLANET_RADIUS, LIGHT, 3);
    world.position.set(10, -STATION_PLANET_RADIUS - 22, -12);
    this.content.add(world);

    // Bay platform under the ship, with four corner lights.
    const platform = solid(new THREE.BoxGeometry(8, 0.4, 7), 0x4a4f78);
    platform.position.set(0, -0.1, 0);
    const stripe = solid(new THREE.BoxGeometry(5, 0.1, 4), 0x6b77b5);
    stripe.position.set(0, 0.14, 0);
    this.content.add(platform, stripe);
    const accent = hexToNumber(planet.colors.accent);
    [[-3.7, -3.2], [3.7, -3.2], [-3.7, 3.2], [3.7, 3.2]].forEach(([x, z], i) => {
      const material = new THREE.MeshBasicMaterial({ color: accent });
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), material);
      light.position.set(x ?? 0, 0.2, z ?? 0);
      this.content.add(light);
      this.lights.push({ material, offset: i * 0.5, onHex: accent });
    });

    // The station itself: body with solar wings, joined to the platform by a short corridor.
    const station = makeStation();
    station.scale.setScalar(3.5);
    station.position.set(-9.5, 0.6, -1);
    station.rotation.y = planet.orbitPhase * 0.6;
    const corridor = solid(new THREE.BoxGeometry(5, 0.9, 1.1), 0x6b77b5);
    corridor.position.set(-5.9, 0.1, -1);
    this.content.add(station, corridor);
  }

  enter(): void {
    this.controls.attach();
    this.opts.hud.setTitle(this.titleText);
    this.opts.hud.setLabel(this.labelText);
    this.opts.hud.setButtons([{ text: "Map", onClick: () => this.opts.onMap(this.systemId) }]);
  }

  exit(): void {
    this.controls.detach();
  }

  update(seconds: number): void {
    this.clockT += seconds;
    this.controls.update(seconds);
    const p = camPosition(this.controls.cam, this.target);
    this.camera.position.set(p.x, p.y, p.z);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
    // Pad lights blink in turn.
    for (const l of this.lights) {
      const on = (this.clockT * 1.2 + l.offset) % 2 < 1.2;
      l.material.color.setHex(on ? l.onHex : 0x3a3f66);
    }
  }
}
