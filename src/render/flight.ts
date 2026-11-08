// SCREEN 3: the flight. Launch from the origin dock, warp tunnel, approach to the destination dock.
// What you see is decided ONLY by the real travel times (see flightplan.ts), so opening the page or returning to the tab
// in the middle of a flight shows the right phase straight away.
//
// The ship never moves: it sits at the middle of the scene pointing forward (-Z). Planets and the tunnel move past it.

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
import { planetDisplayRadius, starfieldPositions } from "./helpers";
import type { Hud } from "./hud";
import type { Screen } from "./screen";
import {
  FLIGHT_APPROACH_SECONDS,
  FLIGHT_DOCKED_HOLD_SECONDS,
  FLIGHT_LAUNCH_SECONDS,
  FLIGHT_LINE_SECONDS,
  FLIGHT_MIN_WARP_SECONDS,
  STARFIELD_COUNT,
} from "./settings";
import { buildCargoHauler } from "./ship";
import { disposeAll, makeOutpost, makePlanetMesh, makeStation } from "./systemview";
import { buildTunnel } from "./tunnel";
import "./flight.css";

const PHASES: PhaseSettings = {
  launchSeconds: FLIGHT_LAUNCH_SECONDS,
  approachSeconds: FLIGHT_APPROACH_SECONDS,
  minWarpSeconds: FLIGHT_MIN_WARP_SECONDS,
};

const PLANET_SCALE = 7; // planets in the flight view are this much bigger than in the system view
const UP = new THREE.Vector3(0, 1, 0);
const WORLD_LIGHT = new THREE.Vector3(0.3, 0.85, -0.4).normalize();
const DOCK_AT_START = new THREE.Vector3(0, -1.4, 0); // the origin dock sits just under the ship
const DOCK_AT_END = new THREE.Vector3(0, -1.6, -7); // the ship stops a little in front of the destination dock

const PHASE_NAMES: Record<FlightPhase, string> = {
  LAUNCH: "Launching",
  WARP: "In warp",
  APPROACH: "Approaching",
  DONE: "Docking",
};

type ViewMode = "orbit" | "cockpit";

interface Body {
  group: THREE.Group;
  /** From the planet's center to its dock, in the flight view. */
  dockOffset: THREE.Vector3;
}

export interface FlightScreenOptions {
  seed: Seed;
  host: HTMLElement; // the canvas (not used for input: you only watch)
  hud: Hud;
  parent: HTMLElement;
}

export class FlightScreen implements Screen {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, RENDER_WIDTH / RENDER_HEIGHT, 0.05, 700);

  private ship = buildCargoHauler();
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

  /** Gets a new flight ready. Call before enter(). */
  begin(info: FlightInfo): void {
    this.clearBodies();
    this.info = info;
    this.finishing = null;
    this.lastPlan = null;
    this.clockT = 0;
    this.hudTimer = 0;
    this.lastFrameMs = performance.now();
    this.origin = this.makeBody(info.originDockId);
    this.dest = this.makeBody(info.destinationDockId);
    if (this.origin) this.scene.add(this.origin.group);
    if (this.dest) this.scene.add(this.dest.group);
  }

  /** The system the flight is going to (so the app can show it afterwards). */
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
    if (hidden || !plan || (plan.phase !== "APPROACH" && plan.phase !== "DONE")) {
      onDone();
      return;
    }
    this.finishing = { from: plan.phase === "DONE" ? 1 : plan.progress, t: 0, onDone };
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

    // Planets slide past the ship.
    if (phase === "LAUNCH" && this.origin) {
      const e = p * p; // speeds up
      this.origin.group.position.copy(DOCK_AT_START).sub(this.origin.dockOffset).add(new THREE.Vector3(0, -60 * e, 90 * e));
    } else if ((phase === "APPROACH" || phase === "DONE") && this.dest) {
      const e = 1 - Math.pow(1 - p, 3); // slows down
      this.dest.group.position.copy(DOCK_AT_END).sub(this.dest.dockOffset).add(new THREE.Vector3(0, -30 * (1 - e), -150 * (1 - e)));
    }
    if (phase === "WARP") this.tunnel.update(this.clockT);

    // Engine flames: short at the dock, long in warp.
    const flame = phase === "WARP" ? 2.6 + Math.sin(this.clockT * 20) * 0.3 : phase === "LAUNCH" ? 0.6 + 1.6 * p : 1.8 * (1 - p) + 0.3;
    for (const f of this.ship.flames) f.scale.z = flame;
    this.ship.group.position.y = Math.sin(this.clockT * 1.3) * 0.05;

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
    if (this.mode === "orbit") {
      this.ship.group.visible = true;
      this.cockpit.group.visible = false;
      const a = this.clockT * 0.35 + 0.8;
      camera.position.set(Math.cos(a) * 8, 2.2 + Math.sin(this.clockT * 0.4) * 0.6, Math.sin(a) * 8);
      camera.lookAt(0, 0, 0.5);
    } else {
      this.ship.group.visible = false;
      this.cockpit.group.visible = true;
      // Look a bit downwards while leaving a dock (to see the planet fall away) and while approaching one.
      const pitch = phase === "LAUNCH" ? -0.25 + 0.19 * p : phase === "WARP" ? -0.06 : -0.1;
      camera.position.set(0, 0.45, -0.4);
      camera.rotation.set(pitch, 0, 0);
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

  /** A big planet with its dock (outpost on the surface, or station above it), turned so the dock faces UP. */
  private makeBody(dockId: string): Body | null {
    const planet = getPlanet(this.opts.seed, dockId);
    if (!planet) return null;
    const dock = generateDock(this.opts.seed, planet);
    const radius = planetDisplayRadius(planet.type, planet.radius);

    const dockLocal = new THREE.Vector3();
    const dockObject = dock.kind === "OUTPOST" ? makeOutpost(planet, radius, new THREE.Vector3(1, 0, 0)) : makeStation();
    if (dock.kind === "OUTPOST") {
      dockLocal.copy(dockObject.position);
      dockObject.scale.setScalar(0.5);
    } else {
      dockLocal.set(0, radius * 1.18 + 0.35, 0);
      dockObject.position.copy(dockLocal);
      dockObject.scale.setScalar(0.35);
    }
    const dockDirection = dockLocal.clone().normalize();
    const turn = new THREE.Quaternion().setFromAxisAngle(UP, planet.orbitPhase * Math.PI * 2);
    const q = turn.multiply(new THREE.Quaternion().setFromUnitVectors(dockDirection, UP));
    const lightInPlanetSpace = WORLD_LIGHT.clone().applyQuaternion(q.clone().invert());

    const group = new THREE.Group();
    group.add(makePlanetMesh(planet, radius, lightInPlanetSpace), dockObject);
    group.scale.setScalar(PLANET_SCALE);
    group.quaternion.copy(q);
    group.visible = false;
    return { group, dockOffset: UP.clone().multiplyScalar(dockLocal.length() * PLANET_SCALE) };
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
