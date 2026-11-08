import type * as THREE from "three";

/** Every screen (starmap, system view) looks like this, so the app can switch between them. */
export interface Screen {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Called when the screen becomes visible. */
  enter(): void;
  /** Called when the screen is hidden. */
  exit(): void;
  /** Called every frame. seconds = time since the last frame. */
  update(seconds: number): void;
}
