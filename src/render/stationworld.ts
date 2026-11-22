// The big planet seen through a station's slot, as the station goes round it (stage 3o, fix 2). Used by the docked screen and the flight
// screen, so the planet looks the same when you launch. The numbers (trip time, start place, sun, tilt) are in stationspin.ts.

import * as THREE from "three";
import type { Planet } from "../universe";
import { STATION_POLE, STATION_SUN, orbitAngles, poleYaw, startAngle } from "./stationspin";
import { makePlanetMesh } from "./systemview";

export interface StationWorld {
  /** Put this where the planet's centre is. It turns about the sideways line through that centre, which is the station's trip round. */
  group: THREE.Group;
  /**
   * Puts the planet where it is `seconds` into the visit. `turnSeconds` = seconds for one trip round (0 = stands still).
   * Returns how far the outside has turned since the visit began (radians): the stars and the sky turn by this much too.
   */
  setTime(seconds: number, turnSeconds: number): number;
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * The planet with its pole tilted by the orbit's inclination, and the sun fixed in the same frame as the planet. The light is baked into the
 * colours, which is right because the planet and the sun turn together (the whole group turns, the ball inside it does not).
 */
export function makeStationWorld(planet: Planet, radius: number, detail: number): StationWorld {
  const tilt = new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(STATION_POLE.x, STATION_POLE.y, STATION_POLE.z));
  const ballTurn = tilt.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, poleYaw(planet.id))); // the ground's own facing first, then the tilt
  const sunLocal = new THREE.Vector3(STATION_SUN.x, STATION_SUN.y, STATION_SUN.z).applyQuaternion(ballTurn.clone().invert()); // the sun, as the ball's own ground sees it
  const ball = makePlanetMesh(planet, radius, sunLocal, detail, { rings: false, cloudLift: 0.012 }); // clouds about 2 units up, well under the station
  ball.quaternion.copy(ballTurn);
  const group = new THREE.Group();
  group.add(ball);
  const start = startAngle(planet.id);
  const set = (seconds: number, turnSeconds: number): number => {
    const a = orbitAngles(seconds, turnSeconds, start);
    group.rotation.x = a.angle;
    return a.elapsed;
  };
  set(0, 0);
  return { group, setTime: set };
}
