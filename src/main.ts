import * as THREE from 'three';
import './style.css';
import { BACKGROUND_COLOR } from './settings';
import { startRender } from './render';
import { chooseStart, startUi } from './ui';

// Draws at a tiny resolution and stretches the picture up without smoothing (the chunky pixel look).
// The two screens (starmap and system view) live in src/render.

const app = document.getElementById('app');
if (!app) {
  throw new Error('Could not find the #app element in index.html');
}

function showFallback(message: string): void {
  const note = document.createElement('p');
  note.className = 'fallback-message';
  note.textContent = message;
  app!.appendChild(note);
}

let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({
    antialias: false, // no smoothing: we want hard pixel edges
    powerPreference: 'low-power', // be kind to phone batteries
  });
} catch {
  showFallback('Sorry, this browser cannot show 3D graphics (WebGL is off or unsupported).');
  throw new Error('WebGL not available');
}

renderer.setPixelRatio(1); // never render more pixels than the small hidden picture (size is set in src/render/index.ts)
renderer.setClearColor(BACKGROUND_COLOR);
app.appendChild(renderer.domElement);

const start = chooseStart(); // continue the save or start a new game: this picks the ONE seed for everything
const api = startRender(renderer, app, { seed: start.plan.seed });
startUi(api, app, start); // the menus: status strip, JOBS, MAP, Jobs menu, arrival card (src/ui)
