// The big planet seen through a station's slot, now able to turn (stage 3o, fix 2). Used by the docked screen and the flight screen,
// so the planet looks the same when you launch. The numbers (turn speed, start place) are in stationspin.ts.

import * as THREE from "three";
import type { Planet } from "../universe";
import { STATION_SUN, spinAngles, spinPhase } from "./stationspin";
import { makePlanetMesh } from "./systemview";

export interface StationWorld {
  /** Put this where the planet's centre is. Its turning axis already points at the sun. */
  group: THREE.Group;
  /** Turns the ground (and the clouds a little more) to where they are `seconds` into the visit. `turnSeconds` 0 = stand still. */
  setTime(seconds: number, turnSeconds: number): void;
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * The planet: lit from its own pole (the sun is over the pole), then the whole ball is tilted so that pole points at the real sun.
 * The light is baked into the colours, and a turn about the pole never moves it, so day and night stay put while the ground slides by.
 */
export function makeStationWorld(planet: Planet, radius: number, detail: number): StationWorld {
  const ball = makePlanetMesh(planet, radius, UP, detail, { rings: false, cloudLift: 0.012 }); // clouds about 2 units up, well under the station
  const group = new THREE.Group();
  group.quaternion.setFromUnitVectors(UP, new THREE.Vector3(STATION_SUN.x, STATION_SUN.y, STATION_SUN.z));
  group.add(ball);
  const clouds = ball.getObjectByName("clouds") ?? null;
  const phase = spinPhase(planet.id);
  const set = (seconds: number, turnSeconds: number): void => {
    const a = spinAngles(seconds, turnSeconds, phase);
    ball.rotation.y = a.ground;
    if (clouds) clouds.rotation.y = a.clouds;
  };
  set(0, 0);
  return { group, setTime: set };
}
