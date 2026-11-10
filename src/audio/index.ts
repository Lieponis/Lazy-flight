// Front door of the sound layer (Agent 7a). Other folders import from here only:
//   import { SoundEngine, loadPrefs } from "../audio";
// Layer rule: src/audio imports nothing from render, ui, game, save or universe (tests/audio.test.ts checks it).

export { SoundEngine } from "./engine";
export {
  ALL_SOUNDS,
  CUE_LOOKAHEAD_S,
  CUE_STALE_S,
  SOUND_LEVELS,
  changeSound,
  flightCues,
  flightMoments,
  funnyLineStarted,
  moodFor,
} from "./cues";
export type { Cue, Mood, Phase, PhaseLengths, SoundEvent } from "./cues";
export {
  DEFAULT_PREFS,
  PREFS_KEY,
  busGains,
  isSilent,
  loadPrefs,
  normalizePrefs,
  savePrefs,
  sliderToGain,
} from "./prefs";
export type { PrefsStorage, SoundPrefs } from "./prefs";
