// PREVIEW BOOT (stage G5a). Must be the FIRST import of src/main.ts and of every developer page's entry file, so it runs before any
// other code can read the browser's save box (a test, tests/previewstorage.test.ts, checks that).
//
// Plain words: when the preview build is made (VITE_PREVIEW=1), this swaps `localStorage` for a copy that keeps the preview's saves
// apart from the live game's (see src/previewstorage.ts) and puts a small "PREVIEW" tag on the screen, so nobody mistakes the preview
// for the real game. Without the flag it does nothing at all.

import { installPreviewStorage, type WindowLike } from "./previewstorage";

/** True only in a build made with VITE_PREVIEW=1. */
export const IS_PREVIEW: boolean = import.meta.env.VITE_PREVIEW === "1";

function addPreviewTag(): void {
  const tag = document.createElement("div");
  tag.textContent = "PREVIEW";
  tag.setAttribute("aria-hidden", "true");
  tag.style.cssText =
    "position:fixed;top:4px;left:6px;z-index:2147483647;pointer-events:none;font:bold 11px monospace;letter-spacing:2px;" +
    "color:#fff;background:rgba(200,40,140,0.85);padding:1px 5px;border-radius:2px;";
  document.body.append(tag);
}

if (IS_PREVIEW && typeof window !== "undefined") {
  installPreviewStorage(window as unknown as WindowLike, true);
  if (document.body) addPreviewTag();
  else window.addEventListener("DOMContentLoaded", addPreviewTag);
}
