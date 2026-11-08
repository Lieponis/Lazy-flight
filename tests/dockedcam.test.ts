import { describe, expect, it } from 'vitest';
import {
  camPosition,
  defaultDockedCam,
  degToRad,
  driftCam,
  pinchFactor,
  rotateCam,
  wheelFactor,
  wrapAngle,
  zoomCam,
  type CamLimits,
} from '../src/render/dockedcam';
import {
  DOCKED_ANGLE_MAX_DEG,
  DOCKED_ANGLE_MIN_DEG,
  DOCKED_CAMERA_ANGLE_DEG,
  DOCKED_CAMERA_DISTANCE,
  DOCKED_ZOOM_MAX,
  DOCKED_ZOOM_MIN,
} from '../src/render/settings';

const LIMITS: CamLimits = {
  minDist: DOCKED_ZOOM_MIN,
  maxDist: DOCKED_ZOOM_MAX,
  minPitch: degToRad(DOCKED_ANGLE_MIN_DEG),
  maxPitch: degToRad(DOCKED_ANGLE_MAX_DEG),
};

describe('docked camera: starting position', () => {
  it('starts at the angle and distance from the settings', () => {
    const cam = defaultDockedCam(DOCKED_CAMERA_ANGLE_DEG, DOCKED_CAMERA_DISTANCE, LIMITS);
    expect(cam.pitch).toBeCloseTo(degToRad(DOCKED_CAMERA_ANGLE_DEG), 6);
    expect(cam.dist).toBe(DOCKED_CAMERA_DISTANCE);
  });

  it('looks down at the ship from above', () => {
    const cam = defaultDockedCam(DOCKED_CAMERA_ANGLE_DEG, DOCKED_CAMERA_DISTANCE, LIMITS);
    const p = camPosition(cam, { x: 0, y: 0, z: 0 });
    expect(p.y).toBeGreaterThan(0);
    expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(DOCKED_CAMERA_DISTANCE, 6);
  });

  it('keeps silly settings inside the limits', () => {
    const cam = defaultDockedCam(200, 5000, LIMITS);
    expect(cam.pitch).toBeCloseTo(LIMITS.maxPitch, 6);
    expect(cam.dist).toBe(LIMITS.maxDist);
  });

  it('puts the camera around a target point, not around the middle', () => {
    const cam = defaultDockedCam(30, 10, LIMITS);
    const a = camPosition(cam, { x: 0, y: 0, z: 0 });
    const b = camPosition(cam, { x: 5, y: 1, z: -2 });
    expect(b.x - a.x).toBeCloseTo(5, 6);
    expect(b.y - a.y).toBeCloseTo(1, 6);
    expect(b.z - a.z).toBeCloseTo(-2, 6);
  });
});

describe('docked camera: dragging', () => {
  it('turns with sideways drags and tilts with up and down drags', () => {
    const cam = defaultDockedCam(30, 14, LIMITS);
    const right = rotateCam(cam, 50, 0, LIMITS);
    expect(right.yaw).not.toBe(cam.yaw);
    expect(right.pitch).toBe(cam.pitch);
    const down = rotateCam(cam, 0, 10, LIMITS);
    expect(down.pitch).toBeGreaterThan(cam.pitch);
    expect(down.yaw).toBe(cam.yaw);
  });

  it('never tilts past the lowest or highest angle', () => {
    const cam = defaultDockedCam(30, 14, LIMITS);
    expect(rotateCam(cam, 0, 100000, LIMITS).pitch).toBeCloseTo(LIMITS.maxPitch, 6);
    expect(rotateCam(cam, 0, -100000, LIMITS).pitch).toBeCloseTo(LIMITS.minPitch, 6);
  });
});

describe('docked camera: zoom', () => {
  it('zooms in and out but stays within the limits', () => {
    const cam = defaultDockedCam(30, 14, LIMITS);
    expect(zoomCam(cam, 0.5, LIMITS).dist).toBeCloseTo(7, 6);
    expect(zoomCam(cam, 0.0001, LIMITS).dist).toBe(LIMITS.minDist);
    expect(zoomCam(cam, 1000, LIMITS).dist).toBe(LIMITS.maxDist);
    expect(zoomCam(cam, Number.NaN, LIMITS).dist).toBe(14);
  });

  it('scrolling down zooms out, scrolling up zooms in', () => {
    expect(wheelFactor(100)).toBeGreaterThan(1);
    expect(wheelFactor(-100)).toBeLessThan(1);
  });

  it('spreading two fingers zooms in', () => {
    expect(pinchFactor(100, 200)).toBeLessThan(1);
    expect(pinchFactor(200, 100)).toBeGreaterThan(1);
    expect(pinchFactor(0, 100)).toBe(1);
  });
});

describe('docked camera: slow drift', () => {
  it('turns a little every frame and never changes angle or distance', () => {
    const cam = defaultDockedCam(30, 14, LIMITS);
    const next = driftCam(cam, 1, 0.04);
    expect(next.yaw).toBeCloseTo(cam.yaw + 0.04, 6);
    expect(next.pitch).toBe(cam.pitch);
    expect(next.dist).toBe(cam.dist);
  });

  it('keeps the turn angle tidy after many circles', () => {
    let cam = defaultDockedCam(30, 14, LIMITS);
    for (let i = 0; i < 5000; i++) cam = driftCam(cam, 0.1, 0.5);
    expect(cam.yaw).toBeGreaterThanOrEqual(-Math.PI);
    expect(cam.yaw).toBeLessThan(Math.PI);
    expect(wrapAngle(7)).toBeCloseTo(7 - 2 * Math.PI, 6);
  });
});
