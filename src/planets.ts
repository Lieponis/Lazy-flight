// PLANET LOOKS PREVIEW (/planets.html, Agent 7c): a wall of real planets from a seed, drawn with the game's own
// makePlanetMesh, so Andy can check the new looks (colours, caps, craters, clouds, stripes, rings) in one place.
// Address: ?seed=NUMBER&page=N&filter=all|rings|exotic. Reads the universe only; changes nothing.

import * as THREE from "three";
import { getPlanetsOfSystem, listSystemsNear, type Planet, type Seed } from "./universe";
import { makePlanetMesh, disposeAll } from "./render/systemview";
import { chooseLook } from "./render/planetlook";
import { parseSeedParam } from "./render/helpers";

const COLS = 5;
const ROWS = 4;
const PER_PAGE = COLS * ROWS;
const LOW_RES = 3; // one game pixel = 3 screen pixels

const params = new URLSearchParams(location.search);
const state = {
  seed: parseSeedParam(location.search, 12345),
  page: Math.max(0, Number(params.get("page") ?? 0) || 0),
  filter: (params.get("filter") ?? "all") as "all" | "rings" | "exotic",
};

function allPlanets(seed: Seed): Planet[] {
  const out: Planet[] = [];
  for (const s of listSystemsNear(seed, { x: 0, y: 0, z: 0 }, 40)) out.push(...getPlanetsOfSystem(seed, s.id));
  return out;
}

const canvas = document.getElementById("c") as HTMLCanvasElement;
const wrap = document.getElementById("wrap")!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(1);
renderer.setClearColor(0x0b0828);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(0, COLS, 0, -ROWS, -10, 10);
const toStar = new THREE.Vector3(0.8, 0.35, 0.5).normalize();
let content = new THREE.Group();
scene.add(content);

function show(): void {
  const url = `?seed=${state.seed}&page=${state.page}&filter=${state.filter}`;
  history.replaceState(null, "", url);
  (document.getElementById("seed") as HTMLInputElement).value = String(state.seed);
  (document.getElementById("filter") as HTMLSelectElement).value = state.filter;
  const planets = allPlanets(state.seed);
  const looks = planets.map((p) => chooseLook(p));
  const ringed = looks.filter((l) => l.rings).length;
  const exotic = looks.filter((l) => l.exotic).length;
  document.getElementById("stats")!.textContent =
    `${planets.length} planets near the start: ${ringed} with rings (${((100 * ringed) / planets.length).toFixed(1)} %), ` +
    `${exotic} with surprising colours (${((100 * exotic) / planets.length).toFixed(0)} %). Page ${state.page + 1}.`;
  const list = planets.filter((_p, i) => state.filter === "all" || (state.filter === "rings" ? looks[i]!.rings : looks[i]!.exotic));
  const pageItems = list.slice(state.page * PER_PAGE, (state.page + 1) * PER_PAGE);

  disposeAll(content);
  scene.remove(content);
  content = new THREE.Group();
  scene.add(content);
  wrap.querySelectorAll(".tag").forEach((t) => t.remove());
  pageItems.forEach((planet, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const look = chooseLook(planet);
    const radius = look.rings ? 0.2 : 0.32; // ringed planets smaller so the rings fit the cell
    const mesh = makePlanetMesh(planet, radius, toStar, planet.type === "GAS" ? 3 : 2);
    mesh.position.set(col + 0.5, -row - 0.45, 0);
    content.add(mesh);
    const tag = document.createElement("div");
    tag.className = "tag";
    const extras = [look.exotic ? "surprising" : "", look.rings ? `rings ×${look.rings.length}` : "", look.clouds ? "clouds" : "", look.caps ? "caps" : "", look.craters.length ? "craters" : ""]
      .filter(Boolean)
      .join(" · ");
    tag.innerHTML = `${planet.name}<br><b>${planet.type.toLowerCase()}</b> ${extras}`;
    tag.style.left = `${(col / COLS) * 100}%`;
    tag.style.width = `${100 / COLS}%`;
    tag.style.top = `${((row + 0.86) / ROWS) * 100}%`;
    wrap.append(tag);
  });
  draw();
}

function draw(): void {
  const w = wrap.clientWidth;
  const h = Math.round(w * (ROWS / COLS) * 0.9);
  canvas.style.height = `${h}px`;
  renderer.setSize(Math.max(1, Math.round(w / LOW_RES)), Math.max(1, Math.round(h / LOW_RES)), false);
  camera.left = 0;
  camera.right = COLS;
  camera.top = 0;
  camera.bottom = -ROWS;
  // keep planets round: stretch the world to the canvas shape
  const aspect = w / h / (COLS / ROWS);
  camera.left = COLS / 2 - (COLS / 2) * aspect;
  camera.right = COLS / 2 + (COLS / 2) * aspect;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}

document.getElementById("prev")!.addEventListener("click", () => {
  state.page = Math.max(0, state.page - 1);
  show();
});
document.getElementById("next")!.addEventListener("click", () => {
  state.page++;
  show();
});
document.getElementById("seed")!.addEventListener("change", (e) => {
  state.seed = Number((e.target as HTMLInputElement).value) || 12345;
  state.page = 0;
  show();
});
document.getElementById("filter")!.addEventListener("change", (e) => {
  state.filter = (e.target as HTMLSelectElement).value as typeof state.filter;
  state.page = 0;
  show();
});
window.addEventListener("resize", draw);
show();
