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
  exitDistance,
  arrivalShakeAmount,
  chaseBlend,
  exitProgressForDistance,
  stationEntryState,
  stationEntryTransform,
  outpostExitDistance,
  outpostExitHeading,
  outpostExitPose,
  shakeAmount,
  shakeOffset,
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
import { DOCKED_BAY_MARGIN, OUTPOST_EXIT, STATION_ENTRY, STATION_EXIT } from '../src/render/settings';

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
  const e = STATION_EXIT;
  const r0 = 180; // planet radius 150 + altitude 30
  const centre = stationPlanetCentre(150, 30, e.straight);
  const away = (p: number): number => {
    const pose = stationExitPose(p, r0, e);
    return Math.hypot(pose.pos.y - centre.y, pose.pos.z - centre.z);
  };
  it('starts in the bay and goes straight out of the slot first', () => {
    const start = stationExitPose(0, r0, e);
    expect(start.slide).toBe(0);
    expect(start.pitch).toBe(0);
    expect(Math.abs(start.pos.z)).toBe(0);
    const early = stationExitPose(0.2, r0, e); // 2 seconds in: still inside the bay, straight
    expect(early.pitch).toBe(0);
    expect(Math.abs(early.pos.y)).toBeLessThan(1e-9);
    expect(early.pos.z).toBeLessThan(-3);
    expect(early.pos.z).toBeGreaterThan(-12); // a slow start: under 12 units in the first 2 seconds
  });
  it('turns slowly towards the planet, more and more, and stops turning at the end of the curve', () => {
    let last = -1;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const pose = stationExitPose(p, r0, e);
      expect(pose.pitch).toBeGreaterThan(last - 1e-12);
      last = pose.pitch;
    }
    expect(last).toBeGreaterThan(0.5);
    expect(last).toBeLessThan(1.5);
    expect(stationExitPose(0.8, r0, e).pitch).toBeCloseTo(stationExitPose(1, r0, e).pitch, 9);
  });
  it('keeps the orbit getting wider (the turn rate falls)', () => {
    const rate = (s: number): number => exitPitch(s + 1, r0, e) - exitPitch(s, r0, e);
    expect(rate(30)).toBeGreaterThan(rate(100));
    expect(rate(100)).toBeGreaterThan(rate(250));
  });
  it('flies faster and faster', () => {
    let lastStep = 0;
    let last = stationExitPose(0, r0, e).slide;
    for (let p = 0.05; p <= 1.0001; p += 0.05) {
      const now = stationExitPose(p, r0, e).slide;
      expect(now - last).toBeGreaterThan(lastStep - 1e-9);
      lastStep = now - last;
      last = now;
    }
    expect(last).toBeGreaterThan(2000);
  });
  it('never touches the planet and ends far away from it (a dot)', () => {
    for (let p = 0; p <= 1.0001; p += 0.02) expect(away(p)).toBeGreaterThan(150);
    expect(away(1)).toBeGreaterThan(2000); // far away: the planet is small and far behind
  });
  it('puts the planet straight below the station so the slot points along its surface', () => {
    const c = stationPlanetCentre(300, 30, 20);
    expect(c.x).toBe(0);
    expect(c.y).toBe(-330);
    expect(c.z).toBe(-20);
  });
  it('moves the station so the ship ends up at its place', () => {
    for (const p of [0.3, 0.8, 1]) {
      const pose = stationExitPose(p, r0, e);
      const t = stationExitTransform(pose);
      const c = Math.cos(t.rotX);
      const s = Math.sin(t.rotX);
      const landed = { y: pose.pos.y * c - pose.pos.z * s + t.position.y, z: pose.pos.y * s + pose.pos.z * c + t.position.z };
      expect(Math.abs(landed.y)).toBeLessThan(1e-6);
      expect(Math.abs(landed.z)).toBeLessThan(1e-6);
    }
  });
});

describe('the speed of leaving a station', () => {
  const e = STATION_EXIT;
  it('takes its time to leave the bay: not out of the slot before 3 seconds', () => {
    expect(exitDistance(0.3 * 0.99, e)).toBeLessThan(e.straight); // just under 3 seconds
    expect(exitDistance(0.45, e)).toBeGreaterThan(e.straight); // 4.5 seconds: out
  });
  it('is gentle at first: under 20 units per second for the first 4 seconds', () => {
    for (let t = 0; t < 4; t += 0.25) {
      const v = (exitDistance((t + 0.25) / e.seconds, e) - exitDistance(t / e.seconds, e)) / 0.25;
      expect(v).toBeLessThan(e.slowSpeed + 0.01);
    }
  });
  it('has no jump in speed where the gentle part ends', () => {
    const k = e.slowSeconds / e.seconds;
    const before = (exitDistance(k, e) - exitDistance(k - 0.001, e)) / 0.001;
    const after = (exitDistance(k + 0.001, e) - exitDistance(k, e)) / 0.001;
    expect(Math.abs(after - before) / before).toBeLessThan(0.02);
  });
  it('goes faster and faster up to the end', () => {
    let lastSpeed = 0;
    for (let t = 0; t < 9.5; t += 0.5) {
      const v = exitDistance((t + 0.5) / e.seconds, e) - exitDistance(t / e.seconds, e);
      expect(v).toBeGreaterThan(lastSpeed - 1e-9);
      lastSpeed = v;
    }
  });
});

describe('camera shake before the jump', () => {
  it('only shakes during the launch, building up to full at the flash', () => {
    expect(shakeAmount('WARP', 0.9, 0.5)).toBe(0);
    expect(shakeAmount('APPROACH', 0.9, 0.5)).toBe(0);
    expect(shakeAmount('LAUNCH', 0.2, 0.5)).toBe(0);
    expect(shakeAmount('LAUNCH', 0.8, 0.5)).toBeCloseTo(1, 9);
    expect(shakeAmount('LAUNCH', 0.65, 0.5)).toBeGreaterThan(0);
    expect(shakeAmount('LAUNCH', 0.65, 0.5)).toBeLessThan(1);
  });
  it('stays small and never explodes', () => {
    for (let t = 0; t < 5; t += 0.013) {
      const o = shakeOffset(t, 0.1);
      expect(Math.abs(o.x)).toBeLessThanOrEqual(0.1);
      expect(Math.abs(o.y)).toBeLessThanOrEqual(0.1);
      expect(Math.abs(o.z)).toBeLessThanOrEqual(0.1);
    }
    expect(Math.abs(shakeOffset(1.234, 0).x)).toBe(0);
  });
});

describe('leaving an outpost', () => {
  const e = OUTPOST_EXIT;
  const R = 150; // the planet under the pad
  const centreY = -R - 0.5;
  const pose = (p: number) => outpostExitPose(p, e);
  const away = (p: number): number => Math.hypot(pose(p).pos.y - centreY, pose(p).pos.z);

  it('starts on the pad, slowly: very little distance in the first second', () => {
    expect(pose(0).slide).toBe(0);
    expect(outpostExitDistance(0.1, e)).toBeLessThan(3); // 1 second
    expect(outpostExitHeading(1, e)).toBe(0); // still level: the lift starts flat
  });
  it('tilts up gradually, then holds an angled line, then curves down into the orbit', () => {
    expect(outpostExitHeading(30, e)).toBeCloseTo(e.tilt, 9);
    expect(outpostExitHeading(e.curveStart, e)).toBeCloseTo(e.tilt, 9);
    let last = -1;
    for (let s = 0; s <= e.tiltEnd; s += 1) {
      const h = outpostExitHeading(s, e);
      expect(h).toBeGreaterThan(last - 1e-12);
      last = h;
    }
    expect(outpostExitHeading(400, e)).toBeLessThan(e.tilt);
    expect(outpostExitHeading(e.curveEnd, e)).toBeGreaterThan(-1);
    expect(outpostExitHeading(e.curveEnd + 3000, e)).toBeCloseTo(outpostExitHeading(e.curveEnd, e), 9); // no more turning after the curve
  });
  it('speeds up a little, then more, then the angled line, then faster and faster, with no jumps in speed', () => {
    const v = (t: number): number => (outpostExitDistance((t + 0.01) / e.seconds, e) - outpostExitDistance(t / e.seconds, e)) / 0.01;
    for (const t of [e.t1, e.t2, e.t3]) {
      expect(Math.abs(v(t + 0.02) - v(t - 0.02)) / v(t)).toBeLessThan(0.15);
    }
    expect(v(2)).toBeGreaterThan(v(1));
    expect(v(3.6)).toBeGreaterThan(v(3.1));
    expect(v(8)).toBeGreaterThan(v(6.5));
    expect(v(9.5)).toBeGreaterThan(v(8));
  });
  it('goes up and forward, never below the pad, and never into the planet', () => {
    for (let p = 0; p <= 1.0001; p += 0.02) {
      if (p <= 0.85) expect(pose(p).pos.y).toBeGreaterThan(-1e-9); // up until the flash
      expect(away(p)).toBeGreaterThan(R);
    }
  });
  it('is flying away from the planet at the end (further every moment)', () => {
    let last = 0;
    for (let p = 0.7; p <= 1.0001; p += 0.05) {
      expect(away(p)).toBeGreaterThan(last);
      last = away(p);
    }
    expect(away(0.8)).toBeGreaterThan(500);
  });
  it('turns the dock the right way: the ship ends up at its place', () => {
    for (const p of [0.2, 0.5, 0.9]) {
      const q = pose(p);
      const t = stationExitTransform(q);
      const c = Math.cos(t.rotX);
      const s = Math.sin(t.rotX);
      expect(Math.abs(q.pos.y * c - q.pos.z * s + t.position.y)).toBeLessThan(1e-6);
      expect(Math.abs(q.pos.y * s + q.pos.z * c + t.position.z)).toBeLessThan(1e-6);
    }
  });
});

describe('arriving at a station (the departure backwards, slower)', () => {
  const r0 = 180;
  const state = (p: number) => stationEntryState(p, r0, STATION_EXIT, STATION_ENTRY);
  it('drops out of warp fairly close to the station, not at the far end of the departure', () => {
    expect(state(0).pose.slide).toBeGreaterThan(STATION_ENTRY.startDistance * 0.98);
    expect(state(0).pose.slide).toBeLessThan(STATION_ENTRY.startDistance * 1.02);
    expect(exitProgressForDistance(5, STATION_EXIT)).toBeGreaterThan(0);
    expect(exitDistance(exitProgressForDistance(300, STATION_EXIT), STATION_EXIT)).toBeCloseTo(300, 3);
  });
  it('ends exactly parked, facing the opening', () => {
    const end = state(1);
    expect(Math.abs(end.pose.slide)).toBeLessThan(1e-9);
    expect(end.yaw).toBeCloseTo(0, 9);
    const t = stationEntryTransform(end);
    expect(Math.abs(t.position.x) + Math.abs(t.position.y) + Math.abs(t.position.z)).toBeLessThan(1e-6);
    expect(Math.abs(t.rotX)).toBeLessThan(1e-9);
  });
  it('flies in nose-first (half turn off) and slows down all the way in', () => {
    let last = 1e9;
    for (let p = 0; p <= STATION_ENTRY.pathShare + 1e-9; p += 0.05) {
      expect(state(p).yaw).toBeCloseTo(Math.PI, 9);
      expect(state(p).pose.slide).toBeLessThan(last + 1e-9);
      last = state(p).pose.slide;
    }
  });
  it('is slower than the departure was: it takes the whole approach to cover less ground', () => {
    // the arrival speed at the start (units per share of the approach) is lower than the departure speed at its end
    const arrive = state(0).pose.slide - state(0.01).pose.slide;
    const depart = exitDistance(1, STATION_EXIT) - exitDistance(0.99, STATION_EXIT);
    expect(arrive).toBeLessThan(depart);
  });
  it('is stopped in the bay when it turns round, and turns smoothly to face the opening', () => {
    expect(Math.abs(state(STATION_ENTRY.pathShare).pose.slide)).toBeLessThan(1e-9);
    let yaw = Math.PI + 1e-9;
    for (let p = STATION_ENTRY.pathShare; p <= 1.0001; p += 0.01) {
      expect(state(p).yaw).toBeLessThanOrEqual(yaw);
      yaw = state(p).yaw;
    }
    expect(state(STATION_ENTRY.turnEnd).yaw).toBeCloseTo(0, 9);
  });
  it('eases the camera in slowly from the orbit camera', () => {
    expect(chaseBlend(0, 0.3)).toBe(0);
    expect(chaseBlend(0.3, 0.3)).toBe(1);
    expect(chaseBlend(0.05, 0.3)).toBeLessThan(0.1);
    expect(chaseBlend(0.15, 0.3)).toBeCloseTo(0.5, 6);
  });
  it('shakes hard as the ship drops out of warp and calms down', () => {
    expect(arrivalShakeAmount(0, 1.8)).toBe(1);
    expect(arrivalShakeAmount(0.9, 1.8)).toBeCloseTo(0.5, 6);
    expect(arrivalShakeAmount(1.8, 1.8)).toBe(0);
    expect(arrivalShakeAmount(10, 1.8)).toBe(0);
  });
});
