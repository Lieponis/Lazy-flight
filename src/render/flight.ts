// SCREEN 3: the flight. Launch from the origin dock, warp, approach to the destination dock.
// What you see is decided ONLY by the real travel times (see flightplan.ts), so opening the page or returning to the tab
// in the middle of a flight shows the right phase straight away.
//
// The ship never moves: it sits at the middle of the scene pointing forward (-Z). The docks and the warp move past it.
// The ship is Agent 8's design for the ship the player owns. The docks are Agent 8's outpost and station designs,
// placed so that the dock's parking spot is exactly where the ship is (so the launch starts, and the approach ends, in the dock).

import * as THREE from "three";
import { getDock, getPlanet, getSystem, hashString, parseDockId, type Planet, type Seed } from "../universe";
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
import { buildCockpitBase } from "./assets/cockpitBase";
import { CockpitScreens } from "./cockpitscreens";
import { fuelScreenData, infoScreenData, mapScreenData } from "./screendata";
import { COCKPIT_FOV, COCKPIT_LENS, CockpitLens } from "./assets/lens";
import { cockpitRoomVisible, dragLook, glide, isDoubleTap, isTap, ownShipVisible, pilotEye, renderPathFor, fovForMagnification, shakeShare, startFov, zoomMagnification, type Look, type ViewMode } from "./cockpitview";
import { pinchFactor, wheelFactor } from "./dockedcam";
import { hexToNumber, starfieldPositions } from "./helpers";
import { arrivePose, departPose, floatDrift, shipRoll, floatLayout, lengthOf, parseFloatStyle, ringNormalWorld, STAR_DIRECTION, STAR_DISTANCE, starDrawRadius, tiltForClearance, type FloatStyle } from "./floatmath";
import { chooseLook } from "./planetlook";
import type { Hud } from "./hud";
import type { Screen } from "./screen";
import type { AssetModel } from "./assets";
import {
  FALLBACK_SHIP_ID,
  arrivalShakeAmount,
  bayBoxWorld,
  chaseBlend,
  clampToBox,
  fitDistance,
  fitFov,
  approachOffset,
  flameLength,
  launchCameraBlend,
  outpostExitPose,
  lerp,
  lerp3,
  orbitPosition,
  stationEntryState,
  stationEntryTransform,
  stationExitPose,
  stationExitTransform,
  stationPlanetCentre,
  resolveShipId,
  rotateY,
  shakeAmount,
  shakeOffset,
  smoothstep,
  type Box,
  type Vec3,
} from "./integration";
import { buildDockModel, buildShipModel, parkAtOrigin, shipRadius } from "./models3d";
import {
  DOCKED_BAY_MARGIN,
  DOCKED_GROUND_DETAIL,
  DOCKED_GROUND_RADIUS,
  FLIGHT_STATION_PLANET_ALTITUDE,
  OUTPOST_EXIT,
  STATION_ENTRY,
  DOCKED_STATION_PLANET_DETAIL,
  DOCKED_STATION_PLANET_RADIUS,
  FLIGHT_APPROACH_FROM_OUTPOST,
  FLIGHT_APPROACH_SECONDS,
  FLIGHT_APPROACH_SECONDS_STATION,
  FLIGHT_ARRIVAL_SHAKE_SECONDS,
  FLIGHT_BAY_CAMERA,
  FLIGHT_CHASE_CAMERA,
  FLIGHT_DOCKED_HOLD_SECONDS,
  FLIGHT_LAUNCH_SECONDS,
  FLIGHT_LINE_SECONDS,
  FLIGHT_MIN_WARP_SECONDS,
  FLIGHT_ORBIT_HEIGHT_DOCK,
  FLIGHT_ORBIT_HEIGHT_WARP,
  FLIGHT_ORBIT_RADIUS,
  FLIGHT_SHAKE_START,
  FLIGHT_SHAKE_STRENGTH,
  COCKPIT_LOOK_PITCH_MAX_DEG,
  COCKPIT_LOOK_PITCH_MIN_DEG,
  COCKPIT_LOOK_YAW_MAX_DEG,
  COCKPIT_SHAKE_FACTOR,
  COCKPIT_DEFAULT_ZOOM_OUT,
  COCKPIT_FOV_CAP,
  COCKPIT_MESSAGE_SECONDS,
  COCKPIT_STATUS_SECONDS,
  COCKPIT_ZOOM_RANGE,
  SHIP_FIT_MARGIN,
  WARP_DEFAULT_STYLE,
  SHIP_FIT_MAX_FOV,
  STARFIELD_COUNT,
  STATION_EXIT,
  LOOK_FLAME_FLICKER,
  LOOK_FLASH_STEPS,
  FLOAT_DEFAULT_STYLE,
  FLOAT_SHIP_ORBIT_SPEED,
  FLOAT_PLANET_DETAIL,
} from "./settings";
import { disposeAll, makePlanetMesh } from "./systemview";
import { buildWarp } from "./warp";
import { parseWarpStyle, type WarpStyle } from "./warpmath";
import { flameFlicker, stepped } from "./lookmath";
import "./flight.css";

const BASE_PHASES: PhaseSettings = {
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

const LOOK_LIMITS = {
  yawMax: (COCKPIT_LOOK_YAW_MAX_DEG * Math.PI) / 180,
  pitchMin: (COCKPIT_LOOK_PITCH_MIN_DEG * Math.PI) / 180,
  pitchMax: (COCKPIT_LOOK_PITCH_MAX_DEG * Math.PI) / 180,
};

interface Body {
  /** The dock model with its parking spot at the group's origin, plus the planet surface or planet. Moves; the ship does not. */
  group: THREE.Group;
  /** The dock design. Null for a planet WITHOUT a dock (scenery): then `scenery` is set instead. */
  model: AssetModel | null;
  /** A planet without a dock: where it hangs when the ship floats there (relative to the ship) and its star (drawn far away, not moving with `group`). */
  scenery: {
    centre: { x: number; y: number; z: number };
    radius: number;
    sun: THREE.Mesh;
    /** The planet's turning axis (the rings' up-direction): the floating ship circles the planet around it. */
    axis: THREE.Vector3;
    turn: THREE.Group;
    baseQuat: THREE.Quaternion;
    sunStart: THREE.Vector3;
  } | null;
  isStation: boolean;
  /** Stations only: where the camera sits inside the bay, relative to the ship. */
  bayCamera: Vec3 | null;
  /** Stations you leave: how far the ship has flown out so far. */
  slide: number;
  /** Stations you arrive at: where the arrival is (set every frame). */
  entry: ReturnType<typeof stationEntryState> | null;
  /** Stations: the room inside the bay, with the ship's parking spot as the middle (the camera is kept off its walls). */
  bayBox: Box | null;
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
  private shipR = shipRadius(this.ship);
  private baseFov = 50; // the window's normal view; the picture may widen a little so the whole ship fits
  private appliedFov = -1;
  private shipId = FALLBACK_SHIP_ID;
  private livery: string | undefined = undefined; // paint job id; undefined = standard
  // Cockpit view: Agent 8's base cockpit (one for all ships for now), kept in a holder that is NOT a child of the camera
  // (so the room stays level while the view tilts and shakes). It is drawn through the lens (see render()).
  private cockpitModel = buildCockpitBase();
  private cockpitRig = new THREE.Group();
  private screens = new CockpitScreens(this.cockpitModel); // trip info on the cockpit's three screens
  private lens: CockpitLens | null = null;
  private look: Look = { yaw: 0, pitch: 0 }; // where the pilot has turned his head (drag); resets when a flight starts or the view changes
  private homing = false; // true while the view glides back to straight ahead (double tap)
  private zoom = 1; // how much the player has zoomed from the start view: 1 = start, 2 = twice as close (wheel or pinch)
  private pointers = new Map<number, { x: number; y: number }>();
  private lastPinch = 0;
  private moved = 0; // how far the finger or mouse travelled since it went down (a tap barely moves)
  private lastTapMs = 0;
  private warp = buildWarp(parseWarpStyle(window.location.search) ?? WARP_DEFAULT_STYLE); // the warp (stars, haze); ?warp=A|B|C picks the look
  private origin: Body | null = null;
  private dest: Body | null = null;
  private info: FlightInfo | null = null;
  private mode: ViewMode = "orbit";
  private clockT = 0;
  private lastFrameMs = 0;
  private lastPlan: FlightPlan | null = null;
  private finishing: { from: number; t: number; onDone: () => void } | null = null;
  private hudTimer = 0;
  private phases: PhaseSettings = BASE_PHASES; // the approach to a station takes longer than to an outpost
  private floating: { planetId: string; name: string } | null = null; // set while the ship floats at a planet without a dock
  private floatStyle: FloatStyle = parseFloatStyle(window.location.search) ?? FLOAT_DEFAULT_STYLE;

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
    this.screens.onFontLoaded = () => (this.hudTimer = 0); // redraw with the pixel font as soon as it is there
    this.cockpitRig.add(this.cockpitModel.group);
    this.cockpitRig.visible = false;
    this.scene.add(this.ship.group, this.warp.group, this.cockpitRig, this.camera);

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
  setShip(shipId: string, livery?: string): void {
    const id = resolveShipId(shipId);
    if (id === this.shipId && livery === this.livery) return;
    this.shipId = id;
    this.livery = livery;
    const visible = this.ship.group.visible;
    this.scene.remove(this.ship.group);
    disposeAll(this.ship.group);
    this.ship = buildShipModel(id, livery);
    this.shipR = shipRadius(this.ship);
    this.ship.group.visible = visible;
    this.scene.add(this.ship.group);
  }

  /** Gets a new flight ready. Call before enter(). */
  begin(info: FlightInfo): void {
    this.flightCounter++;
    this.carrySpin = this.floating && this.floating.planetId === info.originDockId ? (this.clockT - this.floatT0) * FLOAT_SHIP_ORBIT_SPEED : 0;
    this.clearBodies();
    this.resetLook();
    this.floating = null;
    this.free = false;
    this.info = info;
    this.finishing = null;
    this.lastPlan = null;
    this.clockT = 0;
    this.hudTimer = 0;
    this.lastFrameMs = performance.now();
    this.origin = this.makeBody(info.originDockId);
    this.dest = this.makeBody(info.destinationDockId);
    this.addBody(this.origin);
    this.addBody(this.dest);
    this.phases = { ...BASE_PHASES, approachSeconds: this.dest?.isStation ? FLIGHT_APPROACH_SECONDS_STATION : FLIGHT_APPROACH_SECONDS };
  }

  /** Shows the ship floating at a planet that has no dock (page opened while in space, or the preview). Call before enter(). */
  beginFloat(planetId: string): boolean {
    const planet = getPlanet(this.opts.seed, planetId);
    if (!planet) return false;
    this.flightCounter++;
    this.clearBodies();
    this.resetLook();
    this.finishing = null;
    this.lastPlan = null;
    this.clockT = 0;
    this.hudTimer = 0;
    this.lastFrameMs = performance.now();
    this.info = {
      originDockId: planetId,
      destinationDockId: planetId,
      destinationName: planet.name,
      speed: 1,
      getProgress: () => null,
    };
    this.floating = { planetId, name: planet.name };
    this.floatT0 = 0;
    this.free = false;
    this.dest = this.makeBody(planetId);
    this.addBody(this.dest);
    return true;
  }

  /** How many triangles the whole picture has now (for the float preview readout). */
  triangleCount(): number {
    let total = 0;
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !obj.visible) return;
      const g = mesh.geometry;
      total += g.index ? g.index.count / 3 : g.getAttribute("position").count / 3;
    });
    return Math.round(total);
  }

  /** True while the ship floats at a planet without a dock (the flight screen shows the calm scene). */
  isFloating(): boolean {
    return this.floating !== null;
  }

  floatingPlanetId(): string | null {
    return this.floating ? this.floating.planetId : null;
  }

  /** Another layout (A, B or C) for the floating scene and the arrivals/departures at planets without a dock. Rebuilds the scene if floating. */
  setFloatStyle(style: FloatStyle): void {
    this.floatStyle = style;
    if (this.floating) this.beginFloat(this.floating.planetId);
  }

  // Continuous camera: whenever the camera's wanted place jumps (a new phase, a new flight, another view), the old place is kept as an
  // offset that fades away over about a second, so the picture glides instead of cutting.
  private dt = 0.016;
  private camOff = new THREE.Vector3();
  private lookOff = new THREE.Vector3();
  private lastCamPos = new THREE.Vector3();
  private lastCamLook = new THREE.Vector3();
  private lastCamKey = "";
  private lastCamMs = 0;
  private flightCounter = 0; // changes with every begin(), so a new flight counts as a "jump" too
  private cockpitPitch: number | null = null; // the cockpit's tilt, eased between phases
  private carrySpin = 0; // the floating circling angle when a launch starts (so the planet does not jump)
  private rollNow = 0;
  private shipPitch = 0; // nose-up angle while leaving or arriving at a planet without a dock
  private floatT0 = 0; // clockT when the floating began (the circling starts from zero)

  private spinScenery(s: NonNullable<Body["scenery"]>, angle: number): void {
    const q = new THREE.Quaternion().setFromAxisAngle(s.axis, angle);
    s.turn.quaternion.copy(q).multiply(s.baseQuat);
    const c = new THREE.Vector3(s.centre.x, s.centre.y, s.centre.z);
    s.sun.position.copy(s.sunStart).sub(c).applyQuaternion(q).add(c);
  }

  private addBody(body: Body | null): void {
    if (!body) return;
    this.scene.add(body.group);
    if (body.scenery) this.scene.add(body.scenery.sun);
  }

  private removeBody(body: Body | null): void {
    if (!body) return;
    this.scene.remove(body.group);
    disposeAll(body.group);
    if (body.scenery) {
      this.scene.remove(body.scenery.sun);
      disposeAll(body.scenery.sun);
    }
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
      const arrivedAt = this.dest?.scenery ? getPlanet(this.opts.seed, info?.destinationDockId ?? "") : null;
      if (arrivedAt && this.dest) {
        // A planet without a dock: the ship stays here, floating. The planet that grew during the approach is kept as the scene.
        for (const body of [this.origin]) this.removeBody(body);
        this.origin = null;
        this.floating = { planetId: arrivedAt.id, name: arrivedAt.name };
        this.floatT0 = this.clockT;
        this.updateModeButton();
        this.dest.group.visible = true;
        onDone();
        return;
      }
      onDone();
      this.clearBodies(); // the docks of this flight are not needed any more: free the memory
    };
    const info = this.info;
    if (hidden || !plan || (plan.phase !== "APPROACH" && plan.phase !== "DONE")) {
      leave();
      return;
    }
    this.finishing = { from: plan.phase === "DONE" ? 1 : plan.progress, t: 0, onDone: leave };
  }

  enter(): void {
    const el = this.opts.host;
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointercancel", this.onUp);
    el.addEventListener("wheel", this.onWheel, { passive: false });
    this.updateModeButton();
    this.opts.hud.setVisible(false);
    this.flash.style.display = "block";
    this.hudRoot.style.display = "block";
    this.hudTimer = 0;
  }

  exit(): void {
    const el = this.opts.host;
    el.removeEventListener("pointerdown", this.onDown);
    el.removeEventListener("pointermove", this.onMove);
    el.removeEventListener("pointerup", this.onUp);
    el.removeEventListener("pointercancel", this.onUp);
    el.removeEventListener("wheel", this.onWheel);
    this.pointers.clear();
    this.flash.style.display = "none";
    this.flash.style.opacity = "0";
    this.hudRoot.style.display = "none";
    this.opts.hud.setVisible(true);
  }

  // ------------------------------------------------------------ the picture

  update(seconds: number): void {
    if (!this.info) return;
    this.clockT += seconds;
    this.dt = seconds;
    this.glideHome(seconds);
    this.lastFrameMs = performance.now();

    let plan: FlightPlan;
    if (this.floating) {
      plan = { phase: "DONE", progress: 1, phaseSeconds: 0, elapsedSeconds: this.clockT, totalSeconds: this.clockT };
      this.lastPlan = plan;
    } else if (this.finishing) {
      const f = this.finishing;
      f.t += seconds;
      const length = 0.8 * (1 - f.from) + 0.01;
      const progress = Math.min(1, f.from + (1 - f.from) * (f.t / length));
      plan = { phase: "APPROACH", progress, phaseSeconds: this.phases.approachSeconds, elapsedSeconds: 0, totalSeconds: 0 };
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
        plan = planFlight(progress.fraction, real.remainingRealMs, real.totalRealMs, this.phases);
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
    if (this.origin?.scenery) this.origin.scenery.sun.visible = this.origin.group.visible;
    if (this.dest?.scenery) this.dest.scenery.sun.visible = this.dest.group.visible;
    this.warp.group.visible = phase === "WARP";

    // The docks slide past the ship. The ship's parking spot and the dock's parking spot are the same point at the two ends.
    if (phase === "LAUNCH" && this.origin?.scenery) {
      // A planet without a dock: it slides away behind the ship, getting smaller.
      // The ship starts in its orbit, then pitches its nose up and curves away from the planet (Andy's schematic).
      const pose = departPose(this.origin.scenery.centre, p);
      this.origin.group.position.set(pose.centre.x, pose.centre.y, pose.centre.z);
      this.shipPitch = pose.pitch;
      this.spinScenery(this.origin.scenery, this.carrySpin); // keeps the circling angle it had
    } else if (phase === "LAUNCH" && this.origin && this.origin.model) {
      // Station: straight out of the slot, then round the planet. Outpost: lift off, tilt, angled line, then curve into orbit.
      const pose = this.origin.isStation
        ? stationExitPose(p, DOCKED_STATION_PLANET_RADIUS + FLIGHT_STATION_PLANET_ALTITUDE, STATION_EXIT)
        : outpostExitPose(p, OUTPOST_EXIT);
      const t = stationExitTransform(pose);
      this.origin.group.rotation.x = t.rotX;
      this.origin.group.position.set(t.position.x, t.position.y, t.position.z);
      this.origin.slide = pose.slide;
    } else if ((phase === "APPROACH" || phase === "DONE") && this.dest?.scenery) {
      // A planet without a dock: it grows out of the distance and settles into its floating pose, then drifts a little.
      const c = this.dest.scenery.centre;
      const q = phase === "DONE" ? 1 : p;
      // Arriving is the departure turned round: in from far away with the nose a little down, flattening out into the orbit.
      const pose = arrivePose(c, q);
      this.shipPitch = pose.pitch;
      const drift = this.floating ? floatDrift(this.clockT) : { x: 0, y: 0, z: 0 };
      this.dest.group.position.set(pose.centre.x + drift.x, pose.centre.y + drift.y, pose.centre.z + drift.z);
      // The ship circles the planet: seen from the ship, the planet turns about its axis and its star goes round with it (so the light stays right).
      this.spinScenery(this.dest.scenery, this.floating ? (this.clockT - this.floatT0) * FLOAT_SHIP_ORBIT_SPEED : 0);
    } else if ((phase === "APPROACH" || phase === "DONE") && this.dest) {
      const q = phase === "DONE" ? 1 : p;
      if (this.dest.isStation) {
        // The departure walked backwards: in nose-first along the planet's surface, then a half turn in the bay.
        const entry = stationEntryState(q, DOCKED_STATION_PLANET_RADIUS + FLIGHT_STATION_PLANET_ALTITUDE, STATION_EXIT, STATION_ENTRY);
        const t = stationEntryTransform(entry);
        this.dest.group.rotation.set(t.rotX, t.yaw, 0, "YXZ");
        this.dest.group.position.set(t.position.x, t.position.y, t.position.z);
        this.dest.entry = entry;
      } else {
        const o = approachOffset(q, FLIGHT_APPROACH_FROM_OUTPOST);
        this.dest.group.position.set(o.x, o.y, o.z);
      }
    }
    if (phase === "WARP") this.warp.update(this.clockT);

    // Only what is on screen is updated: blinking lights and the spinning ring.
    this.ship.update(this.clockT);
    if (this.mode === "cockpit") this.cockpitModel.update(this.clockT); // the ~90 lights flash
    if (phase === "LAUNCH") this.origin?.model?.update(this.clockT);
    else if (phase === "APPROACH" || phase === "DONE") this.dest?.model?.update(this.clockT);

    // Engine flames (the design's own flame parts): short at the dock, 1 flying, 3 in warp.
    // Floating: the ship rolls slowly from side to side while it circles the planet (its nose already points along the surface).
    this.rollNow += ((this.floating ? shipRoll(this.clockT - this.floatT0) : 0) - this.rollNow) * Math.min(1, this.dt * 2.5); // eased, so it never snaps
    this.ship.group.rotation.z = this.rollNow;
    this.ship.group.rotation.x = this.shipPitch;
    this.shipPitch = 0; // set again each frame by the scenery launch / arrival above
    const flame = flameLength(phase, p, this.clockT);
    const flicker = flameFlicker(this.clockT, LOOK_FLAME_FLICKER); // PS1 style: the flame changes length in chunky steps
    for (const f of this.ship.animation.flames) f.scale.z = flame * flicker;
    this.ship.group.position.y = 0.05 + Math.sin(this.clockT * 1.3) * 0.05;

    this.placeCamera(phase, p, plan.phaseSeconds);
    this.flash.style.opacity = String(stepped(flashAmount(plan), LOOK_FLASH_STEPS));
    this.updateHud(plan);
  }

  private placeCamera(phase: FlightPhase, p: number, phaseSeconds: number): void {
    const camera = this.camera;
    if (camera.fov !== this.appliedFov) this.baseFov = camera.fov; // the window changed the view (see index.ts resize)
    let fov = this.baseFov;
    const shipY = this.ship.group.position.y;
    if (this.mode === "orbit") {
      this.ship.group.visible = ownShipVisible(this.mode);
      this.cockpitRig.visible = cockpitRoomVisible(this.mode);
      // Just before the warp starts, the camera glides down to the warp camera height (it used to jump there when the warp began).
      // ...and glides back up after the warp, over the first part of the approach.
      const toWarp = phase === "LAUNCH" ? smoothstep((p - 0.45) / 0.55) : phase === "WARP" ? 1 : phase === "APPROACH" ? 1 - smoothstep(p / 0.4) : 0;
      const height = lerp(FLIGHT_ORBIT_HEIGHT_DOCK, FLIGHT_ORBIT_HEIGHT_WARP, toWarp) + Math.sin(this.clockT * 0.4) * 0.6;
      let rel = orbitPosition(ORBIT_START_ANGLE + this.clockT * (this.freeCam() ? 0 : 0.35) + (this.freeCam() ? this.fv.yaw : 0), FLIGHT_ORBIT_RADIUS, height);
      if (this.freeCam()) {
        // Player's view: tilt up/down and zoom (the slow orbit carries on from wherever they turned it).
        const horiz = Math.hypot(rel.x, rel.z);
        const lift = Math.atan2(rel.y - 0.8, horiz) + this.fv.pitch;
        const r = Math.max(this.shipR * 1.6, Math.hypot(horiz, rel.y - 0.8) * this.fv.zoom);
        const f = r / Math.max(1e-6, horiz);
        rel = { x: rel.x * Math.cos(lift) * f * (horiz > 0 ? 1 : 0), y: 0.8 + r * Math.sin(lift), z: rel.z * Math.cos(lift) * f };
      }
      if (phase === "LAUNCH" && this.origin?.bayCamera) {
        // Leaving a station: the camera starts inside the bay and swings out once the station is clear.
        const bay = rotateY(this.origin.bayCamera, Math.sin(this.clockT * 0.35) * 0.14);
        rel = lerp3(bay, rel, launchCameraBlend(this.origin.slide));
      } else if ((phase === "APPROACH" || phase === "DONE") && this.dest?.isStation && this.dest.entry) {
        // Arriving at a station: the camera follows the ship from behind, a little to the side and above. It eases in from the orbit
        // camera, and it turns with the ship when the ship turns round in the bay (kept off the walls).
        const entry = this.dest.entry;
        let chase: Vec3 = { x: FLIGHT_CHASE_CAMERA.x, y: FLIGHT_CHASE_CAMERA.y, z: FLIGHT_CHASE_CAMERA.z };
        if (this.dest.bayBox && entry.pose.slide < 1) {
          const inBay = rotateY(chase, -entry.yaw); // the same spot in the station's own frame
          if (inBay.z > this.dest.bayBox.min.z) chase = rotateY(clampToBox(inBay, this.dest.bayBox, DOCKED_BAY_MARGIN), entry.yaw);
        }
        rel = lerp3(rel, chase, phase === "DONE" ? 1 : chaseBlend(p, STATION_ENTRY.cameraBlend));
      }
      // Keep the whole ship in the picture, on any window shape: move the camera back if it can, widen the view if it cannot (inside a bay).
      let inBay = 0; // 1 = inside the bay, where the camera cannot move back
      if (phase === "LAUNCH" && this.origin?.bayCamera) inBay = 1 - launchCameraBlend(this.origin.slide);
      else if ((phase === "APPROACH" || phase === "DONE") && this.dest?.isStation && this.dest.entry) inBay = 1 - smoothstep((this.dest.entry.pose.slide - 4) / 8);
      const vy = rel.y - 0.8;
      const d0 = Math.hypot(rel.x, vy, rel.z);
      const d1 = this.floating ? d0 : d0 > 1e-6 ? lerp(Math.max(d0, fitDistance(this.shipR, this.baseFov, camera.aspect, SHIP_FIT_MARGIN)), d0, inBay) : d0;
      if (d0 > 1e-6) rel = { x: (rel.x * d1) / d0, y: 0.8 + (vy * d1) / d0, z: (rel.z * d1) / d0 };
      fov = Math.min(SHIP_FIT_MAX_FOV, Math.max(this.baseFov, fitFov(this.shipR, d1, camera.aspect, SHIP_FIT_MARGIN)));
      const pan = this.freeCam() ? this.fv.pan : null;
      const wantPos = new THREE.Vector3(rel.x + (pan?.x ?? 0), rel.y + shipY + (pan?.y ?? 0), rel.z + (pan?.z ?? 0));
      const wantLook = new THREE.Vector3(pan?.x ?? 0, shipY + 0.8 + (pan?.y ?? 0), pan?.z ?? 0);
      // Continuous view: if the wanted place jumped since last frame (new phase, new flight, other view), start from where the camera was.
      const key = `${phase}|${this.floating ? 1 : 0}|${this.freeCam() ? 1 : 0}|${this.flightCounter}`;
      if (key !== this.lastCamKey) {
        if (this.lastCamKey !== "" && performance.now() - this.lastCamMs < 300) {
          this.camOff.copy(this.lastCamPos).sub(wantPos);
          this.lookOff.copy(this.lastCamLook).sub(wantLook);
        } else {
          this.camOff.set(0, 0, 0);
          this.lookOff.set(0, 0, 0);
        }
        this.lastCamKey = key;
      }
      const fade = Math.exp(-this.dt / 0.7);
      this.camOff.multiplyScalar(fade);
      this.lookOff.multiplyScalar(fade);
      wantPos.add(this.camOff);
      wantLook.add(this.lookOff);
      this.lastCamPos.copy(wantPos);
      this.lastCamLook.copy(wantLook);
      this.lastCamMs = performance.now();
      camera.position.copy(wantPos);
      camera.lookAt(wantLook);
      camera.updateMatrixWorld();
    } else {
      this.ship.group.visible = ownShipVisible(this.mode); // your own ship is never drawn from inside
      this.cockpitRig.visible = cockpitRoomVisible(this.mode);
      // The camera sits at the design's eye spot and looks forward. A bit downwards while leaving a dock (to see it fall away) and while approaching one.
      const pitchWanted = phase === "LAUNCH" ? -0.25 + 0.19 * p : phase === "WARP" ? -0.06 : -0.1;
      // Eased between phases so the view never jumps.
      this.cockpitPitch = this.cockpitPitch === null ? pitchWanted : this.cockpitPitch + (pitchWanted - this.cockpitPitch) * Math.min(1, this.dt * 3);
      const pitch = this.cockpitPitch;
      this.lastCamMs = 0; // the outside camera has nothing to continue from after the cockpit
      const eye = pilotEye(this.ship.anchors.eye?.pos, shipY);
      camera.position.set(eye.x, eye.y, eye.z);
      this.cockpitRig.position.set(eye.x, eye.y, eye.z); // the room's eye spot is its origin; placed before the pitch and shake are added
      camera.rotation.set(pitch + this.look.pitch + this.ship.group.rotation.x, this.look.yaw, 0, "YXZ");
    }
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    this.appliedFov = camera.fov;

    // A light shake just before the jump.
    // ...and when the ship drops out of warp at a station.
    const arriving = phase === "APPROACH" && this.dest?.isStation === true;
    const shake = arriving ? arrivalShakeAmount(p * phaseSeconds, FLIGHT_ARRIVAL_SHAKE_SECONDS) : shakeAmount(phase, p, FLIGHT_SHAKE_START);
    if (shake > 0) {
      const o = shakeOffset(this.clockT, shake * FLIGHT_SHAKE_STRENGTH * shakeShare(this.mode, COCKPIT_SHAKE_FACTOR));
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
    if (this.floating) {
      // Floating at a planet without a dock: no trip, no countdown.
      this.title.textContent = `IN SPACE - ${this.floating.name}`;
      this.text.textContent = `Floating near ${this.floating.name}\n> ${line}`;
    } else {
      this.title.textContent = `FLIGHT - ${PHASE_NAMES[plan.phase]}`;
      const arrives = plan.phase === "DONE" ? "Arrived!" : `Arrives in ${formatCountdown(remainingMs)}  (at ${clockTime})`;
      this.text.textContent = `To: ${info.destinationName}\n${arrives}\n> ${line}`;
    }
    (this.barFill.parentElement as HTMLElement).style.display = this.floating ? "none" : "";
    if (this.mode === "cockpit") {
      // The same facts on the cockpit's screens (only drawn while you are looking at them).
      this.screens.draw({
        info: infoScreenData(info.destinationName, plan, COMPUTER_LINES, hashString(info.destinationDockId), COCKPIT_STATUS_SECONDS, COCKPIT_MESSAGE_SECONDS, fraction, info.stops),
        map: mapScreenData(fraction, hashString(info.destinationDockId), 16, info.stops?.length ?? 0),
        fuel: fuelScreenData(info, fraction),
      });
    }
  }

  /**
   * Draws the picture. Cockpit view goes through the cockpit lens (a wide view without stretched edges); orbit view is the normal picture.
   * The lens looks from the camera's spot and direction, with its own field of view (COCKPIT_FOV).
   */
  render(renderer: THREE.WebGLRenderer): void {
    if (renderPathFor(this.mode) === "lens") {
      this.lens ??= new CockpitLens(renderer);
      this.lens.render(this.scene, this.camera, this.cockpitFov(), COCKPIT_LENS);
    } else {
      renderer.render(this.scene, this.camera);
    }
  }

  /** Which warp look is shown (A, B or C). Used by the warp preview to compare them. */
  setWarpStyle(style: WarpStyle): void {
    this.warp.setStyle(style);
  }

  /** Frees the lens and the cockpit's geometry and materials (for when the flight screen is thrown away). */
  dispose(): void {
    this.lens?.dispose();
    this.lens = null;
    this.screens.dispose();
    this.warp.dispose();
    this.scene.remove(this.cockpitRig);
    disposeAll(this.cockpitRig);
    this.flash.remove();
    this.hudRoot.remove();
  }

  // Cockpit view only: drag to look around, wheel or pinch to zoom, double-click to look straight ahead again. A view only, nothing steers.
  /** Straight ahead again at once (a new flight, or switching views). */
  private resetLook = (): void => {
    this.look = { yaw: 0, pitch: 0 };
    this.zoom = 1;
    this.homing = false;
    this.fv = { yaw: 0, pitch: 0, zoom: 1, pan: new THREE.Vector3() };
  };

  /** Floating at a planet, outside view: the player can drag to rotate, wheel or pinch to zoom, shift/right-drag or two fingers to pan. */
  private freeOrbit(): boolean {
    return this.freeCam();
  }
  private free = false; // floating only: the outside view with the player's own controls ("Free view")
  private freeCam(): boolean {
    return this.floating !== null && this.mode === "orbit" && this.free;
  }
  private fv = { yaw: 0, pitch: 0, zoom: 1, pan: new THREE.Vector3() };
  private panBy(dx: number, dy: number): void {
    const k = 0.04 * this.fv.zoom;
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    this.fv.pan.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
    this.fv.pan.clampLength(0, 40);
  }

  /** The cockpit view's side-to-side field of view now: the start view (the approved view zoomed out) changed by the player's zoom. */
  private cockpitFov(): number {
    return fovForMagnification(startFov(COCKPIT_FOV, COCKPIT_DEFAULT_ZOOM_OUT, COCKPIT_FOV_CAP), this.zoom, COCKPIT_FOV_CAP);
  }

  /** Double tap: glide back to straight ahead (not a jump). Any drag or zoom by the player stops the glide. */
  private centreLook(): void {
    this.homing = true;
  }

  private glideHome(seconds: number): void {
    if (!this.homing) return;
    this.look = { yaw: glide(this.look.yaw, 0, seconds), pitch: glide(this.look.pitch, 0, seconds) };
    this.zoom = Math.exp(glide(Math.log(this.zoom), 0, seconds, 8, 0.002)); // zoom glides evenly in and out
    if (this.look.yaw === 0 && this.look.pitch === 0 && this.zoom === 1) this.homing = false;
  }

  private fingerDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private onDown = (e: PointerEvent): void => {
    if (this.mode !== "cockpit" && !this.freeOrbit()) return;
    try {
      this.opts.host.setPointerCapture(e.pointerId);
    } catch {
      // not important
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.moved = 0;
    this.homing = false; // touching the screen stops a glide in progress
    if (this.pointers.size === 2) this.lastPinch = this.fingerDistance();
  };

  private onMove = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p || (this.mode !== "cockpit" && !this.freeOrbit())) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    this.moved += Math.abs(dx) + Math.abs(dy);
    if (this.freeOrbit()) {
      if (this.pointers.size === 1) {
        if (e.shiftKey || (e.buttons & 2) !== 0) this.panBy(dx, dy);
        else {
          this.fv.yaw -= dx * 0.008;
          this.fv.pitch = Math.max(-1.2, Math.min(1.2, this.fv.pitch + dy * 0.006));
        }
      } else if (this.pointers.size === 2) {
        const d = this.fingerDistance();
        if (this.lastPinch > 0 && d > 0) this.fv.zoom = Math.max(0.5, Math.min(3, (this.fv.zoom * this.lastPinch) / d));
        this.lastPinch = d;
        this.panBy(dx / 2, dy / 2);
      }
      return;
    }
    if (this.pointers.size === 1) {
      const h = Math.max(1, this.opts.host.clientHeight);
      const perPixel = ((this.cockpitFov() * Math.PI) / 180) / h; // dragging a screen height turns about one field of view
      this.look = dragLook(this.look, dx, dy, perPixel, LOOK_LIMITS);
    } else if (this.pointers.size === 2) {
      const d = this.fingerDistance();
      this.zoom = zoomMagnification(this.zoom, pinchFactor(this.lastPinch, d), COCKPIT_ZOOM_RANGE);
      this.lastPinch = d;
    }
  };

  private onUp = (e: PointerEvent): void => {
    // Double tap or double click (works on phones too): look straight ahead again.
    if (e.type === "pointerup" && (this.mode === "cockpit" || this.freeOrbit()) && this.pointers.size === 1 && isTap(this.moved)) {
      const now = performance.now();
      if (isDoubleTap(this.lastTapMs, now)) {
        if (this.freeOrbit()) this.fv = { yaw: 0, pitch: 0, zoom: 1, pan: new THREE.Vector3() };
        else this.centreLook();
        this.lastTapMs = 0;
      } else {
        this.lastTapMs = now;
      }
    }
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.lastPinch = 0;
  };

  private onWheel = (e: WheelEvent): void => {
    if (this.freeOrbit()) {
      e.preventDefault();
      this.fv.zoom = Math.max(0.5, Math.min(3, this.fv.zoom * wheelFactor(e.deltaY)));
      return;
    }
    if (this.mode !== "cockpit") return;
    e.preventDefault();
    this.homing = false;
    this.zoom = zoomMagnification(this.zoom, wheelFactor(e.deltaY), COCKPIT_ZOOM_RANGE);
  };

  private toggleMode(): void {
    this.resetLook();
    if (this.floating) {
      // Floating: Orbit view (no controls) > Free view (drag, zoom, pan) > Cockpit.
      if (this.mode === "cockpit") { this.mode = "orbit"; this.free = false; }
      else if (!this.free) this.free = true;
      else { this.free = false; this.mode = "cockpit"; }
    } else {
      this.free = false;
      this.mode = this.mode === "orbit" ? "cockpit" : "orbit";
    }
    this.hudTimer = 0; // draw the screens at once when the cockpit appears
    this.updateModeButton();
  }

  private updateModeButton(): void {
    const next = this.floating ? (this.mode === "cockpit" ? "Orbit view" : this.free ? "Cockpit view" : "Free view") : this.mode === "orbit" ? "Cockpit view" : "Orbit view";
    this.modeButton.textContent = "\u{1F4F7}"; // a camera: press to change the view
    this.modeButton.title = next;
    this.modeButton.setAttribute("aria-label", next);
    // In the cockpit the trip facts and the funny lines are on the screens, so the text box and the title go away (the bar and the button stay).
    const hideText = this.mode === "cockpit";
    this.text.style.display = hideText ? "none" : "";
    this.title.style.display = hideText ? "none" : "";
    this.modeButton.style.marginLeft = hideText ? "auto" : "";
  }

  // ------------------------------------------------------------ the planets at each end

  /**
   * One end of the trip: the dock design picked for this dock, with its parking spot at the group's origin,
   * plus the planet under it (outposts) or below it (stations: the slot points along the planet's surface).
   */
  private makeBody(dockId: string): Body | null {
    const dock = getDock(this.opts.seed, dockId); // null for a planet without a dock
    if (!dock) {
      const scenery = getPlanet(this.opts.seed, dockId);
      return scenery ? this.makeSceneryBody(scenery) : null;
    }
    const planet = getPlanet(this.opts.seed, dockId);
    if (!planet) return null;
    const built = buildDockModel(dock.kind, dockId, planet);
    parkAtOrigin(built);

    const group = new THREE.Group();
    group.add(built.model.group);
    const isStation = dock.kind === "STATION";
    if (!isStation) {
      const ground = makePlanetMesh(planet, DOCKED_GROUND_RADIUS, WORLD_LIGHT, DOCKED_GROUND_DETAIL, { rings: false, clouds: false });
      ground.position.y = -DOCKED_GROUND_RADIUS - built.parking.y - 0.12;
      group.add(ground);
    } else {
      const world = makePlanetMesh(planet, DOCKED_STATION_PLANET_RADIUS, STATION_LIGHT, DOCKED_STATION_PLANET_DETAIL, { rings: false, cloudLift: 0.012 }) // clouds about 2 units up, well under the station;
      const c = stationPlanetCentre(DOCKED_STATION_PLANET_RADIUS, FLIGHT_STATION_PLANET_ALTITUDE, STATION_EXIT.straight);
      world.position.set(c.x, c.y, c.z);
      group.add(world);
    }
    group.visible = false;
    const entrance = built.model.anchors.dockEntrance?.pos;
    const bayBox = isStation && entrance ? bayBoxWorld(entrance, built.parking) : null;
    return { group, model: built.model, scenery: null, isStation, bayCamera: isStation ? { ...FLIGHT_BAY_CAMERA } : null, slide: 0, entry: null, bayBox };
  }

  /**
   * A planet WITHOUT a dock, as one end of a trip or as the scene when floating: the planet (with its rings and clouds), turned so the rings
   * never cut through the ship or camera, and its star far away. It hangs where the chosen layout (A, B or C) says, relative to the ship.
   */
  private makeSceneryBody(planet: Planet): Body {
    const layout = floatLayout(this.floatStyle);
    const centre = layout.centre;
    const distance = lengthOf(centre);
    const look = chooseLook(planet);
    const turn = new THREE.Group();
    const n = ringNormalWorld({ x: -centre.x / distance, y: -centre.y / distance, z: -centre.z / distance }, tiltForClearance(distance));
    if (look.rings) {
      // The rings' own up-direction (as makeRings builds it), turned to point nearly at the ship: seen at an angle, never cutting it.
      const local = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(Math.PI / 2 - look.ringTilt.x, look.ringTilt.y, 0));
      turn.quaternion.setFromUnitVectors(local, new THREE.Vector3(n.x, n.y, n.z));
    }
    const toStarLocal = new THREE.Vector3(STAR_DIRECTION.x, STAR_DIRECTION.y, STAR_DIRECTION.z).applyQuaternion(turn.quaternion.clone().invert());
    turn.add(makePlanetMesh(planet, layout.radius, toStarLocal, FLOAT_PLANET_DETAIL));
    const group = new THREE.Group();
    group.add(turn);
    group.position.set(centre.x, centre.y, centre.z);
    group.visible = false;

    const star = getSystem(this.opts.seed, planet.systemId)?.star;
    const sun = new THREE.Mesh(
      new THREE.IcosahedronGeometry(starDrawRadius(star?.radius ?? 1), 1),
      new THREE.MeshBasicMaterial({ color: star ? hexToNumber(star.color) : 0xfff2c0 }),
    );
    const sunStart = new THREE.Vector3(STAR_DIRECTION.x * STAR_DISTANCE, STAR_DIRECTION.y * STAR_DISTANCE, STAR_DIRECTION.z * STAR_DISTANCE);
    sun.position.copy(sunStart);
    sun.visible = false;
    const scenery = { centre: { ...centre }, radius: layout.radius, sun, axis: new THREE.Vector3(n.x, n.y, n.z), turn, baseQuat: turn.quaternion.clone(), sunStart };
    return { group, model: null, scenery, isStation: false, bayCamera: null, slide: 0, entry: null, bayBox: null };
  }

  private clearBodies(): void {
    this.removeBody(this.origin);
    this.removeBody(this.dest);
    this.origin = null;
    this.dest = null;
  }
}
