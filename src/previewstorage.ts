// PREVIEW SAVE ISOLATION (stage G5a, Lead's decision). Pure code: no Vite, no page needed, so it can be tested.
//
// Plain words: the branch preview is published on the SAME web address as the live game (same site, a sub-folder), and a browser keeps
// ONE shared save box per site. Without this file the preview would read and overwrite the live game's save. When the preview build
// is made (VITE_PREVIEW=1), src/previewboot.ts swaps the page's `localStorage` for a wrapper that puts the prefix "preview-v3:" in front
// of every key. The preview then only ever sees and changes its own keys; the live game's keys are invisible to it and never touched.
// Without the flag nothing is wrapped and nothing changes.

/** Put in front of every key the preview stores. */
export const PREVIEW_PREFIX = "preview-v3:";

/** The part of the browser's storage the wrapper needs (the real `Storage` fits it; tests pass a fake one). */
export interface BackingStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** A storage that looks like `localStorage` but only sees the keys that start with `prefix`, and shows them without it. */
export interface PrefixedStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

/** Every key in the backing storage that belongs to the prefix, in the backing storage's own order. */
function ownKeys(backing: BackingStorage, prefix: string): string[] {
  const keys: string[] = [];
  for (let i = 0; i < backing.length; i++) {
    const k = backing.key(i);
    if (k !== null && k.startsWith(prefix)) keys.push(k);
  }
  return keys;
}

export function makePrefixedStorage(backing: BackingStorage, prefix: string = PREVIEW_PREFIX): PrefixedStorage {
  return {
    get length(): number {
      return ownKeys(backing, prefix).length;
    },
    key(index: number): string | null {
      const k = ownKeys(backing, prefix)[index];
      return k === undefined ? null : k.slice(prefix.length);
    },
    getItem(key: string): string | null {
      return backing.getItem(prefix + String(key));
    },
    setItem(key: string, value: string): void {
      backing.setItem(prefix + String(key), String(value));
    },
    removeItem(key: string): void {
      backing.removeItem(prefix + String(key));
    },
    clear(): void {
      // Only the preview's own keys: the live game's save sits in the same box and must stay.
      for (const k of ownKeys(backing, prefix)) backing.removeItem(k);
    },
  };
}

/** Just the part of `window` this file touches. */
export interface WindowLike {
  localStorage: BackingStorage;
}

/**
 * Replaces `win.localStorage` with the prefixed wrapper when `enabled` is true. Returns true when it did.
 * If the browser has no usable storage at all (blocked, private window), there is nothing to share, so nothing is wrapped.
 * If storage exists but cannot be replaced, this THROWS: a preview page that stops is safe, one that shares the live save is not.
 */
export function installPreviewStorage(win: WindowLike, enabled: boolean, prefix: string = PREVIEW_PREFIX): boolean {
  if (!enabled) return false;
  let backing: BackingStorage;
  try {
    backing = win.localStorage;
  } catch {
    return false;
  }
  if (!backing) return false;
  const wrapper = makePrefixedStorage(backing, prefix);
  try {
    Object.defineProperty(win, "localStorage", { value: wrapper, configurable: true, enumerable: true, writable: true });
  } catch {
    throw new Error("PREVIEW: could not separate this preview's saves from the live game's. The page was stopped on purpose.");
  }
  if (win.localStorage !== (wrapper as unknown)) {
    throw new Error("PREVIEW: the save separation did not take effect. The page was stopped on purpose.");
  }
  return true;
}
