// SAVE FILE panel (stage P3, Agent 5g; Andy chose A: one screen, three parts). Opened from MENU.
//   YOUR GAME NOW: what this device's game holds.
//   EXPORT: SAVE FILE (share sheet on phones that support it, otherwise a download) and COPY TEXT (with a
//           read-only text box to select by hand when the clipboard is blocked).
//   IMPORT: CHOOSE FILE or PASTE TEXT -> checked by src/save (inspectImport) -> side-by-side confirm (Andy chose A)
//           -> applyImport -> reload WITHOUT ?seed= (the seed comes from the save).
//   UNDO LAST IMPORT: only when there is something to undo; confirms; then reloads.
// All texts are set with textContent, never as HTML. src/save (Agent 6e) does all checking and writing.

import {
  applyImport,
  canUndoImport,
  exportSaveFile,
  inspectImport,
  undoImport,
  type SaveSummary,
  type StorageLike,
} from "../save";
import { button, el } from "./dom";
import { Popup } from "./popup";
import { REPLACE_WARNING, compareRows, summaryLines, warningLines } from "./savefilelogic";

export interface SaveFileHooks {
  storage: StorageLike | null;
  /** Writes the running game to storage first, so the export is up to date. */
  saveNow: () => void;
  currentSeed: () => number;
  /** Stops autosave and reloads the page without ?seed= (after import or undo). */
  reload: () => void;
}

export class SaveFilePanel {
  private root = el("div", "ui-overlay ui-jobs ui-savefile");
  private list = el("div", "ui-cards");
  private popup: Popup;
  private isOpen = false;
  private fileInput: HTMLInputElement;
  /** Last result line in the panel (refusal in red, or "Copied!"). */
  private note = el("div", "ui-savefile-note");
  private copyBox: HTMLTextAreaElement | null = null;
  private pasteBox: HTMLTextAreaElement | null = null;
  private confirmView: HTMLElement | null = null;

  constructor(parent: HTMLElement, private hooks: SaveFileHooks, private onClose: () => void) {
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-label", "Save file");
    const panel = el("div", "ui-panel");
    const head = el("div", "ui-panel-head");
    const titles = el("div", "ui-panel-titles");
    titles.append(el("div", "ui-panel-title", "SAVE FILE"), el("div", "ui-panel-sub", "MOVE OR BACK UP YOUR GAME"));
    head.append(titles, button("BACK", "", () => this.onClose()));
    panel.append(head, this.list);
    this.root.append(panel);
    this.root.hidden = true;
    this.root.addEventListener("click", (e) => {
      if (e.target === this.root) this.onClose();
    });
    this.fileInput = el("input");
    this.fileInput.type = "file";
    this.fileInput.accept = ".json,.txt,application/json,text/plain";
    this.fileInput.hidden = true;
    this.fileInput.addEventListener("change", () => void this.readChosenFile());
    this.root.append(this.fileInput);
    parent.appendChild(this.root);
    this.popup = new Popup(parent);
  }

  open(): void {
    this.isOpen = true;
    this.root.hidden = false;
    this.note.textContent = "";
    this.note.className = "ui-savefile-note";
    this.copyBox = null;
    this.pasteBox = null;
    this.confirmView = null;
    this.render();
    this.list.scrollTop = 0;
  }

  close(): void {
    this.isOpen = false;
    this.root.hidden = true;
    this.popup.close();
  }

  get opened(): boolean {
    return this.isOpen;
  }

  get messageOpen(): boolean {
    return this.popup.opened;
  }

  closeMessage(): void {
    this.popup.close();
  }

  // ------------------------------------------------------------ drawing

  private render(): void {
    if (!this.isOpen) return;
    if (this.confirmView) {
      this.list.replaceChildren(this.confirmView);
      return;
    }
    const parts: HTMLElement[] = [];
    // YOUR GAME NOW
    const now = this.currentSummary();
    const game = section("YOUR GAME NOW");
    if (now) for (const line of summaryLines(now)) game.append(el("div", "ui-savefile-line", line));
    else game.append(el("div", "ui-savefile-line", "No saved game on this device yet."));
    parts.push(game);

    // EXPORT
    const exp = section("EXPORT", "Take your game with you, or keep a backup.");
    const row = el("div", "ui-savefile-row");
    row.append(button("SAVE FILE", "ui-btn-primary ui-btn-wide", () => this.saveFile()), button("COPY TEXT", "ui-btn-wide", () => void this.copyText()));
    exp.append(row);
    if (this.copyBox) {
      exp.append(el("div", "ui-savefile-small", "Copying was blocked here. Tap the box, Select All, then Copy:"), this.copyBox);
    }
    parts.push(exp);

    // IMPORT
    const imp = section("IMPORT", "Bring a game here from another device.");
    const row2 = el("div", "ui-savefile-row");
    row2.append(
      button("CHOOSE FILE", "ui-btn-wide", () => {
        this.fileInput.value = "";
        this.fileInput.click();
      }),
      button("PASTE TEXT", "ui-btn-wide", () => this.showPasteBox()),
    );
    imp.append(row2);
    if (this.pasteBox) {
      imp.append(this.pasteBox, button("CHECK THIS TEXT", "ui-btn-primary ui-btn-wide", () => this.check(this.pasteBox?.value ?? "")));
    }
    parts.push(imp);

    parts.push(this.note);

    // UNDO (only when there is something to undo)
    if (canUndoImport(this.hooks.storage)) {
      const undo = section("UNDO", "Changed your mind? Put back the game from before the last import.");
      undo.append(button("UNDO LAST IMPORT", "ui-btn-amber ui-btn-wide", () => this.askUndo()));
      parts.push(undo);
    }
    this.list.replaceChildren(...parts);
  }

  private currentSummary(): SaveSummary | null {
    this.hooks.saveNow();
    const r = exportSaveFile(this.hooks.storage);
    return r.ok ? r.summary : null;
  }

  private say(text: string, bad = false): void {
    this.note.textContent = text;
    this.note.className = bad ? "ui-savefile-note ui-red" : "ui-savefile-note";
  }

  // ------------------------------------------------------------ export

  private saveFile(): void {
    this.hooks.saveNow();
    const r = exportSaveFile(this.hooks.storage);
    if (!r.ok) {
      this.say(r.reason, true);
      this.render();
      return;
    }
    const file = new File([r.json], r.filename, { type: "application/json" });
    // Phones with a share sheet (iPhone Safari, the installed app): "Save to Files", AirDrop, mail...
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
      nav
        .share({ files: [file], title: r.filename })
        .then(() => this.say(`Shared ${r.filename}.`))
        .catch(() => this.download(file, r.filename)) // cancelled or refused: offer the plain download instead
        .finally(() => this.render());
      return;
    }
    this.download(file, r.filename);
    this.render();
  }

  private download(file: File, filename: string): void {
    const url = URL.createObjectURL(file);
    const a = el("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    this.say(`Saved ${filename} (look in Downloads or Files).`);
  }

  private async copyText(): Promise<void> {
    this.hooks.saveNow();
    const r = exportSaveFile(this.hooks.storage);
    if (!r.ok) {
      this.say(r.reason, true);
      this.render();
      return;
    }
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(r.text);
      this.copyBox = null;
      this.say("Copied! Paste it into a note or a message to yourself.");
    } catch {
      // Fallback: a read-only box with the text, already selected.
      const box = el("textarea", "ui-savefile-text");
      box.readOnly = true;
      box.value = r.text;
      box.rows = 3;
      this.copyBox = box;
      this.say("");
      window.setTimeout(() => {
        box.focus();
        box.select();
      }, 50);
    }
    this.render();
  }

  // ------------------------------------------------------------ import

  private showPasteBox(): void {
    const box = el("textarea", "ui-savefile-text");
    box.rows = 3;
    box.placeholder = "Paste the save text here (it starts with LFSAVE1:)";
    box.setAttribute("aria-label", "Save text");
    this.pasteBox = box;
    this.say("");
    this.render();
    window.setTimeout(() => box.focus(), 50);
  }

  private async readChosenFile(): Promise<void> {
    const f = this.fileInput.files?.[0];
    if (!f) return;
    try {
      this.check(await f.text());
    } catch {
      this.say("That file could not be read. Nothing was changed.", true);
      this.render();
    }
  }

  /** Checks the text with src/save and, if it is a good save, shows the side-by-side confirm. */
  private check(text: string): void {
    const r = inspectImport(text, this.hooks.currentSeed());
    if (!r.ok) {
      this.say(r.reason, true); // refusals exactly as src/save words them; nothing changed
      this.render();
      return;
    }
    const now = this.currentSummary();
    const box = el("div", "ui-card ui-savefile-confirm");
    box.append(el("div", "ui-panel-title", "REPLACE YOUR GAME?"));
    const table = el("div", "ui-compare");
    table.append(el("span", "ui-compare-head", ""), el("span", "ui-compare-head", "THIS FILE"), el("span", "ui-compare-head", "NOW"));
    for (const row of compareRows(r.summary, now)) {
      table.append(el("span", "ui-compare-label", row.label), el("span", "ui-compare-file", row.file), el("span", "ui-compare-now", row.now));
    }
    box.append(table);
    for (const w of warningLines(r.warnings)) box.append(el("div", "ui-savefile-warning", w));
    box.append(el("div", "ui-savefile-small ui-red", REPLACE_WARNING));
    const row = el("div", "ui-savefile-row");
    row.append(
      button("REPLACE MY GAME", "ui-btn-red ui-btn-wide", () => this.apply(text)),
      button("CANCEL", "ui-btn-wide", () => {
        this.confirmView = null;
        this.say("Cancelled. Nothing was changed.");
        this.render();
      }),
    );
    box.append(row);
    this.confirmView = box;
    this.render();
    this.list.scrollTop = 0;
  }

  private apply(text: string): void {
    const r = applyImport(this.hooks.storage, text, this.hooks.currentSeed());
    if (!r.ok) {
      this.confirmView = null;
      this.say(r.reason, true);
      this.render();
      return;
    }
    this.popup.show({ title: "IMPORTED", text: "Your game is here. Starting it now...", buttons: [{ text: "OK", primary: true, onClick: () => this.hooks.reload() }] });
    window.setTimeout(() => this.hooks.reload(), 1500);
  }

  private askUndo(): void {
    this.popup.show({
      title: "UNDO LAST IMPORT?",
      text: "This puts back the game from before your last import, and replaces the one here now.",
      warning: true,
      buttons: [
        {
          text: "YES, UNDO",
          primary: true,
          onClick: () => {
            const r = undoImport(this.hooks.storage);
            if (!r.ok) {
              this.say(r.reason, true);
              this.render();
              return;
            }
            this.hooks.reload();
          },
        },
        { text: "CANCEL" },
      ],
    });
  }
}

function section(title: string, line = ""): HTMLElement {
  const box = el("div", "ui-card ui-savefile-part");
  box.append(el("span", "ui-chip", title));
  if (line) box.append(el("div", "ui-savefile-small", line));
  return box;
}
