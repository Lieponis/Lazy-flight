// THE BACK-DROP DOTS' SHAPE AND CLEAN-UP (prototype G2). Pure maths, no Three.js.
//
// Plain words: the dots of the galaxy back-drop (skydots.ts) are NOT real systems and cannot be selected. A dot must never sit
// on top of a real near star, so `removeNearOverlaps` drops dots that share a small patch of sky with a real star.

export interface FaintStars {
  count: number;
  /** Unit direction of each star (x, y, z), as seen from the player. */
  dirs: Float32Array;
  /** Colour and brightness of each star (red, green, blue, each 0..1). */
  colors: Float32Array;
}

/**
 * Removes faint stars that sit (as seen from the player) in the same small patch of sky as a real near star, so a fake dot
 * never sits on top of a real system. `nearDirs` holds unit directions (x, y, z) of the real stars that are drawn.
 * `cellDeg` is the size of the patch in degrees.
 */
export function removeNearOverlaps(stars: FaintStars, nearDirs: Float32Array, cellDeg: number): FaintStars {
  const cells = Math.max(8, Math.round(360 / cellDeg));
  const key = (x: number, y: number, z: number): number => {
    const lon = Math.atan2(z, x);
    const lat = Math.asin(Math.max(-1, Math.min(1, y)));
    const a = Math.min(cells - 1, Math.floor(((lon + Math.PI) / (2 * Math.PI)) * cells));
    const b = Math.min(cells / 2 - 1, Math.floor(((lat + Math.PI / 2) / Math.PI) * (cells / 2)));
    return a * cells + b;
  };
  const taken = new Set<number>();
  for (let i = 0; i + 2 < nearDirs.length; i += 3) taken.add(key(nearDirs[i] ?? 0, nearDirs[i + 1] ?? 0, nearDirs[i + 2] ?? 0));
  const keepDirs: number[] = [];
  const keepColors: number[] = [];
  for (let s = 0; s < stars.count; s++) {
    const x = stars.dirs[s * 3] ?? 0;
    const y = stars.dirs[s * 3 + 1] ?? 0;
    const z = stars.dirs[s * 3 + 2] ?? 0;
    if (taken.has(key(x, y, z))) continue;
    keepDirs.push(x, y, z);
    keepColors.push(stars.colors[s * 3] ?? 0, stars.colors[s * 3 + 1] ?? 0, stars.colors[s * 3 + 2] ?? 0);
  }
  return { count: keepDirs.length / 3, dirs: Float32Array.from(keepDirs), colors: Float32Array.from(keepColors) };
}
