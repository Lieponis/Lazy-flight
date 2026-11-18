import { readFileSync } from "node:fs";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { makeMapSource } from "../src/mapsource";
import { CockpitLens } from "../src/render/assets/lens";
import type { SkyLayer } from "../src/render/galaxy/skylayer";
import { makeSystemSkyLayer, renderWithSky } from "../src/render/systemsky";
import { WORLD_SEED } from "../src/universe";

// G8: the faint galaxy sky behind the docked and flight screens (the system view already had it). One helper makes the layer and one
// draws it, so every screen looks the same for the same system. Nothing here needs a real screen: the renderer is a recording fake.

function fakeRenderer(log: string[]): THREE.WebGLRenderer {
  const fake = {
    autoClear: true,
    clear: () => log.push(`clear(autoClear=${String(fake.autoClear)})`),
    render: (scene: { name: string }) => log.push(`render ${scene.name}(autoClear=${String(fake.autoClear)})`),
    setRenderTarget: (t: unknown) => log.push(t ? "target" : "target off"),
    getSize: (v: THREE.Vector2) => v.set(400, 300),
  };
  return fake as unknown as THREE.WebGLRenderer;
}

function fakeSky(log: string[], visible: boolean): SkyLayer {
  return {
    visible,
    view: { follow: () => log.push("follow") },
    draw: () => log.push("sky draw"),
  } as unknown as SkyLayer;
}

const named = (name: string): THREE.Scene => {
  const s = new THREE.Scene();
  s.name = name;
  return s;
};

describe("renderWithSky (the picture of docked, flight and the system view)", () => {
  it("is exactly the plain picture without a sky, and until the first sky is built", () => {
    for (const sky of [null, fakeSky([], false)]) {
      const log: string[] = [];
      renderWithSky(fakeRenderer(log), sky, named("scene"), new THREE.PerspectiveCamera());
      expect(log).toEqual(["render scene(autoClear=true)"]);
    }
  });

  it("clears, draws the sky turned like the camera, then the scene over it, and puts autoClear back", () => {
    const log: string[] = [];
    const renderer = fakeRenderer(log);
    renderWithSky(renderer, fakeSky(log, true), named("scene"), new THREE.PerspectiveCamera());
    expect(log).toEqual(["clear(autoClear=false)", "follow", "sky draw", "render scene(autoClear=false)"]);
    expect(renderer.autoClear).toBe(true);
  });
});

describe("the cockpit lens with the sky drawn first", () => {
  const camera = new THREE.PerspectiveCamera(50, 1.5, 0.05, 40000);
  camera.position.set(1, 2, 3);

  it("without `before` it is the same two passes as before (scene into the hidden picture, then the lens quad)", () => {
    const log: string[] = [];
    new CockpitLens(fakeRenderer(log)).render(named("scene"), camera);
    expect(log).toEqual(["target", "render scene(autoClear=true)", "target off", "render (autoClear=true)"]);
  });

  it("with `before`: clears the hidden picture, lets the sky draw (with the lens's own wide camera), then the scene, then the quad", () => {
    const log: string[] = [];
    const renderer = fakeRenderer(log);
    let seen: THREE.PerspectiveCamera | null = null;
    new CockpitLens(renderer).render(named("scene"), camera, 100, 0.5, (r, wide) => {
      seen = wide;
      log.push(`before(autoClear=${String(r.autoClear)})`);
    });
    expect(log).toEqual(["target", "clear(autoClear=false)", "before(autoClear=false)", "render scene(autoClear=false)", "target off", "render (autoClear=true)"]);
    expect(renderer.autoClear).toBe(true);
    const wide = seen as THREE.PerspectiveCamera | null;
    expect(wide).not.toBeNull();
    expect(wide?.position.toArray()).toEqual([1, 2, 3]); // looks from the ship camera's spot
    expect(wide?.fov).toBeGreaterThan(50); // but wider than the ship camera
  });
});

describe("one sky layer made one way", () => {
  const source = makeMapSource(WORLD_SEED);
  const fns = source.sky;

  it("two layers made by makeSystemSkyLayer build the same sky for the same place (same settings as the system view)", () => {
    expect(fns).toBeTruthy();
    if (!fns) return;
    const spot = { x: 12_000, y: 0, z: 7000 };
    const built: number[] = [];
    for (let i = 0; i < 2; i++) {
      const layer = makeSystemSkyLayer(fns);
      expect(layer.visible).toBe(false); // nothing built yet: the screens then look as before
      layer.setPosition(spot);
      for (let guard = 0; guard < 200 && !layer.visible; guard++) layer.step(50, false); // built in the background: fully there at once
      expect(layer.visible).toBe(true);
      built.push(layer.dotCount);
      layer.dispose();
    }
    expect(built[0]).toBeGreaterThan(1000);
    expect(built[1]).toBe(built[0]);
  });
});

describe("the wiring (source checks, so the sky is reused and not copied)", () => {
  const read = (file: string): string => readFileSync(file, "utf8");

  it("the system view, the docked screen and the flight screen all draw through renderWithSky; only the system view and the app make layers", () => {
    expect(read("src/render/systemview.ts")).toContain("renderWithSky(");
    expect(read("src/render/docked.ts")).toContain("renderWithSky(");
    expect(read("src/render/flight.ts")).toContain("renderWithSky(");
    for (const file of ["src/render/systemview.ts", "src/render/docked.ts", "src/render/flight.ts"]) {
      expect(read(file)).not.toContain("new SkyLayer(");
    }
    expect(read("src/render/systemview.ts")).toContain("makeSystemSkyLayer(");
    expect(read("src/render/docked.ts")).not.toContain("makeSystemSkyLayer(");
    expect(read("src/render/flight.ts")).not.toContain("makeSystemSkyLayer(");
  });

  it("the app makes ONE layer for docked and flight and hands the same one to both", () => {
    const index = read("src/render/index.ts");
    expect(index.match(/makeSystemSkyLayer\(/g)?.length).toBe(1);
    expect(index).toContain("skyLayer: stageSky,");
    expect(index).toContain("parent, skyLayer: stageSky }");
  });

  it("the flight screen points the sky at the system its backdrop dots belong to (a trip: the destination; floating: the planet's system)", () => {
    const flight = read("src/render/flight.ts");
    expect(flight).toContain("this.pointSkyAt(skySystem);");
    expect(flight).toContain("this.pointSkyAt(planet.systemId);");
    expect(read("src/render/docked.ts")).toContain("this.sky?.setPosition(this.skyAt)");
  });
});
