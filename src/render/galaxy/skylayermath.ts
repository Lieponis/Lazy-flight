// THE FAINT GALAXY BACKDROP BEHIND A 3D SCREEN (the system view): the small sums. Pure maths, no Three.js.
//
// Plain words: the galaxy map shows the sky as you would see it from where you stand. The system view shows the same sky, but only as a
// very faint backdrop for immersion. These helpers decide how faint it is, how it fades in once it has been built (so it never "pops"
// onto the screen), and how far around you the sky is left out (the very nearest stars; there are no individual stars drawn there).

/** How long the sky takes to fade in once it is built (seconds). */
export const SKY_LAYER_FADE_SECONDS = 1.5;

/** Moves the fade (0 = invisible, 1 = fully there) forward by `seconds`; never leaves 0..1. */
export function fadeStep(fade: number, seconds: number, duration: number = SKY_LAYER_FADE_SECONDS): number {
  if (!(duration > 0)) return 1;
  const next = fade + (Number.isFinite(seconds) && seconds > 0 ? seconds : 0) / duration;
  return Math.max(0, Math.min(1, next));
}

/**
 * The two strengths the sky is drawn with: the glow strength (0..1, `glowBase` is the map's own) and the dot brightness (0..1).
 * `faint` = how much of the map's look is left (1 = exactly the map, 0.25 = a quarter), `fade` = the fade-in (0..1).
 */
export function layerLevels(faint: number, fade: number, glowBase: number): { glow: number; dim: number } {
  const f = Math.max(0, Math.min(1, Number.isFinite(faint) ? faint : 0));
  const k = Math.max(0, Math.min(1, Number.isFinite(fade) ? fade : 0));
  return { glow: glowBase * f * k, dim: f * k };
}

/** The smallest "near" radius (light years): nothing closer than this is left out of the sky, so a tiny gap never makes a hole. */
export const SKY_LAYER_MIN_NEAR_LY = 1;

/**
 * Stars closer than this are left out of the sky glow and dots. The map leaves out its whole bubble of drawn stars; here no single
 * stars are drawn, so only a few star gaps around you are left out (a star sitting right on top of the viewer would be a huge dot).
 */
export function layerNearRadius(spacingLy: number, spacings: number): number {
  const s = Number.isFinite(spacingLy) && spacingLy > 0 ? spacingLy : 8;
  return Math.max(SKY_LAYER_MIN_NEAR_LY, s * spacings);
}
