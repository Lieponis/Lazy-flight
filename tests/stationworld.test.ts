// Brief 3o, fix 2: the real ball (needs real three). The planet turns about the sun's direction, so the light never moves.
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { START_POINT, getPlanetsOfSystem, nearestSystems, type Planet } from "../src/universe";
import { STATION_SUN, spinPhase } from "../src/render/stationspin";
import { makeStationWorld } from "../src/render/stationworld";

const seed = 12345;
const planets: Planet[] = nearestSystems(seed, START_POINT, 60).flatMap(({ system }) => getPlanetsOfSystem(seed, system.id));

describe("3o fix 2: the station planet ball", () => {
  it("its turning axis (the pattern's pole) points at the sun", () => {
    const world = makeStationWorld(planets[0] as Planet, 150, 3);
    const pole = new THREE.Vector3(0, 1, 0).applyQuaternion(world.group.quaternion);
    expect(pole.x).toBeCloseTo(STATION_SUN.x, 6);
    expect(pole.y).toBeCloseTo(STATION_SUN.y, 6);
    expect(pole.z).toBeCloseTo(STATION_SUN.z, 6);
  });

  it("the ground turns by the planet's own start place at time 0, and half a turn later it is a half turn on", () => {
    const planet = planets[1] as Planet;
    const world = makeStationWorld(planet, 150, 3);
    const ball = world.group.children[0] as THREE.Mesh;
    expect(ball.rotation.y).toBeCloseTo(spinPhase(planet.id), 9);
    world.setTime(150, 300);
    expect(ball.rotation.y - spinPhase(planet.id)).toBeCloseTo(Math.PI, 9);
    world.setTime(150, 0); // off: back to the start place
    expect(ball.rotation.y).toBeCloseTo(spinPhase(planet.id), 9);
  });

  it("the colours do not change while it turns (the light is baked in and the turn is about the light)", () => {
    const planet = planets[2] as Planet;
    const world = makeStationWorld(planet, 150, 3);
    const ball = world.group.children[0] as THREE.Mesh;
    const before = Array.from((ball.geometry.getAttribute("color") as THREE.BufferAttribute).array.slice(0, 600));
    world.setTime(123, 60);
    const after = Array.from((ball.geometry.getAttribute("color") as THREE.BufferAttribute).array.slice(0, 600));
    expect(after).toEqual(before);
  });

  it("any clouds are turned a little further than the ground", () => {
    for (const planet of planets) {
      const world = makeStationWorld(planet, 150, 3);
      const ball = world.group.children[0] as THREE.Mesh;
      const clouds = ball.getObjectByName("clouds");
      if (!clouds) continue;
      world.setTime(30, 300);
      expect(clouds.rotation.y).toBeGreaterThan(0);
      expect(clouds.rotation.y).toBeLessThan(ball.rotation.y - spinPhase(planet.id));
      return;
    }
    throw new Error("no planet with clouds among the first sixty stars");
  });
});
