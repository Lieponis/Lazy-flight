// SCREEN 3: the flight. Launch from the origin dock, warp tunnel, approach to the destination dock.
// What you see is decided ONLY by the real travel times (see flightplan.ts), so opening the page or returning to the tab
// in the middle of a flight shows the right phase straight away.
//
// The ship never moves: it sits at the middle of the scene pointing forward (-Z). The docks and the tunnel move past it.
// The ship is Agent 8's design for the ship the player owns. The docks are Agent 8's outpost and station designs,
// placed so that the dock's parking spot is exactly where the ship is (so the launch starts, and the approach ends, in the dock).

import * as THREE from "three";
import { generateDock, getPlanet, hashString, parseDockId, type Seed } from "../universe";
import { RENDER_HEIGHT, RENDER_WIDTH } from "../settings";
import { COMPUTER_LINES } from "./flightlines";
import {
  computerLineIndex,
  flashAmount,
  formatCountdown,
  planFlight,
  realTimes,
  type FlightInfo,
  type FlightPhase,
  type FlightPlan,
  type PhaseSettings,
} from "./flightplan";
import { buildCockpit } from "./cockpit";
import { starfieldPositions } from "./helpers";
import type { Hud } from "./hud";
import type { Screen } from "./screen";
import type { AssetModel } from "./assets";
import {
  FALLBACK_SHIP_ID,
  approachCameraBlend,
  approachOffset,
  flameLength,
  launchCameraBlend,
  outpostExitPose,
  lerp3,
  orbitPosition,
  stationExitPose,
  stationExitTransform,
  stationPlanetCentre,
  resolveShipId,
  rotateY,
  shakeAmount,
  shakeOffset,
  type Vec3,
} from "./integration";
import { buildDockModel, buildShipModel, parkAtOrigin } from "./models3d";
import {
  DOCKED_GROUND_DETAIL,
  DOCKED_GROUND_RADIUS,
  FLIGHT_STATION_PLANET_ALTITUDE,
  OUTPOST_EXIT,
  DOCKED_STATION_PLANET_DETAIL,
  DOCKED_STATION_PLANET_RADIUS,
  FLIGHT_APPROACH_FROM_OUTPOST,
  FLIGHT_APPROACH_FROM_STATION,
  FLIGHT_APPROACH_SECONDS,
  FLIGHT_BAY_CAMERA,
  FLIGHT_DOCKED_HOLD_SECONDS,
  FLIGHT_LAUNCH_SECONDS,
  FLIGHT_LINE_SECONDS,
  FLIGHT_MIN_WARP_SECONDS,
  FLIGHT_ORBIT_HEIGHT_DOCK,
  FLIGHT_ORBIT_HEIGHT_WARP,
  FLIGHT_ORBIT_RADIUS,
  FLIGHT_SHAKE_START,
  FLIGHT_SHAKE_STRENGTH,
  STARFIELD_COUNT,
  STATION_EXIT,
} from "./settings";
import { disposeAll, makePlanetMesh } from "./systemview";
import { buildTunnel } from "./tunnel";
import "./flight.css";

const PHASES: PhaseSettings = {
  launchSeconds: FLIGHT_LAUNCH_SECONDS,
  approachSeconds: FLIGHT_APPROACH_SECONDS,
  minWarpSeconds: FLIGHT_MIN_WARP_SECONDS,
};

const WORLD_LIGHT = new THREE.Vector3(0.3, 0.85, -0.4).normalize();
const STATION_LIGHT = new THREE.Vector3(0.45, 0.5, 0.75).normalize(); // lights the planet next to a station
const ORBIT_START_ANGLE = 2.0; // the orbit camera starts in front-right of the ship, so it is never behind a station wall while leaving

const PHASE_NAMES: Record<FlightPhase, string> = {
  LAUNCH: "Launching",
  WARP: "In warp",
  APPROACH: "Approaching",
  DONE: "Docking",
};

type ViewMode = "orbit" | "cockpit";

interface Body {
  /** The dock model with its parking spot at the group's origin, plus the planet surface or planet. Moves; the ship does not. */
  group: THREE.Group;
  model: AssetModel;
  isStation: boolean;
  /** Stations only: where the camera sits inside the bay, relative to the ship. */
  bayCamera: Vec3 | null;
  /** Stations you leave: how far the ship has flown out so far. */
  slide: number;
}

export interface FlightScreenOptions {
  seed: Seed;
  host: HTMLElement; // the canvas (not used for input: you only watch)
  hud: Hud;
  parent: HTMLElement;
}

export class FlightScreen implements Screen {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, RENDER_WIDTH / RENDER_HEIGHT, 0.05, 40000);

  private ship: AssetModel = buildShipModel(FALLBACK_SHIP_ID);
  private shipId = FALLBACK_SHIP_ID;
  private cockpit = buildCockpit();
  private tunnel = buildTunnel();
  private origin: Body | null = null;
  private dest: Body | null = null;
  private info: FlightInfo | null = null;
  private mode: ViewMode = "orbit";
  private clockT = 0;
  private lastFrameMs = 0;
  private lastPlan: FlightPlan | null = null;
  private finishing: { from: number; t: number; onDone: () => void } | null = null;
  private hudTimer = 0;
  private lastAspect = 0;
  private lastFov = 0;

  private flash = document.createElement("div");
  private hudRoot = document.createElement("div");
  private title = document.createElement("div");
  private barFill = document.createElement("div");
  private text = document.createElement("div");
  private modeButton = document.createElement("button");

  constructor(private opts: FlightScreenOptions) {
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.BufferAttribute(starfieldPositions(STARFIELD_COUNT, 450), 3));
    this.scene.add(new THREE.Points(bg, new THREE.PointsMaterial({ color: 0x8890c8, size: 1, sizeAttenuation: false })));
    this.scene.add(this.ship.group, this.tunnel.group, this.camera);
    this.camera.add(this.cockpit.group);

    this.flash.className = "flight-flash";
    this.hudRoot.className = "flight-hud";
    this.title.className = "fh-title";
    const bottom = document.createElement("div");
    bottom.className = "fh-bottom";
    const bar = document.createElement("div");
    bar.className = "fh-bar";
    this.barFill.className = "fh-bar-fill";
    bar.appendChild(this.barFill);
    const row = document.createElement("div");
    row.className = "fh-row";
    this.text.className = "fh-text";
    this.modeButton.type = "button";
    this.modeButton.className = "fh-button";
    this.modeButton.addEventListener("click", () => this.toggleMode());
    row.append(this.text, this.modeButton);
    bottom.append(bar, row);
    this.hudRoot.append(this.title, bottom);
    opts.parent.append(this.flash, this.hudRoot);
    this.updateModeButton();
  }

  // ------------------------------------------------------------ starting and ending

  /** Which ship model flies. Unknown ids give the Cargo Hauler. Swaps the model at once. */
  setShip(shipId: string): void {
    const id = resolveShipId(shipId);
    if (id === this.shipId) return;
    this.shipId = id;
    const visible = this.ship.group.visible;
    this.scene.remove(this.ship.group);
    disposeAll(this.ship.group);
    this.ship = buildShipModel(id);
    this.ship.group.visible = visible;
    this.scene.add(this.ship.group);
  }

  /** Gets a new flight ready. Call before enter(). */
  begin(info: FlightInfo): void {
    this.clearBodies();
    this.info = info;
    this.finishing = null;
    this.lastPlan = null;
    this.clockT = 0;
    this.hudTimer = 0;
    this.lastFrameMs = performance.now();
    this.origin = this.makeBody(info.originDockId, false);
    this.dest = this.makeBody(info.destinationDockId, true);
    if (this.origin) this.scene.add(this.origin.group);
    if (this.dest) this.scene.add(this.dest.group);
  }

  /** The dock the flight is going to (the app parks the ship there afterwards). */
  destinationDockId(): string | null {
    return this.info ? this.info.destinationDockId : null;
  }

  /** The system the flight is going to. */
  destinationSystemId(): string | null {
    return this.info ? (parseDockId(this.info.destinationDockId)?.systemId ?? null) : null;
  }

  /**
   * The game says the job is over. Finishes the approach (a moment), then calls onDone.
   * If the tab was hidden or the flight was not in its approach, onDone is called at once (no animation).
   */
  finish(onDone: () => void): void {
    const hidden = document.hidden || performance.now() - this.lastFrameMs > 1000;
    const plan = this.lastPlan;
    const leave = (): void => {
      onDone();
      this.clearBodies(); // the docks of this flight are not needed any more: free the memory
    };
    if (hidden || !plan || (plan.phase !== "APPROACH" && plan.phase !== "DONE")) {
      leave();
      return;
    }
    this.finishing = { from: plan.phase === "DONE" ? 1 : plan.progress, t: 0, onDone: leave };
  }

  enter(): void {
    this.opts.hud.setVisible(false);
    this.flash.style.display = "block";
    this.hudRoot.style.display = "block";
    this.hudTimer = 0;
  }

  exit(): void {
    this.flash.style.display = "none";
    this.flash.style.opacity = "0";
    this.hudRoot.style.display = "none";
    this.opts.hud.setVisible(true);
  }

  // ------------------------------------------------------------ the picture

  update(seconds: number): void {
    if (!this.info) return;
    this.clockT += seconds;
    this.lastFrameMs = performance.now();

    let plan: FlightPlan;
    if (this.finishing) {
      const f = this.finishing;
      f.t += seconds;
      const length = 0.8 * (1 - f.from) + 0.01;
      const progress = Math.min(1, f.from + (1 - f.from) * (f.t / length));
      plan = { phase: "APPROACH", progress, phaseSeconds: FLIGHT_APPROACH_SECONDS, elapsedSeconds: 0, totalSeconds: 0 };
      const last = this.lastPlan;
      if (last) {
        plan.elapsedSeconds = last.totalSeconds;
        plan.totalSeconds = last.totalSeconds;
      }
      if (f.t >= length + FLIGHT_DOCKED_HOLD_SECONDS) {
        const done = f.onDone;
        this.finishing = null;
        this.applyPlan(plan);
        done();
        return;
      }
    } else {
      const progress = this.info.getProgress();
      if (progress) {
        const real = realTimes(progress, this.info.speed);
        plan = planFlight(progress.fraction, real.remainingRealMs, real.totalRealMs, PHASES);
      } else {
        const last = this.lastPlan;
        plan = { phase: "DONE", progress: 1, phaseSeconds: 0, elapsedSeconds: last?.totalSeconds ?? 0, totalSeconds: last?.totalSeconds ?? 0 };
      }
      this.lastPlan = plan;
    }
    this.applyPlan(plan);
  }

  private applyPlan(plan: FlightPlan): void {
    const phase = plan.phase;
    const p = plan.progress;

    // Which things are visible in this phase.
    if (this.origin) this.origin.group.visible = phase === "LAUNCH";
    if (this.dest) this.dest.group.visible = phase === "APPROACH" || phase === "DONE";
    this.tunnel.group.visible = phase === "WARP";

    // The docks slide past the ship. The ship's parking spot and the dock's parking spot are the same point at the two ends.
    if (phase === "LAUNCH" && this.origin) {
      // Station: straight out of the slot, then round the planet. Outpost: lift off, tilt, angled line, then curve into orbit.
      const pose = this.origin.isStation
        ? stationExitPose(p, DOCKED_STATION_PLANET_RADIUS + FLIGHT_STATION_PLANET_ALTITUDE, STATION_EXIT)
        : outpostExitPose(p, OUTPOST_EXIT);
      const t = stationExitTransform(pose);
      this.origin.group.rotation.x = t.rotX;
      this.origin.group.position.set(t.position.x, t.position.y, t.position.z);
      this.origin.slide = pose.slide;
    } else if ((phase === "APPROACH" || phase === "DONE") && this.dest) {
      const o = approachOffset(phase === "DONE" ? 1 : p, this.dest.isStation ? FLIGHT_APPROACH_FROM_STATION : FLIGHT_APPROACH_FROM_OUTPOST);
      this.dest.group.position.set(o.x, o.y, o.z);
    }
    if (phase === "WARP") this.tunnel.update(this.clockT);

    // Only what is on screen is updated: blinking lights and the spinning ring.
    this.ship.update(this.clockT);
    if (phase === "LAUNCH") this.origin?.model.update(this.clockT);
    else if (phase === "APPROACH" || phase === "DONE") this.dest?.model.update(this.clockT);

    // Engine flames (the design's own flame parts): short at the dock, 1 flying, 3 in warp.
    const flame = flameLength(phase, p, this.clockT);
    for (const f of this.ship.animation.flames) f.scale.z = flame;
    this.ship.group.position.y = 0.05 + Math.sin(this.clockT * 1.3) * 0.05;

    this.placeCamera(phase, p);
    this.flash.style.opacity = String(flashAmount(plan));
    this.updateHud(plan);
  }

  private placeCamera(phase: FlightPhase, p: number): void {
    const camera = this.camera;
    if (camera.aspect !== this.lastAspect || camera.fov !== this.lastFov) {
      this.lastAspect = camera.aspect;
      this.lastFov = camera.fov;
      this.cockpit.layout(camera.aspect, camera.fov);
    }
    const shipY = this.ship.group.position.y;
    if (this.mode === "orbit") {
      this.ship.group.visible = true;
      this.cockpit.group.visible = false;
      const height = (phase === "WARP" ? FLIGHT_ORBIT_HEIGHT_WARP : FLIGHT_ORBIT_HEIGHT_DOCK) + Math.sin(this.clockT * 0.4) * 0.6;
      let rel = orbitPosition(ORBIT_START_ANGLE + this.clockT * 0.35, FLIGHT_ORBIT_RADIUS, height);
      // Leaving or entering a station: the camera stays inside the bay while the walls are around the ship.
      const station = phase === "LAUNCH" ? this.origin : phase === "APPROACH" || phase === "DONE" ? this.dest : null;
      if (station && station.bayCamera) {
        const bay = rotateY(station.bayCamera, Math.sin(this.clockT * 0.35) * 0.14);
        if (phase === "LAUNCH") {
          rel = lerp3(bay, rel, launchCameraBlend(station.slide));
        } else rel = lerp3(rel, bay, approachCameraBlend(-station.group.position.z));
      }
      camera.position.set(rel.x, rel.y + shipY, rel.z);
      camera.lookAt(0, shipY + 0.8, 0);
    } else {
      this.ship.group.visible = false;
      this.cockpit.group.visible = true;
      // The camera sits at the design's eye spot and looks forward. A bit downwards while leaving a dock (to see it fall away) and while approaching one.
      const pitch = phase === "LAUNCH" ? -0.25 + 0.19 * p : phase === "WARP" ? -0.06 : -0.1;
      const eye = this.ship.anchors.eye?.pos;
      camera.position.set(eye?.x ?? 0, (eye?.y ?? 0.45) + shipY, eye?.z ?? -0.4);
      camera.rotation.set(pitch, 0, 0);
    }
    // A light shake just before the jump.
    const shake = shakeAmount(phase, p, FLIGHT_SHAKE_START);
    if (shake > 0) {
      const o = shakeOffset(this.clockT, shake * FLIGHT_SHAKE_STRENGTH);
      camera.position.x += o.x;
      camera.position.y += o.y;
      camera.position.z += o.z;
      if (this.mode === "cockpit") camera.rotation.z += o.x * 0.05;
    }
    camera.updateMatrixWorld();
  }

  // ------------------------------------------------------------ the text on top

  private updateHud(plan: FlightPlan): void {
    const info = this.info;
    if (!info) return;
    this.hudTimer -= 1;
    const fraction = plan.totalSeconds > 0 ? Math.min(1, plan.elapsedSeconds / plan.totalSeconds) : 1;
    this.barFill.style.width = `${(fraction * 100).toFixed(1)}%`;
    if (this.hudTimer > 0) return;
    this.hudTimer = 15; // refresh the words about four times a second at 60 frames per second
    const remainingMs = Math.max(0, plan.totalSeconds - plan.elapsedSeconds) * 1000;
    const clockTime = new Date(Date.now() + remainingMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const line =
      COMPUTER_LINES[computerLineIndex(plan.elapsedSeconds, COMPUTER_LINES.length, hashString(info.destinationDockId), FLIGHT_LINE_SECONDS)] ?? "";
    this.title.textContent = `FLIGHT - ${PHASE_NAMES[plan.phase]}`;
    const arrives = plan.phase === "DONE" ? "Arrived!" : `Arrives in ${formatCountdown(remainingMs)}  (at ${clockTime})`;
    this.text.textContent = `To: ${info.destinationName}\n${arrives}\n> ${line}`;
  }

  private toggleMode(): void {
    this.mode = this.mode === "orbit" ? "cockpit" : "orbit";
    this.updateModeButton();
  }

  private updateModeButton(): void {
    this.modeButton.textContent = this.mode === "orbit" ? "Cockpit view" : "Orbit view";
  }

  // ------------------------------------------------------------ the planets at each end

  /**
   * One end of the trip: the dock design picked for this dock, with its parking spot at the group's origin,
   * plus the planet under it (outposts) or beside it (stations you leave).
   * `arriving` = this is the destination: a station is turned round so its slot faces the incoming ship.
   */
  private makeBody(dockId: string, arriving: boolean): Body | null {
    const planet = getPlanet(this.opts.seed, dockId);
    if (!planet) return null;
    const dock = generateDock(this.opts.seed, planet);
    const built = buildDockModel(dock.kind, dockId, planet);
    parkAtOrigin(built);

    const group = new THREE.Group();
    group.add(built.model.group);
    const isStation = dock.kind === "STATION";
    let bayCamera: Vec3 | null = null;
    if (!isStation) {
      const ground = makePlanetMesh(planet, DOCKED_GROUND_RADIUS, WORLD_LIGHT, DOCKED_GROUND_DETAIL);
      ground.position.y = -DOCKED_GROUND_RADIUS - built.parking.y - 0.12;
      group.add(ground);
    } else {
      if (!arriving) {
        // The planet lies below the station, so the slot points along its surface.
        const world = makePlanetMesh(planet, DOCKED_STATION_PLANET_RADIUS, STATION_LIGHT, DOCKED_STATION_PLANET_DETAIL);
        const c = stationPlanetCentre(DOCKED_STATION_PLANET_RADIUS, FLIGHT_STATION_PLANET_ALTITUDE, STATION_EXIT.straight);
        world.position.set(c.x, c.y, c.z);
        group.add(world);
      }
      const turn = arriving ? Math.PI : 0;
      group.rotation.y = turn;
      bayCamera = rotateY(FLIGHT_BAY_CAMERA, turn);
    }
    group.visible = false;
    return { group, model: built.model, isStation, bayCamera, slide: 0 };
  }

  private clearBodies(): void {
    for (const body of [this.origin, this.dest]) {
      if (!body) continue;
      this.scene.remove(body.group);
      disposeAll(body.group);
    }
    this.origin = null;
    this.dest = null;
  }
}
