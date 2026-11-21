import { IS_PREVIEW } from './previewboot'; // KEEP THIS FIRST: it must run before any other code reads the save box (src/previewboot.ts)
import * as THREE from 'three';
import './style.css';
import { BACKGROUND_COLOR } from './settings';
import { startRender } from './render';
import { makeMapSource } from './mapsource';
import { chooseStart, startUi } from './ui';
import { startOfflineApp } from './ui/updatenote';
import { runBootGuard } from './rescue';
import { getBrowserStorage } from './save/save';

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

// HOTFIX 2026-11-21 (src/rescue.ts): after 2 starts in a row that did not keep running, or with ?rescue=1, show the small SAFE START
// screen instead of the game (it clears only the flight plan destination and offers SAVE FILE DOWNLOAD). Nothing heavy runs before this.
let sessionBox: Storage | null = null;
try {
  sessionBox = window.sessionStorage;
} catch {
  sessionBox = null;
}
if (runBootGuard(getBrowserStorage(), sessionBox, app)) {
  // The offline helper still registers, so a fixed version of the game can arrive while the rescue screen shows.
  if (!IS_PREVIEW) startOfflineApp(app, () => true);
  throw new Error('Safe start: the game was not started (see the SAFE START screen).');
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
const api = startRender(renderer, app, { seed: start.plan.seed, mapSource: makeMapSource });
const game = startUi(api, app, start); // the menus: status strip, JOBS, MAP, Jobs menu, arrival card (src/ui)
// Offline app (stage P1): registers the offline helper and offers "new version ready" only when no trip is running.
// The branch preview never registers one: its helper would share the live game's stored copies and could delete them.
if (!IS_PREVIEW) startOfflineApp(app, () => game.state.currentJob === null && game.state.freeTrip === null && api.state.get().screen !== 'flight');
