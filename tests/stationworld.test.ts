// Brief 3o, fix 2: the real ball and the sky (needs real three). The station goes round: planet, its light, stars and sky turn together.
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { START_POINT, getPlanetsOfSystem, nearestSystems, type Planet } from "../src/universe";
import { STATION_POLE, orbitAngles, startAngle } from "../src/render/stationspin";
import { makeStationWorld } from "../src/render/stationworld";
import { SkyView } from "../src/render/galaxy/skyview";

const seed = 12345;
const planets: Planet[] = nearestSystems(seed, START_POINT, 12).flatMap(({ system }) => getPlanetsOfSystem(seed, system.id));

describe("3o fix 2: the station planet ball", () => {
  it("the planet's pole points the way the orbit's tilt says", () => {
    const world = makeStationWorld(planets[0] as Planet, 150, 3);
    const ball = world.group.children[0] as THREE.Mesh;
    const pole = new THREE.Vector3(0, 1, 0).applyQuaternion(ball.quaternion);
    expect(pole.x).toBeCloseTo(STATION_POLE.x, 6);
    expect(pole.y).toBeCloseTo(STATION_POLE.y, 6);
    expect(pole.z).toBeCloseTo(STATION_POLE.z, 6);
  });

  it("the whole planet turns about the sideways line (x); the ball inside it never turns, and so its baked light stays right", () => {
    const planet = planets[1] as Planet;
    const world = makeStationWorld(planet, 150, 3);
    const ball = world.group.children[0] as THREE.Mesh;
    const before = ball.quaternion.clone();
    const colours = Array.from((ball.geometry.getAttribute("color") as THREE.BufferAttribute).array.slice(0, 600));
    const turned = world.setTime(150, 300);
    expect(turned).toBeCloseTo(Math.PI, 9);
    expect(world.group.rotation.x).toBeCloseTo(startAngle(planet.id) + Math.PI, 9);
    expect(world.group.rotation.y).toBe(0);
    expect(world.group.rotation.z).toBe(0);
    expect(ball.quaternion.equals(before)).toBe(true);
    expect(Array.from((ball.geometry.getAttribute("color") as THREE.BufferAttribute).array.slice(0, 600))).toEqual(colours);
  });

  it("the ground under the station flows along the slot (z), not sideways (x)", () => {
    const planet = planets[2] as Planet;
    const world = makeStationWorld(planet, 150, 3);
    world.group.position.set(0, -158, -20);
    const top = (seconds: number): THREE.Vector3 => {
      world.setTime(seconds, 300);
      world.group.updateMatrixWorld(true);
      return new THREE.Vector3(0, 150, 0).applyMatrix4(world.group.matrixWorld); // a ground point that starts straight below the station
    };
    const a = top(0);
    const b = top(2); // two seconds later
    expect(Math.abs(b.x - a.x)).toBeLessThan(1e-6); // no sideways drift
    expect(b.z - a.z).toBeGreaterThan(0.5); // it comes back towards the camera, as a station flying out of the slot would see
  });

  it("off stands still", () => {
    const planet = planets[3] as Planet;
    const world = makeStationWorld(planet, 150, 3);
    expect(world.setTime(500, 0)).toBe(0);
    expect(world.group.rotation.x).toBeCloseTo(orbitAngles(0, 0, startAngle(planet.id)).angle, 9);
  });
});

describe("3o fix 2: the sky turns with the planet", () => {
  it("no turn: the sky looks the way the camera looks, as before", () => {
    const view = new SkyView();
    const camera = new THREE.PerspectiveCamera(50, 1.5, 0.1, 100);
    camera.quaternion.setFromEuler(new THREE.Euler(0.3, 1.1, 0));
    view.follow(camera);
    expect(view.camera.quaternion.angleTo(camera.quaternion)).toBeCloseTo(0, 6);
  });

  it("a turn of the outside by an angle makes the sky camera look the opposite way about x, and 0 puts it back", () => {
    const view = new SkyView();
    const camera = new THREE.PerspectiveCamera(50, 1.5, 0.1, 100);
    camera.quaternion.setFromEuler(new THREE.Euler(0.3, 1.1, 0));
    view.setTurn(0.5);
    view.follow(camera);
    const want = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.5).multiply(camera.quaternion);
    expect(view.camera.quaternion.angleTo(want)).toBeCloseTo(0, 6);
    expect(view.camera.quaternion.angleTo(camera.quaternion)).toBeCloseTo(0.5, 6);
    view.setTurn(0);
    view.follow(camera);
    expect(view.camera.quaternion.angleTo(camera.quaternion)).toBeCloseTo(0, 6);
  });
});
