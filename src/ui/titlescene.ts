// Title screen backdrop (Agent 7b): a small, separate 3D picture made from the GAME'S OWN planets and station models
// (Andy: "planets like the ones in the game, a station above the name"). It is drawn at the game's low resolution,
// lives only while the title shows, and is thrown away completely after PLAY (nothing keeps running).
// Uses render's model builders read-only (src/ui may import src/render; never the other way round).

import * as THREE from "three";
import { getDock, getPlanetsOfSystem, type Planet, type Seed } from "../universe";
import { makePlanetMesh } from "../render/systemview";
import { buildDockModel } from "../render/models3d";
import { lowResSize, titleLayout, type TitleLayout } from "./titlelogic";

const NAVY = "#0b0828"; // Andy: a few tones darker than the first try, not black
const STAR_COLOURS = ["#ffffff", "#ffe14a", "#9b5cff", "#3fe0f0"];
const FOV = 40;

interface Star {
  x: number;
  y: number;
  c: string;
  big: boolean;
  ph: number;
  sp: number;
}

/** The two planets to show: the one you are docked at first, then the most different one in the same system. */
export function pickTitlePlanets(planets: Planet[], hereId: string): [Planet, Planet] | null {
  if (planets.length === 0) return null;
  const here = planets.find((p) => p.id === hereId) ?? planets[0]!;
  const other = planets.find((p) => p.id !== here.id && p.type !== here.type) ?? planets.find((p) => p.id !== here.id) ?? here;
  return [here, other];
}

export class TitleScene {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 500);
  private big: THREE.Object3D | null = null;
  private small: THREE.Object3D | null = null;
  private station: THREE.Group | null = null;
  private stars: Star[] = [];
  private starCanvas = document.createElement("canvas");
  private raf = 0;
  private t0 = performance.now();
  private size = { w: 1, h: 1 };
  private layout: TitleLayout = titleLayout(1);
  private onResize = (): void => this.resize();

  constructor(private parent: HTMLElement, seed: Seed, dockId: string, systemId: string) {
    this.starCanvas.className = "ui-title-stars";
    parent.append(this.starCanvas);
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "low-power" });
      this.renderer.setPixelRatio(1);
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.domElement.className = "ui-title-3d";
      parent.append(this.renderer.domElement);
    } catch {
      this.renderer = null; // no 3D: the stars and the name still show
    }
    this.build(seed, dockId, systemId);
    this.resize();
    window.addEventListener("resize", this.onResize);
    this.raf = requestAnimationFrame(this.frame);
  }

  private build(seed: Seed, dockId: string, systemId: string): void {
    const planets = getPlanetsOfSystem(seed, systemId);
    const pair = pickTitlePlanets(planets, dockId);
    const toStar = new THREE.Vector3(0.8, 0.45, 0.6).normalize(); // light from the upper right
    if (pair) {
      this.big = makePlanetMesh(pair[0], 1, toStar, pair[0].type === "GAS" ? 3 : 2);
      this.small = makePlanetMesh(pair[1], 1, toStar, pair[1].type === "GAS" ? 3 : 2);
      this.scene.add(this.big, this.small);
      // A station from this system (the one you are at, if it is a station).
      const stationPlanet =
        planets.find((p) => p.id === dockId && getDock(seed, p.id)?.kind === "STATION") ??
        planets.find((p) => getDock(seed, p.id)?.kind === "STATION") ??
        pair[0];
      try {
        const dock = buildDockModel("STATION", stationPlanet.id, stationPlanet);
        const g = dock.model.group;
        const box = new THREE.Box3().setFromObject(g);
        const centre = box.getCenter(new THREE.Vector3());
        const radius = Math.max(0.001, 0.5 * box.getSize(new THREE.Vector3()).length());
        g.position.sub(centre);
        const holder = new THREE.Group();
        holder.add(g);
        holder.userData.radius = radius;
        holder.rotation.x = 0.35;
        this.station = holder;
        this.scene.add(holder);
      } catch {
        this.station = null;
      }
    }
  }

  private resize(): void {
    const W = Math.max(1, this.parent.clientWidth || window.innerWidth);
    const H = Math.max(1, this.parent.clientHeight || window.innerHeight);
    this.size = lowResSize(W, H);
    const { w, h } = this.size;
    this.starCanvas.width = w;
    this.starCanvas.height = h;
    this.renderer?.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.layout = titleLayout(w / h);
    this.stars = makeStars(Math.round((w * h) / 700), w, h);
    this.place();
  }

  /** Puts each object at its screen spot (x, y in -1..1) and size (share of screen height), 30 units in front. */
  private place(): void {
    const depth = 30;
    const halfH = depth * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const halfW = halfH * this.camera.aspect;
    const put = (o: THREE.Object3D | null, spot: { x: number; y: number; size: number }, radius = 1): void => {
      if (!o) return;
      o.position.set(spot.x * halfW, spot.y * halfH, -depth);
      o.scale.setScalar((spot.size * 2 * halfH) / 2 / radius);
    };
    put(this.big, this.layout.bigPlanet);
    put(this.small, this.layout.smallPlanet);
    put(this.station, this.layout.station, (this.station?.userData.radius as number | undefined) ?? 1);
  }

  private frame = (): void => {
    const t = (performance.now() - this.t0) / 1000;
    const g = this.starCanvas.getContext("2d");
    if (g) {
      g.fillStyle = NAVY;
      g.fillRect(0, 0, this.size.w, this.size.h);
      drawStars(g, this.stars, t);
    }
    // Slow, calm movement: planets turn, the station spins gently, the camera drifts a little.
    if (this.big) this.big.rotation.y = t * 0.05;
    if (this.small) this.small.rotation.y = -t * 0.08;
    if (this.station) this.station.rotation.y = t * 0.25;
    this.camera.position.set(Math.sin(t * 0.1) * 0.6, Math.sin(t * 0.07) * 0.3, 0);
    if (this.renderer) {
      try {
        this.renderer.render(this.scene, this.camera);
      } catch {
        // a lost drawing context must not stop the title
      }
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  /** Stops everything and frees the graphics memory. */
  dispose(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.domElement.remove();
      this.renderer = null;
    }
    this.starCanvas.remove();
  }
}

function makeStars(n: number, w: number, h: number): Star[] {
  let s = 99991;
  const r = (): number => (s = (s * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: n }, () => ({
    x: Math.floor(r() * w),
    y: Math.floor(r() * h),
    c: STAR_COLOURS[Math.floor(r() * STAR_COLOURS.length)]!,
    big: r() < 0.3,
    ph: r() * 6.28,
    sp: 0.6 + r() * 1.6,
  }));
}

function drawStars(g: CanvasRenderingContext2D, stars: Star[], t: number): void {
  for (const st of stars) {
    const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * st.sp + st.ph));
    g.globalAlpha = a;
    g.fillStyle = st.c;
    g.fillRect(st.x, st.y, 1, 1);
    if (st.big && a > 0.7) {
      g.fillRect(st.x - 1, st.y, 3, 1);
      g.fillRect(st.x, st.y - 1, 1, 3);
    }
  }
  g.globalAlpha = 1;
}
