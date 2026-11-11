// SCREEN: the docked view (the home screen). Shows Agent 8's designs.
//   OUTPOST: the ship stands on the outpost's landing pad. The outpost design is picked from the dock id and takes the
//            planet's colour on its ground. Below it is the planet surface (a very big ball, so it looks almost flat).
//   STATION: the ship rests on the bay floor INSIDE the station. The camera is inside the bay too (it can never go
//            through a wall) and the planet is seen through the docking slot.
// Colors, dock kind and names come from the universe.

import * as THREE from "three";
import { getDock, getPlanet, getSystem, type Seed } from "../universe";
import { RENDER_HEIGHT, RENDER_WIDTH } from "../settings";
import {
  camPosition,
  degToRad,
  driftCam,
  pinchFactor,
  rotateCam,
  wheelFactor,
  zoomCam,
  type CamLimits,
  type OrbitCam,
} from "./dockedcam";
import { clamp, dockKindLabel, hexToNumber, planetTypeLabel, starfieldPositions } from "./helpers";
import type { Hud } from "./hud";
import {
  FALLBACK_SHIP_ID,
  bayBoxWorld,
  camFromPoint,
  clampToBox,
  fitDistance,
  fitFov,
  outpostFraming,
  relativeToParking,
  resolveShipId,
  stationPlanetCentre,
  type Box,
} from "./integration";
import { buildDockModel, buildShipModel, parkAtOrigin, shipRadius, type DockModel } from "./models3d";
import type { AssetModel } from "./assets";
import type { Screen } from "./screen";
import {
  DOCKED_ANGLE_MAX_DEG,
  DOCKED_ANGLE_MIN_DEG,
  DOCKED_BAY_ANGLE_MAX_DEG,
  DOCKED_BAY_ANGLE_MIN_DEG,
  DOCKED_BAY_MARGIN,
  DOCKED_BAY_SWAY,
  DOCKED_BAY_ZOOM_MIN,
  DOCKED_CAMERA_ANGLE_DEG,
  DOCKED_DRIFT_SPEED,
  DOCKED_GROUND_DETAIL,
  DOCKED_GROUND_RADIUS,
  DOCKED_STATION_PLANET_ALTITUDE,
  DOCKED_STATION_PLANET_DETAIL,
  DOCKED_STATION_PLANET_RADIUS,
  DOCKED_ZOOM_MAX,
  DOCKED_ZOOM_MIN,
  SHIP_FIT_MARGIN,
  SHIP_FIT_MAX_FOV,
  STARFIELD_COUNT,
  STATION_EXIT,
} from "./settings";
import { disposeAll, makePlanetMesh } from "./systemview";

const OUTPOST_LIMITS: CamLimits = {
  minDist: DOCKED_ZOOM_MIN,
  maxDist: DOCKED_ZOOM_MAX,
  minPitch: degToRad(DOCKED_ANGLE_MIN_DEG),
  maxPitch: degToRad(DOCKED_ANGLE_MAX_DEG),
};

const LIGHT = new THREE.Vector3(0.3, 0.85, -0.4).normalize(); // where the sun is, same as in the flight view
const STATION_LIGHT = new THREE.Vector3(0.45, 0.5, 0.75).normalize(); // lights the planet seen through the slot
const SHIP_LOOK_AT = new THREE.Vector3(0, 1, 0); // the camera in the bay looks at the middle of the ship

export interface DockedOptions {
  seed: Seed;
  host: HTMLElement; // the canvas (drag and zoom listen here)
  hud: Hud;
}

/** Drag to turn, scroll or pinch to zoom. Between touches the camera drifts slowly by itself (outposts only). */
class DockedControls {
  cam: OrbitCam = { yaw: -2.3, pitch: degToRad(DOCKED_CAMERA_ANGLE_DEG), dist: 14 };
  limits: CamLimits = OUTPOST_LIMITS;
  driftSpeed = DOCKED_DRIFT_SPEED;
  private pointers = new Map<number, { x: number; y: number }>();
  private lastPinch = 0;

  constructor(private el: HTMLElement) {}

  /** Starts a new view: where the camera is, how far it may go, and how fast it drifts. */
  reset(cam: OrbitCam, limits: CamLimits, driftSpeed: number): void {
    this.limits = limits;
    this.cam = { yaw: cam.yaw, pitch: clamp(cam.pitch, limits.minPitch, limits.maxPitch), dist: clamp(cam.dist, limits.minDist, limits.maxDist) };
    this.driftSpeed = driftSpeed;
  }

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
    if (this.pointers.size === 0 && this.driftSpeed !== 0) this.cam = driftCam(this.cam, seconds, this.driftSpeed);
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
      this.cam = rotateCam(this.cam, dx, dy, this.limits);
    } else if (this.pointers.size === 2) {
      const d = this.fingerDistance();
      this.cam = zoomCam(this.cam, pinchFactor(this.lastPinch, d), this.limits);
      this.lastPinch = d;
    }
  };

  private onUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.lastPinch = 0;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.cam = zoomCam(this.cam, wheelFactor(e.deltaY), this.limits);
  };
}

export class DockedScreen implements Screen {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, RENDER_WIDTH / RENDER_HEIGHT, 0.1, 900);

  private controls: DockedControls;
  private content = new THREE.Group();
  private target = new THREE.Vector3(0, 1.4, 0);
  private ship: AssetModel | null = null;
  private dock: DockModel | null = null;
  private bay: Box | null = null; // set only at stations: the camera is kept inside this box
  private dockId: string | null = null;
  private shipId = FALLBACK_SHIP_ID;
  private livery: string | undefined = undefined; // paint job id; undefined = standard
  private clockT = 0;
  private titleText = "";
  private labelText = "";
  private tmp = new THREE.Vector3();

  constructor(private opts: DockedOptions) {
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.BufferAttribute(starfieldPositions(STARFIELD_COUNT, 450), 3));
    this.scene.add(new THREE.Points(bg, new THREE.PointsMaterial({ color: 0x8890c8, size: 1, sizeAttenuation: false })));
    this.scene.add(this.content);
    this.controls = new DockedControls(opts.host);
  }

  /** Which ship rests in the dock. Changing it swaps the model at once if a dock is showing. */
  setShip(shipId: string, livery?: string): void {
    const id = resolveShipId(shipId);
    if (id === this.shipId && livery === this.livery) return;
    this.shipId = id;
    this.livery = livery;
    if (this.dockId) this.placeShip();
  }

  /** Builds the scene for one dock. Call before enter(). Returns false if the dock does not exist. */
  open(dockId: string): boolean {
    const { seed } = this.opts;
    const dock = getDock(seed, dockId); // null for a planet without a dock
    const planet = dock ? getPlanet(seed, dockId) : null;
    if (!planet || !dock) return false;
    const system = getSystem(seed, planet.systemId);

    // Throw away the previous dock completely (no memory growth).
    disposeAll(this.content);
    this.content.clear();
    this.ship = null;
    this.bay = null;
    this.dockId = dockId;

    const model = buildDockModel(dock.kind, dockId, planet);
    parkAtOrigin(model); // the ship's spot is the middle of the scene
    this.dock = model;
    this.content.add(model.model.group);

    if (dock.kind === "OUTPOST") this.buildOutpostScene(planet, system?.star.color, system?.star.radius ?? 1, model);
    else this.buildStationScene(planet, model);
    this.placeShip();

    this.titleText = `DOCKED - ${system?.name ?? "?"}`;
    this.labelText = `${dockKindLabel(dock.kind)}: ${dock.name}\n${planet.name} - ${planetTypeLabel(planet.type)}`;
    return true;
  }

  private shipR = 1;
  private baseFov = 50; // the window's normal view; widened a little when the ship would not fit
  private appliedFov = -1;

  private placeShip(): void {
    if (this.ship) {
      this.content.remove(this.ship.group);
      disposeAll(this.ship.group);
    }
    const ship = buildShipModel(this.shipId, this.livery);
    for (const flame of ship.animation.flames) flame.scale.z = 0.15; // parked: short flames
    ship.group.position.set(0, 0, 0); // its parking point is the scene's middle
    this.content.add(ship.group);
    this.ship = ship;
    this.shipR = shipRadius(ship);
  }

  private buildOutpostScene(
    planet: NonNullable<ReturnType<typeof getPlanet>>,
    starColor: string | undefined,
    starRadius: number,
    model: DockModel,
  ): void {
    // The sun, far away, in the direction the light comes from.
    if (starColor) {
      const sun = new THREE.Mesh(new THREE.IcosahedronGeometry(6 + starRadius * 4, 1), new THREE.MeshBasicMaterial({ color: hexToNumber(starColor) }));
      sun.position.copy(LIGHT).multiplyScalar(500);
      this.content.add(sun);
    }
    // The ground: a very big ball whose top is just under the outpost's ground plate.
    const ground = makePlanetMesh(planet, DOCKED_GROUND_RADIUS, LIGHT, DOCKED_GROUND_DETAIL, { rings: false, clouds: false });
    ground.position.y = -DOCKED_GROUND_RADIUS - model.parking.y - 0.12;
    this.content.add(ground);

    // Frame the ship and the buildings together.
    const box = new THREE.Box3().setFromObject(model.model.group);
    const f = outpostFraming(box.min, box.max, DOCKED_ZOOM_MIN, DOCKED_ZOOM_MAX);
    this.target.set(f.target.x, f.target.y, f.target.z);
    this.controls.reset(
      { yaw: -2.3, pitch: degToRad(DOCKED_CAMERA_ANGLE_DEG), dist: f.dist },
      { ...OUTPOST_LIMITS, maxDist: f.maxDist },
      DOCKED_DRIFT_SPEED,
    );
  }

  private buildStationScene(planet: NonNullable<ReturnType<typeof getPlanet>>, model: DockModel): void {
    const anchors = model.model.anchors;
    const entrance = anchors.dockEntrance?.pos;
    const bayCam = anchors.bayCamera?.pos;
    if (!entrance || !bayCam) throw new Error(`${model.id} has no dockEntrance or bayCamera anchor`);
    this.bay = bayBoxWorld(entrance, model.parking);

    // The planet lies below the station, so the slot points along its surface (a tangent), like in orbit.
    const world = makePlanetMesh(planet, DOCKED_STATION_PLANET_RADIUS, STATION_LIGHT, DOCKED_STATION_PLANET_DETAIL, { rings: false, cloudLift: 0.012 }) // clouds about 2 units up, well under the station;
    const c = stationPlanetCentre(DOCKED_STATION_PLANET_RADIUS, DOCKED_STATION_PLANET_ALTITUDE, STATION_EXIT.straight);
    world.position.set(c.x, c.y, c.z);
    this.content.add(world);

    // The camera starts at the design's suggested spot in the back corner and may move around the ship, but only inside the bay.
    this.target.copy(SHIP_LOOK_AT);
    const start = camFromPoint(relativeToParking(bayCam, model.parking), this.target);
    const limits: CamLimits = {
      minDist: DOCKED_BAY_ZOOM_MIN,
      maxDist: Math.max(start.dist, DOCKED_BAY_ZOOM_MIN + 2) + 0.5,
      minPitch: degToRad(DOCKED_BAY_ANGLE_MIN_DEG),
      maxPitch: degToRad(DOCKED_BAY_ANGLE_MAX_DEG),
    };
    this.controls.reset(start, limits, 0);
  }

  enter(): void {
    this.controls.attach();
    this.opts.hud.setTitle(this.titleText);
    this.opts.hud.setLabel(this.labelText);
    this.opts.hud.setButtons([]); // JOBS and MAP live in src/ui (Agent 5)
  }

  exit(): void {
    this.controls.detach();
  }

  update(seconds: number): void {
    this.clockT += seconds;
    this.controls.update(seconds);
    this.ship?.update(this.clockT);
    this.dock?.model.update(this.clockT);

    // The whole ship must always be in the picture, on any window shape.
    const camera = this.camera;
    if (camera.fov !== this.appliedFov) this.baseFov = camera.fov; // the window changed the view
    const fit = fitDistance(this.shipR, this.baseFov, camera.aspect, SHIP_FIT_MARGIN);
    if (!this.bay && this.controls.cam.dist < fit) this.controls.cam = { ...this.controls.cam, dist: Math.min(fit, this.controls.limits.maxDist) }; // outside: step back
    let cam = this.controls.cam;
    if (this.bay) cam = { ...cam, yaw: cam.yaw + Math.sin(this.clockT * 0.35) * DOCKED_BAY_SWAY }; // a slow sway, so the bay feels alive
    const p = camPosition(cam, this.target);
    const spot = this.bay ? clampToBox(p, this.bay, DOCKED_BAY_MARGIN) : p;
    this.camera.position.set(spot.x, spot.y, spot.z);
    this.camera.lookAt(this.tmp.copy(this.target));
    // Inside a bay the camera cannot step back, so widen the view instead (never beyond the limit).
    const d = Math.hypot(spot.x - this.target.x, spot.y - this.target.y, spot.z - this.target.z);
    const fov = Math.min(SHIP_FIT_MAX_FOV, Math.max(this.baseFov, fitFov(this.shipR, Math.max(d, 0.1), camera.aspect, SHIP_FIT_MARGIN)));
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    this.appliedFov = camera.fov;
    this.camera.updateMatrixWorld();
  }
}
