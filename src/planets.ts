import "./previewboot"; // KEEP THIS FIRST: it must run before any other code reads the save box (src/previewboot.ts)
// PLANET LOOKS PREVIEW (/planets.html, Agent 7c): a wall of real planets from a seed, drawn with the game's own
// makePlanetMesh, so Andy can check the new looks (colours, caps, craters, clouds, stripes, rings) in one place.
// Address: ?seed=NUMBER&page=N&filter=all|rings|exotic|earthlike (&earth=A|B|C to compare Earth looks, 7f).
// &type=ICE (or ROCKY, DESERT, OCEAN, LAVA, GAS, JUNGLE, BARREN) shows one kind only.
// &ground=1 (brief 3o): instead of the whole planet, each cell shows the ground under an OUTPOST seen from straight above, twice:
//   left = the old way (the pole is under the pad), right = the new way (an ordinary spot is). The orange diamond is the pad.
// Reads the universe only; changes nothing.

import * as THREE from "three";
import { getPlanetsOfSystem, nearestSystems, START_POINT, type Planet, type Seed } from "./universe";
import { makePlanetMesh, disposeAll } from "./render/systemview";
import { CAP_COLOUR, chooseLook, outpostSpot, surfaceColour, type EarthStyle } from "./render/planetlook";
import { parseSeedParam } from "./render/helpers";
import { nameHtml } from "./render/nametext";

const COLS = 5;
const ROWS = 4;
const PER_PAGE = COLS * ROWS;
const LOW_RES = 3; // one game pixel = 3 screen pixels

const params = new URLSearchParams(location.search);
const state = {
  seed: parseSeedParam(location.search, 12345),
  page: Math.max(0, Number(params.get("page") ?? 0) || 0),
  filter: (params.get("filter") ?? "all") as "all" | "rings" | "exotic" | "earthlike",
  /** Force one Earth look for comparing (&earth=A|B|C); empty = the game's own mix of A and C. */
  earth: (["A", "B", "C"].includes(params.get("earth") ?? "") ? params.get("earth") : undefined) as EarthStyle | undefined,
  type: (params.get("type") ?? "").toUpperCase(),
  ground: params.get("ground") === "1",
};

function allPlanets(seed: Seed): Planet[] {
  const out: Planet[] = [];
  for (const { system } of nearestSystems(seed, START_POINT, 40)) out.push(...getPlanetsOfSystem(seed, system.id));
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
  const url = `?seed=${state.seed}&page=${state.page}&filter=${state.filter}${state.earth ? `&earth=${state.earth}` : ""}${state.type ? `&type=${state.type}` : ""}${state.ground ? "&ground=1" : ""}`;
  history.replaceState(null, "", url);
  (document.getElementById("seed") as HTMLInputElement).value = String(state.seed);
  (document.getElementById("filter") as HTMLSelectElement).value = state.filter;
  const planets = allPlanets(state.seed);
  const looks = planets.map((p) => chooseLook(p, state.earth));
  const ringed = looks.filter((l) => l.rings).length;
  const exotic = looks.filter((l) => l.exotic).length;
  const earth = looks.filter((l) => l.earth).length;
  document.getElementById("stats")!.textContent =
    `${planets.length} planets near the start: ${ringed} with rings (${((100 * ringed) / planets.length).toFixed(1)} %), ` +
    `${exotic} with surprising colours (${((100 * exotic) / planets.length).toFixed(0)} %), ` +
    `${earth} Earth-like (${((100 * earth) / planets.length).toFixed(1)} %, ${state.earth ? `forced look ${state.earth}` : "looks A + C"}). Page ${state.page + 1}.`;
  const list = planets.filter((_p, i) => state.filter === "all" || (state.filter === "rings" ? looks[i]!.rings : state.filter === "earthlike" ? looks[i]!.earth : looks[i]!.exotic)).filter((p) => !state.type || p.type === state.type);
  const perPage = state.ground ? PER_PAGE / 2 : PER_PAGE;
  const pageItems = list.slice(state.page * perPage, (state.page + 1) * perPage);
  if (state.ground) {
    // how many outposts would have stood on an ice cap in the old way (the pole under the pad), and in the new way
    let oldCap = 0;
    let newCap = 0;
    for (const p of list) {
      const l = chooseLook(p, state.earth);
      if (!l.earth && l.caps > 0) oldCap++; // the pole is a cap whenever the planet has caps (Earth-likes were already turned to a coast)
      const d = outpostSpot(p.type, l);
      const c = surfaceColour(p.type, l, d.x, d.y, d.z);
      if (c[0] === CAP_COLOUR[0] && c[1] === CAP_COLOUR[1] && c[2] === CAP_COLOUR[2]) newCap++;
    }
    document.getElementById("stats")!.textContent += `  OUTPOST GROUND: of ${list.length} planets shown, the old way put the pad on an ice cap on ${oldCap}, the new way on ${newCap}.`;
  }

  disposeAll(content);
  scene.remove(content);
  content = new THREE.Group();
  scene.add(content);
  wrap.querySelectorAll(".tag").forEach((t) => t.remove());
  pageItems.forEach((planet, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const look = chooseLook(planet, state.earth);
    const radius = look.rings ? 0.2 : 0.32; // ringed planets smaller so the rings fit the cell
    if (state.ground) {
      // the ground under an outpost seen from straight above: the top of the ball turned towards us, with the pad in the middle
      const lit = new THREE.Vector3(0.25, 1, 0.3).normalize();
      for (const [dx, newWay] of [[0.27, false], [0.73, true]] as const) {
        const ball = makePlanetMesh(planet, 0.21, lit, 3, { rings: false, clouds: false, earthStyle: state.earth, outpostGround: newWay });
        ball.rotation.x = Math.PI / 2; // +y (the top, under the pad) turns towards the viewer
        ball.position.set(col + dx, -row - 0.45, 0);
        content.add(ball);
        const pad = new THREE.Mesh(new THREE.CircleGeometry(0.035, 4), new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
        pad.position.set(col + dx, -row - 0.45, 0.4);
        content.add(pad);
      }
      const gtag = document.createElement("div");
      gtag.className = "tag";
      gtag.innerHTML = `${nameHtml(planet.name)}<br><b>${planet.type.toLowerCase()}</b> ${look.caps ? "caps" : "no caps"} · old | new`;
      gtag.style.left = `${(col / COLS) * 100}%`;
      gtag.style.width = `${100 / COLS}%`;
      gtag.style.top = `${((row + 0.86) / ROWS) * 100}%`;
      wrap.append(gtag);
      return;
    }
    const mesh = makePlanetMesh(planet, radius, toStar, planet.type === "GAS" ? 3 : 2, { earthStyle: state.earth });
    mesh.position.set(col + 0.5, -row - 0.45, 0);
    content.add(mesh);
    const tag = document.createElement("div");
    tag.className = "tag";
    const extras = [look.earth ? `EARTH-LIKE ${look.earth}` : "", look.exotic ? "surprising" : "", look.rings ? `rings ×${look.rings.length}` : "", look.clouds ? "clouds" : "", look.caps ? "caps" : "", look.craters.length ? "craters" : ""]
      .filter(Boolean)
      .join(" · ");
    tag.innerHTML = `${nameHtml(planet.name)}<br><b>${planet.type.toLowerCase()}</b> ${extras}`;
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
