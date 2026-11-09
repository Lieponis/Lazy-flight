import { describe, expect, it } from 'vitest';
import {
  FALLBACK_SHIP_ID,
  SHIP_MODEL_IDS,
  approachCameraBlend,
  approachOffset,
  bayBoxWorld,
  camFromPoint,
  clampToBox,
  flameLength,
  insideBox,
  launchCameraBlend,
  launchOffset,
  outpostFraming,
  outpostModelFor,
  parseShipParam,
  relativeToParking,
  resolveShipId,
  rotateY,
  stationExitPose,
  stationExitTransform,
  stationModelFor,
  stationPlanetCentre,
  exitPitch,
} from '../src/render/integration';
import { OUTPOST_IDS, STATION_IDS } from '../src/render/assets/pickers';
import { BAY_SIZE, FLAME_FLYING, FLAME_PARKED, FLAME_WARP } from '../src/render/assets/style';
import { camPosition } from '../src/render/dockedcam';
import { DOCKED_BAY_MARGIN } from '../src/render/settings';

describe('which ship is drawn', () => {
  it('uses the ids of the three ship designs', () => {
    expect(SHIP_MODEL_IDS.length).toBe(3);
    expect(resolveShipId('scout')).toBe('scout');
    expect(resolveShipId('passenger-liner')).toBe('passenger-liner');
    expect(resolveShipId('cargo-hauler')).toBe('cargo-hauler');
  });
  it('falls back to the Cargo Hauler for anything unknown', () => {
    expect(FALLBACK_SHIP_ID).toBe('cargo-hauler');
    expect(resolveShipId('spaceship-9000')).toBe('cargo-hauler');
    expect(resolveShipId('')).toBe('cargo-hauler');
    expect(resolveShipId(null)).toBe('cargo-hauler');
    expect(resolveShipId(undefined)).toBe('cargo-hauler');
  });
  it('lets the ?ship= testing aid win, but only for real ships', () => {
    expect(resolveShipId('cargo-hauler', 'scout')).toBe('scout');
    expect(resolveShipId('scout', 'nonsense')).toBe('scout');
    expect(resolveShipId('nonsense', null)).toBe('cargo-hauler');
  });
  it('reads ?ship=NAME from the web address', () => {
    expect(parseShipParam('?ship=scout')).toBe('scout');
    expect(parseShipParam('?speed=120&ship=passenger-liner')).toBe('passenger-liner');
    expect(parseShipParam('?ship=banana')).toBeNull();
    expect(parseShipParam('')).toBeNull();
    expect(parseShipParam('?speed=120')).toBeNull();
  });
});

describe('which dock design a dock gets', () => {
  const docks = ['1:2:3:0/0', '1:2:3:0/1', '4:5:6:1/2', '-3:0:7:2/1', '9:9:9:3/4', '0:0:0:0/0'];
  it('gives the same design every time', () => {
    for (const id of docks) {
      expect(outpostModelFor(id, 'ROCKY')).toBe(outpostModelFor(id, 'ROCKY'));
      expect(stationModelFor(id)).toBe(stationModelFor(id));
    }
  });
  it('always picks a real design', () => {
    for (const id of docks) {
      expect(OUTPOST_IDS.indexOf(outpostModelFor(id, 'ICE'))).toBeGreaterThanOrEqual(0);
      expect(STATION_IDS.indexOf(stationModelFor(id))).toBeGreaterThanOrEqual(0);
    }
  });
  it('uses more than one design across many docks', () => {
    const outposts = new Set<string>();
    const stations = new Set<string>();
    for (let i = 0; i < 60; i++) {
      outposts.add(outpostModelFor(`${i}:${i * 3}:${i % 7}:0/${i % 5}`, 'ROCKY'));
      stations.add(stationModelFor(`${i}:${i * 3}:${i % 7}:0/${i % 5}`));
    }
    expect(outposts.size).toBeGreaterThan(1);
    expect(stations.size).toBeGreaterThan(1);
  });
});

describe('the station bay', () => {
  // The numbers of a real station: parking at the floor middle, the mouth 7 in front of it.
  const parking = { x: 0, y: -BAY_SIZE.height / 2, z: 0 };
  const entrance = { x: 0, y: 0, z: -7 };
  const box = bayBoxWorld(entrance, parking);

  it('puts the floor at height 0 and the mouth in front of the ship', () => {
    expect(box.min.y).toBe(0);
    expect(box.max.y).toBe(BAY_SIZE.height);
    expect(box.min.z).toBe(-7);
    expect(box.max.z).toBe(-7 + BAY_SIZE.depth);
    expect(box.min.x).toBe(-BAY_SIZE.width / 2);
    expect(box.max.x).toBe(BAY_SIZE.width / 2);
    expect(insideBox({ x: 0, y: 1, z: 0 }, box)).toBe(true);
  });

  it('moves anchors so the parking spot is the middle', () => {
    const p = relativeToParking({ x: 4.2, y: 2.8, z: 6 }, { x: 0, y: -3.25, z: 0 });
    expect(p.x).toBe(4.2);
    expect(p.y).toBeCloseTo(6.05, 6);
    expect(p.z).toBe(6);
  });

  it('keeps the camera inside, away from the walls', () => {
    const far = clampToBox({ x: 50, y: 50, z: 50 }, box, DOCKED_BAY_MARGIN);
    expect(far.x).toBeCloseTo(BAY_SIZE.width / 2 - DOCKED_BAY_MARGIN, 6);
    expect(far.y).toBeCloseTo(BAY_SIZE.height - DOCKED_BAY_MARGIN, 6);
    expect(far.z).toBeCloseTo(-7 + BAY_SIZE.depth - DOCKED_BAY_MARGIN, 6);
    const low = clampToBox({ x: -50, y: -50, z: -50 }, box, DOCKED_BAY_MARGIN);
    expect(low.y).toBeCloseTo(DOCKED_BAY_MARGIN, 6);
    expect(low.z).toBeCloseTo(-7 + DOCKED_BAY_MARGIN, 6);
    expect(insideBox(far, box, DOCKED_BAY_MARGIN - 1e-9)).toBe(true);
    expect(insideBox(low, box, DOCKED_BAY_MARGIN - 1e-9)).toBe(true);
  });

  it('leaves a point that is already inside alone', () => {
    const p = { x: 1, y: 2, z: 3 };
    expect(clampToBox(p, box, DOCKED_BAY_MARGIN)).toEqual(p);
  });

  it('keeps every drag and zoom position inside the bay', () => {
    const target = { x: 0, y: 1, z: 0 };
    for (let yaw = -3.1; yaw <= 3.1; yaw += 0.4) {
      for (const pitch of [0.31, 0.6, 1.1]) {
        for (const dist of [4.5, 6.5, 9]) {
          const c = clampToBox(camPosition({ yaw, pitch, dist }, target), box, DOCKED_BAY_MARGIN);
          expect(insideBox(c, box, DOCKED_BAY_MARGIN - 1e-9)).toBe(true);
        }
      }
    }
  });

  it('turns the design\'s camera spot into starting camera numbers', () => {
    const target = { x: 0, y: 1, z: 0 };
    const start = camFromPoint({ x: 4.2, y: 6.05, z: 5.6 }, target);
    const back = camPosition(start, target);
    expect(back.x).toBeCloseTo(4.2, 5);
    expect(back.y).toBeCloseTo(6.05, 5);
    expect(back.z).toBeCloseTo(5.6, 5);
  });
});

describe('framing an outpost', () => {
  it('looks between the ship and the buildings and fits them in', () => {
    const f = outpostFraming({ x: -5, y: 0, z: -7 }, { x: 15, y: 5, z: 7 }, 6, 40);
    expect(f.target.x).toBeCloseTo(2.75, 6);
    expect(f.dist).toBeGreaterThan(11.9);
    expect(f.dist).toBeLessThanOrEqual(30);
    expect(f.maxDist).toBeGreaterThanOrEqual(f.dist);
    expect(f.maxDist).toBeGreaterThanOrEqual(40);
  });
});

describe('flight: where the docks are', () => {
  const far = { y: 240, z: 260 };
  it('starts the launch exactly in the dock', () => {
    const o = launchOffset(0, far);
    expect(Math.abs(o.x)).toBe(0);
    expect(Math.abs(o.y)).toBe(0);
    expect(Math.abs(o.z)).toBe(0);
  });
  it('slides the dock back and down during the launch', () => {
    const half = launchOffset(0.5, far);
    expect(half.z).toBeGreaterThan(0);
    expect(half.y).toBeLessThan(0);
    expect(launchOffset(1, far).z).toBe(260);
    expect(launchOffset(0.9, far).z).toBeGreaterThan(launchOffset(0.5, far).z);
  });
  it('ends the approach exactly in the dock', () => {
    const end = approachOffset(1, { y: 60, z: 200 });
    expect(end.x).toBe(0);
    expect(Math.abs(end.y)).toBeCloseTo(0, 9);
    expect(Math.abs(end.z)).toBeCloseTo(0, 9);
  });
  it('starts the approach far ahead and comes closer all the time', () => {
    const from = { y: 60, z: 200 };
    expect(approachOffset(0, from).z).toBe(-200);
    let last = -1e9;
    for (let p = 0; p <= 1.0001; p += 0.1) {
      const z = approachOffset(p, from).z;
      expect(z).toBeGreaterThan(last - 1e-9);
      last = z;
    }
  });
  it('turns a point round the up axis', () => {
    const v = rotateY({ x: 3, y: 2, z: 4 }, Math.PI);
    expect(v.x).toBeCloseTo(-3, 9);
    expect(v.y).toBe(2);
    expect(v.z).toBeCloseTo(-4, 9);
  });
});

describe('flight: engine flames', () => {
  it('is short when parked, 1 flying, 3 in warp', () => {
    expect(flameLength('LAUNCH', 0, 0)).toBeCloseTo(FLAME_PARKED, 6);
    expect(flameLength('LAUNCH', 0.7, 0)).toBeCloseTo(FLAME_FLYING, 6);
    expect(flameLength('LAUNCH', 1, 0)).toBeCloseTo(FLAME_WARP, 6);
    expect(flameLength('WARP', 0.5, 0)).toBeCloseTo(FLAME_WARP, 6);
    expect(flameLength('APPROACH', 0, 0)).toBeCloseTo(FLAME_WARP, 6);
    expect(flameLength('APPROACH', 1, 0)).toBeCloseTo(FLAME_PARKED, 6);
    expect(flameLength('DONE', 1, 0)).toBeCloseTo(FLAME_PARKED, 6);
  });
  it('flickers a little in warp but stays long', () => {
    for (let t = 0; t < 2; t += 0.07) {
      expect(flameLength('WARP', 0.5, t)).toBeGreaterThan(FLAME_WARP - 0.25);
      expect(flameLength('WARP', 0.5, t)).toBeLessThan(FLAME_WARP + 0.25);
    }
  });
});

describe('flight: camera inside a station bay', () => {
  it('stays inside the bay at the start of a launch and swings out once the station is clear', () => {
    expect(launchCameraBlend(0)).toBe(0);
    expect(launchCameraBlend(12)).toBe(0);
    expect(launchCameraBlend(40)).toBe(1);
    expect(launchCameraBlend(19)).toBeGreaterThan(0);
    expect(launchCameraBlend(19)).toBeLessThan(1);
  });
  it('is fully inside the bay before the arriving station reaches the ship', () => {
    expect(approachCameraBlend(200)).toBe(0);
    expect(approachCameraBlend(60)).toBe(0);
    expect(approachCameraBlend(30)).toBe(1);
    expect(approachCameraBlend(0)).toBe(1);
  });
});

describe('leaving a station along the planet', () => {
  const e = { distance: 260, straight: 20, growth: 0.5 };
  const r0 = 330;
  it('starts in the bay and goes straight out of the slot first', () => {
    const start = stationExitPose(0, r0, e);
    expect(start.slide).toBe(0);
    expect(start.pitch).toBe(0);
    expect(Math.abs(start.pos.z)).toBe(0);
    // Early in the launch (before the straight part ends) the ship has not turned at all and has not left the height of the floor.
    const early = stationExitPose(0.25, r0, e); // 260 * 0.0625 = 16 units
    expect(early.pitch).toBe(0);
    expect(Math.abs(early.pos.y)).toBeLessThan(1e-9);
    expect(early.pos.z).toBeLessThan(-15);
  });
  it('then turns slowly towards the planet, more and more, but never a full circle', () => {
    let last = -1;
    for (let p = 0; p <= 1.0001; p += 0.1) {
      const pose = stationExitPose(p, r0, e);
      expect(pose.pitch).toBeGreaterThan(last - 1e-12);
      last = pose.pitch;
    }
    expect(last).toBeGreaterThan(0.1);
    expect(last).toBeLessThan(1.5);
  });
  it('keeps the orbit getting wider (the turn rate falls)', () => {
    const rate = (s: number): number => exitPitch(s + 1, r0, e) - exitPitch(s, r0, e);
    expect(rate(30)).toBeGreaterThan(rate(100));
    expect(rate(100)).toBeGreaterThan(rate(250));
  });
  it('stays above the planet all the way', () => {
    const centre = stationPlanetCentre(300, 30, e.straight);
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const pose = stationExitPose(p, r0, e);
      const d = Math.hypot(pose.pos.y - centre.y, pose.pos.z - centre.z);
      expect(d).toBeGreaterThan(300);
    }
  });
  it('puts the planet straight below the station so the slot points along its surface', () => {
    const c = stationPlanetCentre(300, 30, 20);
    expect(c.x).toBe(0);
    expect(c.y).toBe(-330);
    expect(c.z).toBe(-20);
  });
  it('moves the station so the ship ends up at its place', () => {
    const pose = stationExitPose(0.8, r0, e);
    const t = stationExitTransform(pose);
    // Turn the ship's place by the same angle and move: it must land on the origin (where the ship is).
    const c = Math.cos(t.rotX);
    const s = Math.sin(t.rotX);
    const landed = { y: pose.pos.y * c - pose.pos.z * s + t.position.y, z: pose.pos.y * s + pose.pos.z * c + t.position.z };
    expect(Math.abs(landed.y)).toBeLessThan(1e-9);
    expect(Math.abs(landed.z)).toBeLessThan(1e-9);
  });
});
