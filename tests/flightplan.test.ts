import { describe, expect, it } from 'vitest';
import {
  computerLineIndex,
  flashAmount,
  formatCountdown,
  phaseDurations,
  planFlight,
  realTimes,
  type FlightPhase,
  type PhaseSettings,
} from '../src/render/flightplan';
import { COMPUTER_LINES } from '../src/render/flightlines';
import { tunnelStreakData } from '../src/render/helpers';

const S: PhaseSettings = { launchSeconds: 5, approachSeconds: 10, minWarpSeconds: 3 };

/** Plan for a trip of `totalSec` real seconds, `elapsedSec` seconds after take-off. */
function at(elapsedSec: number, totalSec: number) {
  const remaining = (totalSec - elapsedSec) * 1000;
  return planFlight(elapsedSec / totalSec, remaining, totalSec * 1000, S);
}

describe('a normal long trip (90 real seconds)', () => {
  it('launches, warps, then approaches, then is done', () => {
    expect(at(0, 90).phase).toBe('LAUNCH');
    expect(at(2.5, 90).phase).toBe('LAUNCH');
    expect(at(2.5, 90).progress).toBeCloseTo(0.5, 6);
    expect(at(5, 90).phase).toBe('WARP');
    expect(at(40, 90).phase).toBe('WARP');
    expect(at(80, 90).phase).toBe('APPROACH');
    expect(at(85, 90).progress).toBeCloseTo(0.5, 6);
    expect(at(90, 90).phase).toBe('DONE');
  });

  it('starts the approach exactly 10 seconds before the end', () => {
    expect(at(79.9, 90).phase).toBe('WARP');
    expect(at(80.1, 90).phase).toBe('APPROACH');
  });

  it('gives the lengths of the phases', () => {
    const d = phaseDurations(90, S);
    expect(d).toEqual({ launch: 5, warp: 75, approach: 10 });
  });
});

describe('a short trip', () => {
  it('a 20 second trip shows launch (5), warp (5) and approach (10)', () => {
    expect(phaseDurations(20, S)).toEqual({ launch: 5, warp: 5, approach: 10 });
    const seen = new Set<FlightPhase>();
    for (let t = 0; t < 20; t += 0.5) seen.add(at(t, 20).phase);
    expect([...seen]).toEqual(['LAUNCH', 'WARP', 'APPROACH']);
  });

  it('a very short trip is squeezed in proportion but still shows all three phases', () => {
    const d = phaseDurations(6, S);
    expect(d.launch + d.warp + d.approach).toBeCloseTo(6, 6);
    expect(d.launch / d.approach).toBeCloseTo(0.5, 6);
    expect(d.warp / d.launch).toBeCloseTo(3 / 5, 6);
    const seen = new Set<FlightPhase>();
    for (let t = 0; t < 6; t += 0.1) seen.add(at(t, 6).phase);
    expect([...seen]).toEqual(['LAUNCH', 'WARP', 'APPROACH']);
  });
});

describe('opening the page in the middle', () => {
  it('half way through a long trip is warp', () => {
    expect(planFlight(0.5, 45_000, 90_000, S).phase).toBe('WARP');
  });
  it('near the end is approach, with the right progress', () => {
    const plan = planFlight(0.97, 2_000, 90_000, S);
    expect(plan.phase).toBe('APPROACH');
    expect(plan.progress).toBeCloseTo(0.8, 6);
  });
  it('in the first seconds is still launch', () => {
    expect(planFlight(0.01, 89_000, 90_000, S).phase).toBe('LAUNCH');
  });
});

describe('a flight that is already over', () => {
  it('is DONE for fraction 1, nothing left, or nonsense numbers', () => {
    expect(planFlight(1, 0, 90_000, S).phase).toBe('DONE');
    expect(planFlight(0.9, 0, 90_000, S).phase).toBe('DONE');
    expect(planFlight(0, 0, 0, S).phase).toBe('DONE');
    expect(planFlight(Number.NaN, Number.NaN, Number.NaN, S).phase).toBe('DONE');
  });
});

describe('clock speed', () => {
  it('turns game time into real time', () => {
    const three = { fraction: 0.5, remainingMs: 5_400_000, totalMs: 10_800_000 }; // a 3 hour trip
    expect(realTimes(three, 120)).toEqual({ remainingRealMs: 45_000, totalRealMs: 90_000 });
    expect(realTimes(three, 1)).toEqual({ remainingRealMs: 5_400_000, totalRealMs: 10_800_000 });
    expect(realTimes(three, 0)).toEqual({ remainingRealMs: 5_400_000, totalRealMs: 10_800_000 });
  });

  it('the same moment of a trip is a different phase at a different speed', () => {
    // 5 game minutes left of a 3 hour trip:
    const progress = { fraction: 1 - 300 / 10_800, remainingMs: 300_000, totalMs: 10_800_000 };
    const fast = realTimes(progress, 120); // 2.5 real seconds left
    const slow = realTimes(progress, 1); // 5 real minutes left
    expect(planFlight(progress.fraction, fast.remainingRealMs, fast.totalRealMs, S).phase).toBe('APPROACH');
    expect(planFlight(progress.fraction, slow.remainingRealMs, slow.totalRealMs, S).phase).toBe('WARP');
  });

  it('never goes backwards in time order', () => {
    const order: FlightPhase[] = ['LAUNCH', 'WARP', 'APPROACH', 'DONE'];
    let last = 0;
    for (let t = 0; t <= 90; t += 0.25) {
      const index = order.indexOf(at(t, 90).phase);
      expect(index).toBeGreaterThanOrEqual(last);
      last = index;
    }
  });
});

describe('flash, lines and clock text', () => {
  it('flashes into warp and out of it, and not in the middle', () => {
    expect(flashAmount(at(5 - 0.001, 90))).toBeGreaterThan(0.99);
    expect(flashAmount(at(5.0, 90))).toBeGreaterThan(0.9);
    expect(flashAmount(at(40, 90))).toBe(0);
    expect(flashAmount(at(79.9, 90))).toBeGreaterThan(0.7);
    for (let t = 0; t <= 90; t += 0.5) {
      const f = flashAmount(at(t, 90));
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });

  it('changes the computer line every 25 seconds and stays in range', () => {
    const n = COMPUTER_LINES.length;
    expect(n).toBeGreaterThanOrEqual(12);
    expect(computerLineIndex(0, n, 3, 25)).toBe(computerLineIndex(24.9, n, 3, 25));
    expect(computerLineIndex(25, n, 3, 25)).not.toBe(computerLineIndex(24.9, n, 3, 25));
    for (let t = 0; t < 1000; t += 7) {
      const i = computerLineIndex(t, n, 123456, 25);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(n);
    }
  });

  it('writes countdowns', () => {
    expect(formatCountdown(83_000)).toBe('1:23');
    expect(formatCountdown(3_661_000)).toBe('1:01:01');
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(-5)).toBe('0:00');
  });
});

describe('warp tunnel data', () => {
  it('makes the same streaks every time, inside the tube', () => {
    const a = tunnelStreakData(40, 120, 3, 15, 4, 10);
    const b = tunnelStreakData(40, 120, 3, 15, 4, 10);
    expect(a.positions).toEqual(b.positions);
    expect(a.positions.length).toBe(240);
    expect(a.tints.length).toBe(40);
    for (let i = 0; i < 40; i++) {
      const x = a.positions[i * 6] ?? 0;
      const y = a.positions[i * 6 + 1] ?? 0;
      expect(Math.hypot(x, y)).toBeGreaterThanOrEqual(2.99);
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(15.01);
      expect(a.tints[i] ?? 9).toBeLessThan(4);
    }
  });
});
