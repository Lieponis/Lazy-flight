// Drag to rotate, scroll or pinch to zoom, tap to select. Works with mouse and fingers.
// The camera always looks at the middle (0,0,0) of the scene.

import type * as THREE from "three";
import { clamp, orbitCameraPosition } from "./helpers";

interface Pointer {
  x: number;
  y: number;
}

export class OrbitView {
  yaw = 0.7;
  pitch = 0.5;
  dist: number;
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
  }

  /** Puts the camera in place. Call once per frame (it is very cheap). */
  apply(): void {
    const p = orbitCameraPosition(this.yaw, this.pitch, this.dist);
    this.camera.position.set(p.x, p.y, p.z);
    this.camera.lookAt(0, 0, 0);
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
      this.yaw -= dx * 0.01;
      this.pitch = clamp(this.pitch + dy * 0.01, -1.4, 1.4);
    } else if (this.pointers.size === 2) {
      const d = this.pinchDistance();
      if (this.lastPinch > 0 && d > 0) {
        this.dist = clamp((this.dist * this.lastPinch) / d, this.minDist, this.maxDist);
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
  };
}
