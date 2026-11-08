import { describe, expect, it } from 'vitest';
import {
  clamp,
  dockKindLabel,
  faceShade,
  formatLy,
  hexToNumber,
  nearestScreenPoint,
  orbitCameraPosition,
  orbitDisplayRadius,
  parseSeedParam,
  planetColorMix,
  planetDisplayRadius,
  planetOrbitPosition,
  planetTypeLabel,
  starfieldPositions,
} from '../src/render/helpers';
import { StateStore } from '../src/render/state';

describe('colors and labels', () => {
  it('turns star color text into a number', () => {
    expect(hexToNumber('#ff9a3c')).toBe(0xff9a3c);
    expect(hexToNumber('58a6ff')).toBe(0x58a6ff);
    expect(hexToNumber('nonsense')).toBe(0xffffff);
  });

  it('writes friendly labels', () => {
    expect(planetTypeLabel('GAS')).toBe('Gas giant');
    expect(dockKindLabel('OUTPOST')).toBe('Outpost');
    expect(dockKindLabel('STATION')).toBe('Station');
    expect(formatLy(12.34)).toBe('12.3 ly');
  });
});

describe('seed in the web address', () => {
  it('reads ?seed=NUMBER', () => {
    expect(parseSeedParam('?seed=777', 12345)).toBe(777);
    expect(parseSeedParam('?a=1&seed=42', 12345)).toBe(42);
  });
  it('falls back when missing or not a number', () => {
    expect(parseSeedParam('', 12345)).toBe(12345);
    expect(parseSeedParam('?seed=abc', 12345)).toBe(12345);
  });
});

describe('placing planets', () => {
  it('puts a planet on its orbit circle', () => {
    for (const phase of [0, 0.25, 0.5, 0.9]) {
      const p = planetOrbitPosition(10, phase);
      expect(Math.hypot(p.x, p.z)).toBeCloseTo(10, 6);
    }
    expect(planetOrbitPosition(10, 0).x).toBeCloseTo(10, 6);
  });

  it('spreads orbits so they grow with the planet number', () => {
    let previous = 0;
    for (let i = 0; i < 8; i++) {
      const r = orbitDisplayRadius(i, 0.4 + i * 0.9 + 0.5);
      expect(r).toBeGreaterThan(previous);
      previous = r;
    }
  });

  it('draws gas giants bigger than any other planet', () => {
    expect(planetDisplayRadius('GAS', 5)).toBeGreaterThan(planetDisplayRadius('OCEAN', 2));
    expect(planetDisplayRadius('BARREN', 0.2)).toBeGreaterThan(0.5);
  });
});

describe('camera and picking', () => {
  it('keeps the camera the right distance away', () => {
    const p = orbitCameraPosition(0.7, 0.5, 40);
    expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(40, 6);
  });

  it('clamps numbers', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
  });

  it('finds the nearest point within range, or none', () => {
    const points = [
      { x: 10, y: 10 },
      { x: 50, y: 50 },
      { x: Infinity, y: Infinity },
    ];
    expect(nearestScreenPoint(points, 48, 52, 18)).toBe(1);
    expect(nearestScreenPoint(points, 200, 200, 18)).toBe(-1);
    expect(nearestScreenPoint([], 0, 0, 18)).toBe(-1);
  });
});

describe('flat pixel look helpers', () => {
  it('uses only a few brightness steps, brighter towards the star', () => {
    const steps = new Set([1, 0.6, 0.3, 0, -0.5, -1].map(faceShade));
    expect(steps.size).toBeLessThanOrEqual(4);
    expect(faceShade(1)).toBeGreaterThan(faceShade(-1));
  });

  it('gives surface patches a color mix between 0 and 1', () => {
    const directions: [number, number, number][] = [
      [1, 0, 0],
      [0, 1, 0],
      [0.5, 0.5, 0.7],
      [-0.3, -0.9, 0.2],
    ];
    for (const type of ['ROCKY', 'GAS', 'ICE']) {
      for (const [x, y, z] of directions) {
        const m = planetColorMix(type, x, y, z);
        expect(m).toBeGreaterThanOrEqual(0);
        expect(m).toBeLessThanOrEqual(1);
      }
    }
  });

  it('draws the same starfield every time', () => {
    const a = starfieldPositions(50, 100);
    const b = starfieldPositions(50, 100);
    expect(a).toEqual(b);
    expect(a.length).toBe(150);
    expect(Math.hypot(a[0] ?? 0, a[1] ?? 0, a[2] ?? 0)).toBeCloseTo(100, 3);
  });
});

describe('selection state', () => {
  it('stores and announces changes', () => {
    const store = new StateStore('1:2:3:0');
    expect(store.get().selectedSystemId).toBeNull();
    let heard = 0;
    const stop = store.subscribe(() => {
      heard++;
    });
    store.set({ selectedSystemId: '4:5:6:1' });
    expect(store.get().selectedSystemId).toBe('4:5:6:1');
    expect(store.get().currentSystemId).toBe('1:2:3:0');
    stop();
    store.set({ selectedPlanetId: '4:5:6:1/0' });
    expect(heard).toBe(1);
  });
});
