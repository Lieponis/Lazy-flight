// The player's sound settings (mute, music volume, effects volume) and the volume maths. Pure, except load/save,
// which take a storage object from the glue (the same careful browser storage the save uses).
//
// Kept under its OWN key, not inside the game save: settings are not progress, so they survive NEW GAME,
// and an old save never needs to change. A missing or broken value simply gives the defaults.

export interface SoundPrefs {
  muted: boolean;
  /** 0 to 1, the slider position. */
  music: number;
  /** 0 to 1, the slider position. */
  effects: number;
}

export const PREFS_KEY = "lazy-freight.sound";
/** Quiet by default (the brief: music quiet by default). */
export const DEFAULT_PREFS: Readonly<SoundPrefs> = { muted: false, music: 0.5, effects: 0.7 };

/** The part of localStorage we use. src/save's StorageLike fits it. */
export interface PrefsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function unit(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
}

/** Any value in, sensible settings out (missing fields get their default, numbers are clamped to 0..1). */
export function normalizePrefs(raw: unknown): SoundPrefs {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    muted: typeof r.muted === "boolean" ? r.muted : DEFAULT_PREFS.muted,
    music: unit(r.music, DEFAULT_PREFS.music),
    effects: unit(r.effects, DEFAULT_PREFS.effects),
  };
}

export function loadPrefs(storage: PrefsStorage | null): SoundPrefs {
  if (!storage) return { ...DEFAULT_PREFS };
  try {
    const text = storage.getItem(PREFS_KEY);
    return normalizePrefs(text ? JSON.parse(text) : null);
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

/** Never throws. Returns false if storage refused it. */
export function savePrefs(storage: PrefsStorage | null, prefs: SoundPrefs): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PREFS_KEY, JSON.stringify(normalizePrefs(prefs)));
    return true;
  } catch {
    return false;
  }
}

/** Loudest the music bus may get, and the effects bus. Music stays well under the effects. */
export const MUSIC_MAX_GAIN = 0.9;
export const EFFECTS_MAX_GAIN = 1;

/**
 * Slider position (0..1) to a gain. Ears hear loudness roughly logarithmically, so a curve feels even along the slider.
 * 0 is silent, 1 is `max`, and it only ever goes up.
 */
export function sliderToGain(position: number, max = 1): number {
  const p = unit(position, 0);
  return p <= 0 ? 0 : Math.pow(p, 2) * max;
}

/** The gains for both buses right now. Muted = both silent. */
export function busGains(prefs: SoundPrefs): { music: number; effects: number } {
  if (prefs.muted) return { music: 0, effects: 0 };
  return { music: sliderToGain(prefs.music, MUSIC_MAX_GAIN), effects: sliderToGain(prefs.effects, EFFECTS_MAX_GAIN) };
}

/** True when nothing can be heard, so the sound engine may sleep (saves phone battery). */
export function isSilent(prefs: SoundPrefs): boolean {
  const g = busGains(prefs);
  return g.music === 0 && g.effects === 0;
}

/** Seconds for a volume change to settle. Long enough that it never clicks. */
export const VOLUME_GLIDE_S = 0.12;
