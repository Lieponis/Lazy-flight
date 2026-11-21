// Drag to rotate, scroll or pinch to zoom, tap to select. Works with mouse and fingers.
// The camera looks at the middle (0,0,0) of the scene, or at a spot it has glided to with focusOn (system view: tap a planet).

import type * as THREE from "three";
import { approach, clamp, orbitCameraPosition } from "./helpers";

interface Pointer {
  x: number;
  y: number;
}

/**
 * Eases a turn that the finger asked for (`pending`, radians) into the camera: returns how much to turn in this frame (`step`) and what is
 * left for the next frames (`rest`). `tau` is the easing time in seconds; 0 (or less) turns at once. The ease does not depend on the frame rate.
 */
export function smoothTurn(pending: number, seconds: number, tau: number): { step: number; rest: number } {
  if (!(tau > 0)) return { step: pending, rest: 0 };
  const k = 1 - Math.exp(-Math.max(0, seconds) / tau);
  const step = pending * k;
  const rest = pending - step;
  if (Math.abs(rest) < 0.0002) return { step: pending, rest: 0 };
  return { step, rest };
}

export class OrbitView {
  yaw = 0.7;
  pitch = 0.5;
  dist: number;
  /**
   * Seconds the camera takes to follow the finger when you drag to turn. 0 = it follows every finger movement at once (as before). A small
   * value evens out the little jumps of the finger, so the whole picture does not shake while you turn it. Needs glide() to run every frame.
   */
  turnSmoothSeconds = 0;
  private pendingYaw = 0;
  private pendingPitch = 0;
  /** The spot the camera looks at and circles around. */
  readonly target = { x: 0, y: 0, z: 0 };
  private goal: { x: number; y: number; z: number; dist: number | null } | null = null;
  /** Called for a quick tap or click (not a drag). Coordinates are window pixels. */
  onTap: ((clientX: number, clientY: number) => void) | null = null;

  private pointers = new Map<number, Pointer>();
  private tapStart: { t: number } | null = null;
  private moved = 0;
  private multi = false;
  private lastPinch = 0;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private el: HTMLElement,
    public minDist: number,
    public maxDist: number,
    startDist: number,
  ) {
    this.dist = clamp(startDist, minDist, maxDist);
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
    this.tapStart = null;
    this.pendingYaw = 0;
    this.pendingPitch = 0;
  }

  /** Glide to look at (x, y, z), and optionally to a new distance. The player's own zoom stops the distance glide. */
  focusOn(x: number, y: number, z: number, dist: number | null = null): void {
    this.goal = { x, y, z, dist: dist === null ? null : clamp(dist, this.minDist, this.maxDist) };
  }

  /** Jump to the middle at once (no glide). */
  resetFocus(): void {
    this.goal = null;
    this.target.x = 0;
    this.target.y = 0;
    this.target.z = 0;
  }

  /** Moves the glide on a little. Call every frame before apply(). */
  glide(seconds: number): void {
    if (this.pendingYaw !== 0 || this.pendingPitch !== 0) {
      const ty = smoothTurn(this.pendingYaw, seconds, this.turnSmoothSeconds);
      const tp = smoothTurn(this.pendingPitch, seconds, this.turnSmoothSeconds);
      this.pendingYaw = ty.rest;
      this.pendingPitch = tp.rest;
      this.yaw += ty.step;
      const wanted = this.pitch + tp.step;
      this.pitch = clamp(wanted, -1.4, 1.4);
      if (wanted !== this.pitch) this.pendingPitch = 0; // at the top or bottom: nothing more to turn that way
    }
    const g = this.goal;
    if (!g) return;
    this.target.x = approach(this.target.x, g.x, seconds);
    this.target.y = approach(this.target.y, g.y, seconds);
    this.target.z = approach(this.target.z, g.z, seconds);
    if (g.dist !== null) this.dist = approach(this.dist, g.dist, seconds);
    if (this.target.x === g.x && this.target.y === g.y && this.target.z === g.z && (g.dist === null || this.dist === g.dist)) this.goal = null;
  }

  /** Puts the camera in place. Call once per frame (it is very cheap). */
  apply(): void {
    const p = orbitCameraPosition(this.yaw, this.pitch, this.dist);
    const t = this.target;
    this.camera.position.set(t.x + p.x, t.y + p.y, t.z + p.z);
    this.camera.lookAt(t.x, t.y, t.z);
    this.camera.updateMatrixWorld();
  }

  private pinchDistance(): number {
    const pts = [...this.pointers.values()];
    const a = pts[0];
    const b = pts[1];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private onDown = (e: PointerEvent): void => {
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      // not important
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) {
      this.moved = 0;
      this.multi = false;
      this.tapStart = { t: performance.now() };
    } else {
      this.multi = true;
      this.lastPinch = this.pinchDistance();
    }
  };

  private onMove = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    this.moved += Math.abs(dx) + Math.abs(dy);
    if (this.pointers.size === 1) {
      if (this.turnSmoothSeconds > 0) {
        this.pendingYaw -= dx * 0.01;
        this.pendingPitch += dy * 0.01;
      } else {
        this.yaw -= dx * 0.01;
        this.pitch = clamp(this.pitch + dy * 0.01, -1.4, 1.4);
      }
    } else if (this.pointers.size === 2) {
      const d = this.pinchDistance();
      if (this.lastPinch > 0 && d > 0) {
        this.dist = clamp((this.dist * this.lastPinch) / d, this.minDist, this.maxDist);
        if (this.goal) this.goal.dist = null; // the player is zooming now
      }
      this.lastPinch = d;
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.lastPinch = 0;
    if (this.pointers.size === 0) {
      const quick = this.tapStart !== null && performance.now() - this.tapStart.t < 600;
      if (e.type === "pointerup" && !this.multi && this.moved < 8 && quick) {
        this.onTap?.(e.clientX, e.clientY);
      }
      this.tapStart = null;
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.dist = clamp(this.dist * Math.exp(e.deltaY * 0.0012), this.minDist, this.maxDist);
    if (this.goal) this.goal.dist = null; // the player is zooming now
  };
}
