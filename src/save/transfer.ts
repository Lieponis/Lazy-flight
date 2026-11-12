// SAVE FILE: export and import (stage P2, Agent 6e). Moves progress between devices (the installed iPhone app has
// its own storage and cannot see the Safari tab's save) and is an insurance against a phone clearing stored data.
//
// The file is one JSON object:
//   { format: "lazy-flight-save", formatVersion: 1, appVersion: null, exportedAt: "2026-11-12T08:00:00.000Z",
//     save: <exactly what lazy-freight.save holds>, sound: <lazy-freight.sound settings or null>,
//     summary: { credits, ships, ranks, explorer ... }, checksum: "cyrb53:..." }
// The same data as ONE line of text for copy/paste: "LFSAVE1:" + base64url(UTF-8 JSON). Letters, digits, "-" and "_"
// only: no spaces, no line breaks, nothing a phone's paste can break.
//
// The checksum catches damaged or hand-edited files. It is NOT a security lock (anyone can recompute it).
// Nothing in a file is ever run: it is only read as data, checked, and stored as data.
// Only game data is in the file: the save and the sound settings. No email, no device information.

import { Game, createClock, explorerInfo, getShip, isShipId, normalizeState, rankInfos, type GameState } from "../game";
import { UNIVERSE_VERSION, startDockOf } from "../universe";
import { SAVE_GENERATION_KEY, loadIntoGame } from "./autosave";
import { migrateSave, universeVersionOf } from "./migrate";
import { SAVE_KEY, SAVE_VERSION, checkSaveData, type SaveData, type StorageLike } from "./save";

// ------------------------------------------------------------ sound settings
// The layer rule keeps src/save from importing src/audio, so the save file handles the sound settings itself, in the
// SAME shape and key as src/audio/prefs.ts (a test checks they stay equal): { muted, music 0..1, effects 0..1 }.

/** The sound settings key (same as PREFS_KEY in src/audio/prefs.ts). */
export const SOUND_KEY = "lazy-freight.sound";
export interface SoundSettings {
  muted: boolean;
  music: number;
  effects: number;
}
/** Same defaults as DEFAULT_PREFS in src/audio/prefs.ts. */
const SOUND_DEFAULTS: SoundSettings = { muted: false, music: 0.5, effects: 0.7 };

function unit(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
}

/** Any value in, clean sound settings out (the same rule as normalizePrefs in src/audio/prefs.ts). */
export function cleanSoundSettings(raw: unknown): SoundSettings {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    muted: typeof r.muted === "boolean" ? r.muted : SOUND_DEFAULTS.muted,
    music: unit(r.music, SOUND_DEFAULTS.music),
    effects: unit(r.effects, SOUND_DEFAULTS.effects),
  };
}

/** The name every save file carries. A file without it is not ours. */
export const SAVE_FILE_FORMAT = "lazy-flight-save";
/** Bump when the FILE layout changes (not the save inside: that has its own version). */
export const SAVE_FILE_FORMAT_VERSION = 1;
/** Start of the copy/paste text form. */
export const SAVE_TEXT_PREFIX = "LFSAVE1:";
/**
 * Biggest file or text accepted: 3,000,000 characters. A save with the full explored list (20,000 systems at about
 * 24 bytes each) is about 0.5 MB, about 0.7 MB as text, so this is more than 4x room, and still small for a phone.
 */
export const MAX_IMPORT_CHARS = 3_000_000;
/** One level of undo: what was in storage before the last import (or undo). */
export const BEFORE_IMPORT_KEY = "lazy-freight.save.beforeimport";
// SAVE_GENERATION_KEY (autosave.ts) is changed by every import and undo: a running game's autosaver remembers it at
// start and stops writing as soon as it changes, so the game still open in memory can never overwrite an import.
export { SAVE_GENERATION_KEY };

/** What the player sees before an import (and after an export). */
export interface SaveSummary {
  seed: number;
  credits: number;
  /** Ship names: the active one first. */
  ships: string[];
  activeShip: string;
  /** "cargo: Box Pusher (rank 1)" style, one per job kind. */
  ranks: { label: string; rankName: string; rankNumber: number; jobsDone: number }[];
  explorer: { rankName: string; systems: number; planets: number };
  outposts: number;
  /** Extra paint jobs owned (standard ones not counted). */
  paintJobs: number;
  /** A job or free trip was under way when it was saved. */
  travelling: boolean;
  /** When the save was written (ISO date), from the save itself. */
  savedAt: string;
  universeVersion: number;
}

export interface SaveFile {
  format: string;
  formatVersion: number;
  /** The game's version if known. The build has no version number yet, so null for now. */
  appVersion: string | null;
  exportedAt: string;
  save: SaveData;
  sound: SoundSettings | null;
  summary: SaveSummary;
  checksum: string;
}

export type ExportResult =
  | { ok: true; filename: string; json: string; text: string; summary: SaveSummary; file: SaveFile }
  | { ok: false; reason: string };

export type InspectResult =
  | { ok: true; summary: SaveSummary; warnings: string[]; file: SaveFile }
  | { ok: false; reason: string };

export type ApplyResult =
  | { ok: true; summary: SaveSummary; warnings: string[]; reloadNeeded: true }
  | { ok: false; reason: string };

export type UndoResult = { ok: true; reloadNeeded: true; restored: "save" | "empty" } | { ok: false; reason: string };

// ------------------------------------------------------------ friendly refusals (shown to the player)

export const REFUSE_EMPTY = "There is nothing to import. Paste the save text or choose a save file.";
export const REFUSE_TOO_BIG = "That is far too big to be a Lazy Flight save.";
export const REFUSE_NOT_A_SAVE = "That is not a Lazy Flight save file. Nothing was changed.";
export const REFUSE_DAMAGED = "This save file is damaged or was edited, so it cannot be trusted. Nothing was changed.";
export const REFUSE_NEWER = "This save is from a newer version of the game. Update the game first, then import it.";
export const REFUSE_BROKEN = "This save could not be loaded. Nothing was changed.";
export const REFUSE_NO_STORAGE = "Saving is off in this browser (private window?), so nothing can be imported here.";
export const REFUSE_NOTHING_TO_EXPORT = "There is no saved game to export yet. Play a little first.";
export const REFUSE_NO_UNDO = "There is nothing to undo.";
export const REFUSE_WRITE_FAILED = "The phone refused to store the save (storage full?). Nothing was changed.";

export const WARN_OLD_UNIVERSE =
  "This save is from an older universe. It will be moved: credits, ranks and ships come with you, outposts are paid back.";
export const WARN_TRAVELLING = "A trip was under way. Time away counts, so it may land as soon as the game starts.";
export const WARN_OTHER_SEED = "This save is from a different universe seed than your current game.";

// ------------------------------------------------------------ small helpers

/** A 53-bit string hash (cyrb53). Fast, no libraries; good at noticing damage, not a security lock. */
function cyrb53(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

/** JSON with object keys sorted, so the checksum does not depend on key order or spacing. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/** The checksum a file must carry (over its known fields, in a fixed order). Exported for tests and future tools. */
export function saveFileChecksum(file: Omit<SaveFile, "checksum">): string {
  return checksumOf(file);
}

function checksumOf(file: Omit<SaveFile, "checksum">): string {
  const { format, formatVersion, appVersion, exportedAt, save, sound, summary } = file;
  return `cyrb53:${cyrb53(stableStringify({ format, formatVersion, appVersion, exportedAt, save, sound, summary }))}`;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function safeGet(storage: StorageLike, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/** "lazy-flight-save-2026-11-12.json" (the date in the player's own time zone). */
export function saveFileName(date: Date): string {
  const p = (n: number): string => String(n).padStart(2, "0");
  return `lazy-flight-save-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.json`;
}

/**
 * Runs a save through the SAME path a page load uses (shape check, universe move, repair, fit to the universe, load
 * into a real Game) and returns the repaired state. Throws if anything in that path would crash.
 */
function loadThroughGamePath(save: SaveData, realNowMs: number): { state: GameState; moved: boolean } {
  const migrated = migrateSave(save);
  const data = migrated.data;
  const startDock = startDockOf(data.seed).id;
  const game = new Game(data.seed, startDock, createClock(1, () => realNowMs));
  if (data.state) loadIntoGame(game, data, data.state, startDock, realNowMs);
  return { state: game.state, moved: migrated.message !== null };
}

function summaryOf(save: SaveData, state: GameState): SaveSummary {
  const s = normalizeState(state);
  const shipIds = [s.shipId, ...Object.keys(s.ownedShips).filter((id) => id !== s.shipId && isShipId(id))];
  const explorer = explorerInfo(s.explored);
  let paintJobs = 0;
  for (const l of Object.values(s.shipLiveries)) paintJobs += Math.max(0, (l.owned?.length ?? 1) - 1);
  return {
    seed: save.seed,
    credits: s.credits,
    ships: shipIds.map((id) => getShip(id).name),
    activeShip: getShip(s.shipId).name,
    ranks: rankInfos(s.completedJobs).map((r) => ({ label: r.label, rankName: r.rankName, rankNumber: r.rankNumber, jobsDone: r.jobsDone })),
    explorer: { rankName: explorer.rankName, systems: explorer.systems, planets: explorer.planets },
    outposts: s.ownedOutposts.length,
    paintJobs,
    travelling: s.currentJob !== null || s.freeTrip !== null,
    savedAt: new Date(save.savedAtRealMs).toISOString(),
    universeVersion: universeVersionOf(save),
  };
}

/** Keeps only the fields a save is made of (an unknown extra field in a file is dropped, never stored). */
function cleanSaveData(raw: SaveData): SaveData {
  const out: SaveData = {
    version: raw.version,
    seed: raw.seed,
    savedAtRealMs: raw.savedAtRealMs,
    gameNowMs: raw.gameNowMs,
    state: raw.state,
  };
  if (raw.universeVersion !== undefined) out.universeVersion = raw.universeVersion;
  return out;
}

// ------------------------------------------------------------ export

/**
 * Makes the save file from what is in storage RIGHT NOW. Changes nothing.
 * For the live state of a running game, call the autosaver's saveNow() first (the autosave is written after every
 * change and when the page is hidden, so it is normally already up to date, also mid-trip).
 */
export function exportSaveFile(storage: StorageLike | null, now: Date = new Date()): ExportResult {
  if (!storage) return { ok: false, reason: REFUSE_NO_STORAGE };
  const text = safeGet(storage, SAVE_KEY);
  if (!text) return { ok: false, reason: REFUSE_NOTHING_TO_EXPORT };
  let save: SaveData;
  try {
    const parsed: unknown = JSON.parse(text);
    if (checkSaveData(parsed) !== null) return { ok: false, reason: REFUSE_NOTHING_TO_EXPORT };
    save = cleanSaveData(parsed as SaveData);
  } catch {
    return { ok: false, reason: REFUSE_NOTHING_TO_EXPORT };
  }
  if (save.state === null) return { ok: false, reason: REFUSE_NOTHING_TO_EXPORT };

  let state: GameState;
  try {
    state = loadThroughGamePath(save, now.getTime()).state;
  } catch {
    return { ok: false, reason: REFUSE_BROKEN };
  }
  let sound: SoundSettings | null = null;
  const soundText = safeGet(storage, SOUND_KEY);
  if (soundText) {
    try {
      sound = cleanSoundSettings(JSON.parse(soundText));
    } catch {
      sound = null;
    }
  }
  const body: Omit<SaveFile, "checksum"> = {
    format: SAVE_FILE_FORMAT,
    formatVersion: SAVE_FILE_FORMAT_VERSION,
    appVersion: null,
    exportedAt: now.toISOString(),
    save,
    sound,
    summary: summaryOf(save, state),
  };
  const file: SaveFile = { ...body, checksum: checksumOf(body) };
  const json = JSON.stringify(file);
  return { ok: true, filename: saveFileName(now), json, text: SAVE_TEXT_PREFIX + toBase64Url(json), summary: file.summary, file };
}

// ------------------------------------------------------------ inspect (changes nothing)

/** Text form or JSON in, the parsed file out (or a friendly reason). */
function parseInput(input: string): { file: Record<string, unknown> } | { reason: string } {
  const trimmed = (typeof input === "string" ? input : "").trim();
  if (trimmed === "") return { reason: REFUSE_EMPTY };
  if (trimmed.length > MAX_IMPORT_CHARS) return { reason: REFUSE_TOO_BIG };
  let jsonText: string | null = trimmed;
  if (trimmed.startsWith(SAVE_TEXT_PREFIX)) {
    jsonText = fromBase64Url(trimmed.slice(SAVE_TEXT_PREFIX.length).replace(/\s+/g, ""));
    if (jsonText === null) return { reason: REFUSE_DAMAGED };
  } else if (!trimmed.startsWith("{")) {
    return { reason: REFUSE_NOT_A_SAVE };
  }
  try {
    const parsed: unknown = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { reason: REFUSE_NOT_A_SAVE };
    return { file: parsed as Record<string, unknown> };
  } catch {
    // A text form that decoded to broken JSON is damaged; a pasted JSON that does not parse is cut off or not ours.
    return { reason: trimmed.startsWith(SAVE_TEXT_PREFIX) ? REFUSE_DAMAGED : REFUSE_NOT_A_SAVE };
  }
}

/**
 * Checks a save file (JSON or the LFSAVE1 text) WITHOUT changing anything: format name, size, JSON, checksum,
 * versions, and that it loads through the normal repair path. `currentSeed` (optional) adds a warning if it differs.
 */
export function inspectImport(input: string, currentSeed?: number | null, realNowMs: number = Date.now()): InspectResult {
  const parsed = parseInput(input);
  if ("reason" in parsed) return { ok: false, reason: parsed.reason };
  const f = parsed.file;
  if (f.format !== SAVE_FILE_FORMAT) return { ok: false, reason: REFUSE_NOT_A_SAVE };
  if (typeof f.formatVersion !== "number" || !Number.isInteger(f.formatVersion) || f.formatVersion < 1) {
    return { ok: false, reason: REFUSE_NOT_A_SAVE };
  }
  if (f.formatVersion > SAVE_FILE_FORMAT_VERSION) return { ok: false, reason: REFUSE_NEWER };

  const body: Omit<SaveFile, "checksum"> = {
    format: f.format,
    formatVersion: f.formatVersion,
    appVersion: typeof f.appVersion === "string" ? f.appVersion : null,
    exportedAt: typeof f.exportedAt === "string" ? f.exportedAt : "",
    save: f.save as SaveData,
    sound: (f.sound ?? null) as SoundSettings | null,
    summary: f.summary as SaveSummary,
  };
  // The checksum is checked on the file exactly as it came in (appVersion as written), before anything else is trusted.
  const asWritten = { ...body, appVersion: f.appVersion as string | null };
  if (typeof f.checksum !== "string" || f.checksum !== checksumOf(asWritten)) return { ok: false, reason: REFUSE_DAMAGED };

  const rawSave = f.save as Record<string, unknown> | null;
  if (!rawSave || typeof rawSave !== "object") return { ok: false, reason: REFUSE_NOT_A_SAVE };
  if (typeof rawSave.version === "number" && rawSave.version > SAVE_VERSION) return { ok: false, reason: REFUSE_NEWER };
  if (typeof rawSave.universeVersion === "number" && rawSave.universeVersion > UNIVERSE_VERSION) return { ok: false, reason: REFUSE_NEWER };
  if (checkSaveData(rawSave) !== null) return { ok: false, reason: REFUSE_BROKEN };
  const save = cleanSaveData(rawSave as unknown as SaveData);
  if (save.state === null) return { ok: false, reason: REFUSE_BROKEN };

  let loaded: { state: GameState; moved: boolean };
  try {
    loaded = loadThroughGamePath(save, realNowMs);
  } catch {
    return { ok: false, reason: REFUSE_BROKEN };
  }
  const warnings: string[] = [];
  if (loaded.moved) warnings.push(WARN_OLD_UNIVERSE);
  if (save.state.currentJob || (save.state as Partial<GameState>).freeTrip) warnings.push(WARN_TRAVELLING);
  if (currentSeed !== undefined && currentSeed !== null && currentSeed !== save.seed) warnings.push(WARN_OTHER_SEED);
  // The summary is rebuilt from the save itself (never trusted from the file's own summary field).
  return { ok: true, summary: summaryOf(save, loaded.state), warnings, file: { ...body, save, checksum: f.checksum } };
}

// ------------------------------------------------------------ apply and undo

function newGeneration(storage: StorageLike): boolean {
  try {
    storage.setItem(SAVE_GENERATION_KEY, `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
    return true;
  } catch {
    return false;
  }
}

interface BeforeImport {
  save: string | null;
  sound: string | null;
  at: string;
}

function readBackup(storage: StorageLike): BeforeImport | null {
  const text = safeGet(storage, BEFORE_IMPORT_KEY);
  if (!text) return null;
  try {
    const b = JSON.parse(text) as Partial<BeforeImport>;
    if (!b || typeof b !== "object") return null;
    return {
      save: typeof b.save === "string" ? b.save : null,
      sound: typeof b.sound === "string" ? b.sound : null,
      at: typeof b.at === "string" ? b.at : "",
    };
  } catch {
    return null;
  }
}

/** Puts back a stored value exactly (null = the key was not there). */
function restoreKey(storage: StorageLike, key: string, value: string | null): void {
  if (value === null) storage.removeItem(key);
  else storage.setItem(key, value);
}

/**
 * Writes an imported save. FIRST keeps the current save and sound settings under BEFORE_IMPORT_KEY (one level of
 * undo), then stores the imported save exactly as the file holds it (cleaned of unknown fields). The next page load
 * runs it through the normal path (universe move with refund, repairs). Returns reloadNeeded: the UI must reload the
 * page. The running game's autosaver stops writing at once (generation key), so it cannot overwrite the import.
 * A refused or failed import leaves storage as it was.
 */
export function applyImport(storage: StorageLike | null, input: string, currentSeed?: number | null): ApplyResult {
  if (!storage) return { ok: false, reason: REFUSE_NO_STORAGE };
  const checked = inspectImport(input, currentSeed);
  if (!checked.ok) return checked;

  const before = { save: safeGet(storage, SAVE_KEY), sound: safeGet(storage, SOUND_KEY) };
  const backup: BeforeImport = { ...before, at: new Date().toISOString() };
  try {
    storage.setItem(BEFORE_IMPORT_KEY, JSON.stringify(backup));
    if (!newGeneration(storage)) throw new Error("generation");
    storage.setItem(SAVE_KEY, JSON.stringify(checked.file.save));
    if (checked.file.sound) storage.setItem(SOUND_KEY, JSON.stringify(cleanSoundSettings(checked.file.sound)));
  } catch {
    // Put everything back the way it was (best effort), so a failed import changes nothing.
    try {
      restoreKey(storage, SAVE_KEY, before.save);
      restoreKey(storage, SOUND_KEY, before.sound);
    } catch {
      // nothing more we can do
    }
    return { ok: false, reason: REFUSE_WRITE_FAILED };
  }
  return { ok: true, summary: checked.summary, warnings: checked.warnings, reloadNeeded: true };
}

/** True if there is something to undo. */
export function canUndoImport(storage: StorageLike | null): boolean {
  return storage !== null && readBackup(storage) !== null;
}

/**
 * Undo: puts back what was there before the last import. It SWAPS: the imported save goes into the undo slot,
 * so pressing Undo a second time brings the import back. Only one level: two imports in a row, then Undo, gives
 * the save from between them (the first import), not the one before both.
 */
export function undoImport(storage: StorageLike | null): UndoResult {
  if (!storage) return { ok: false, reason: REFUSE_NO_STORAGE };
  const backup = readBackup(storage);
  if (!backup) return { ok: false, reason: REFUSE_NO_UNDO };
  const now = { save: safeGet(storage, SAVE_KEY), sound: safeGet(storage, SOUND_KEY) };
  try {
    storage.setItem(BEFORE_IMPORT_KEY, JSON.stringify({ ...now, at: new Date().toISOString() }));
    newGeneration(storage);
    restoreKey(storage, SAVE_KEY, backup.save);
    restoreKey(storage, SOUND_KEY, backup.sound);
  } catch {
    try {
      restoreKey(storage, SAVE_KEY, now.save);
      restoreKey(storage, SOUND_KEY, now.sound);
      storage.setItem(BEFORE_IMPORT_KEY, JSON.stringify(backup));
    } catch {
      // nothing more we can do
    }
    return { ok: false, reason: REFUSE_WRITE_FAILED };
  }
  return { ok: true, reloadNeeded: true, restored: backup.save === null ? "empty" : "save" };
}
