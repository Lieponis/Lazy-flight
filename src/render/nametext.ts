// NAMES IN PLAIN HTML TEXT (stage 3i). A system code like "2N-83" has a hyphen, and a browser may break a line right after it ("2N-" / "83").
// These helpers put every code in its own span that never breaks (class "nm-code", styled in hud.css), so a long name wraps between
// its words and the code always stays whole and readable.

import { splitCodes } from "./namefit";

/** Puts `text` into `el` (new lines stay as they are when the element uses white-space: pre-line). Does nothing if the text has not changed. */
export function setNameText(el: HTMLElement, text: string): void {
  if (el.dataset.nameText === text) return;
  el.dataset.nameText = text;
  el.replaceChildren(
    ...splitCodes(text).map((part) => {
      if (!part.code) return document.createTextNode(part.text);
      const span = document.createElement("span");
      span.className = "nm-code";
      span.textContent = part.text;
      return span;
    }),
  );
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

/** The same for places that build HTML text (the planets wall): the text is escaped and every code gets its span. */
export function nameHtml(text: string): string {
  return splitCodes(text)
    .map((part) => {
      const safe = part.text.replace(/[&<>"]/g, (c) => ESCAPES[c] ?? c);
      return part.code ? `<span class="nm-code">${safe}</span>` : safe;
    })
    .join("");
}
