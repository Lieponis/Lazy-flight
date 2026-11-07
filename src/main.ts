import * as THREE from 'three';
import './style.css';
import { BACKGROUND_COLOR, RENDER_HEIGHT, RENDER_WIDTH } from './settings';

// Foundation demo only: a spinning low-poly cube drawn at a tiny resolution
// and stretched up without smoothing. No game features live here.

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

renderer.setPixelRatio(1); // never render more pixels than RENDER_WIDTH x RENDER_HEIGHT
renderer.setSize(RENDER_WIDTH, RENDER_HEIGHT, false); // false = leave the on-screen size to CSS
renderer.setClearColor(BACKGROUND_COLOR);
renderer.domElement.style.setProperty('--aspect', String(RENDER_WIDTH / RENDER_HEIGHT));
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(50, RENDER_WIDTH / RENDER_HEIGHT, 0.1, 100);
camera.position.set(0, 0.6, 3.4);
camera.lookAt(0, 0, 0);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1.4, 1.4, 1.4),
  new THREE.MeshLambertMaterial({ color: 0xff7a3d }),
);
scene.add(cube);

scene.add(new THREE.AmbientLight(0x6670aa, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(3, 4, 5);
scene.add(sun);

let last = performance.now();
function frame(now: number): void {
  const seconds = Math.min((now - last) / 1000, 0.1); // cap so a paused tab does not jump
  last = now;
  cube.rotation.y += seconds * 0.9;
  cube.rotation.x += seconds * 0.5;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
