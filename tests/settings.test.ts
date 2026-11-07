import { describe, expect, it } from 'vitest';
import { BACKGROUND_COLOR, RENDER_HEIGHT, RENDER_WIDTH } from '../src/settings';

describe('render settings', () => {
  it('uses whole-number pixel sizes', () => {
    expect(Number.isInteger(RENDER_WIDTH)).toBe(true);
    expect(Number.isInteger(RENDER_HEIGHT)).toBe(true);
    expect(RENDER_WIDTH).toBeGreaterThan(0);
    expect(RENDER_HEIGHT).toBeGreaterThan(0);
  });

  it('keeps the picture 16:9', () => {
    expect(RENDER_WIDTH / RENDER_HEIGHT).toBeCloseTo(16 / 9, 1);
  });

  it('has a valid background colour', () => {
    expect(BACKGROUND_COLOR).toBeGreaterThanOrEqual(0);
    expect(BACKGROUND_COLOR).toBeLessThanOrEqual(0xffffff);
  });
});
