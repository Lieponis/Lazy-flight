// TITLE SCREEN (Agent 7b): shown every time the game opens, over everything.
// Name (chunky pixel letters drawn by code), tagline, "LOADING" with three blinking dots, then PLAY.
// PLAY (or Enter / Space) closes it. That tap also switches the sound on (browsers need a first tap; see src/ui/sound.ts).
// The game itself starts underneath as before; the title only covers it.

import type { Seed } from "../universe";
import { el } from "./dom";
import { GAME_NAME, GLYPH_HEIGHT, TAGLINE, loadingText, titleCellSize, titleLines, titleReady, wordCells, wordWidth } from "./titlelogic";
import { TitleScene } from "./titlescene";

const NAME_COLOUR = "#9ff6ff";
const NAME_SHADOW = "#1b2a8a";

export interface TitleOptions {
  seed: Seed;
  dockId: string;
  systemId: string;
  onPlay: () => void;
}

export class TitleScreen {
  private root = el("div", "ui-title");
  private name = el("canvas", "ui-title-name");
  private tagline = el("div", "ui-title-tag", TAGLINE);
  private slot = el("div", "ui-title-slot");
  private loading = el("div", "ui-title-loading");
  private play = el("button", "ui-btn ui-title-play", "PLAY");
  private scene: TitleScene | null;
  private gameReady = false;
  private t0 = performance.now();
  private timer: number;
  private closed = false;
  private onKey = (e: KeyboardEvent): void => {
    if (this.closed) return;
    // While the title shows, keys belong to it (Escape must not close menus hidden underneath).
    e.stopPropagation();
    if ((e.key === "Enter" || e.key === " ") && this.isReady()) {
      e.preventDefault();
      this.close();
    }
  };
  private onResize = (): void => this.drawName();

  constructor(parent: HTMLElement, private opts: TitleOptions) {
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-label", "Lazy Flight");
    const content = el("div", "ui-title-content");
    this.play.type = "button";
    this.play.addEventListener("click", () => this.close());
    this.play.hidden = true;
    this.slot.append(this.loading, this.play);
    content.append(this.name, this.tagline, this.slot);
    parent.append(this.root);
    this.scene = new TitleScene(this.root, opts.seed, opts.dockId, opts.systemId);
    this.root.append(content);
    this.drawName();
    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKey, true);
    this.tick();
    this.timer = window.setInterval(() => this.tick(), 100);
  }

  /** The game underneath has drawn its first picture. */
  markGameReady(): void {
    this.gameReady = true;
    this.tick();
  }

  get opened(): boolean {
    return !this.closed;
  }

  private isReady(): boolean {
    return titleReady(performance.now() - this.t0, this.gameReady);
  }

  private tick(): void {
    if (this.closed) return;
    if (this.isReady()) {
      if (this.play.hidden) {
        this.loading.hidden = true;
        this.play.hidden = false;
      }
    } else this.loading.textContent = loadingText(performance.now() - this.t0);
  }

  private drawName(): void {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const portrait = H > W;
    const lines = titleLines(GAME_NAME, portrait);
    const pad = 2;
    const cw = Math.max(...lines.map(wordWidth)) + pad * 2;
    const ch = lines.length * GLYPH_HEIGHT + (lines.length - 1) * 2 + pad * 2;
    const c = this.name;
    c.width = cw;
    c.height = ch;
    const g = c.getContext("2d");
    if (g) {
      g.clearRect(0, 0, cw, ch);
      lines.forEach((line, i) => {
        const x0 = Math.round((cw - wordWidth(line)) / 2);
        const y0 = pad + i * (GLYPH_HEIGHT + 2);
        const cells = wordCells(line);
        g.fillStyle = NAME_SHADOW;
        for (const [x, y] of cells) g.fillRect(x0 + x + 1, y0 + y + 1, 1, 1);
        g.fillStyle = NAME_COLOUR;
        for (const [x, y] of cells) g.fillRect(x0 + x, y0 + y, 1, 1);
      });
    }
    const cell = titleCellSize(lines, W, H);
    c.style.width = `${cw * cell}px`;
    c.style.height = `${ch * cell}px`;
  }

  /** PLAY: fade out, then remove everything (the 3D backdrop is freed). */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    window.clearInterval(this.timer);
    window.removeEventListener("keydown", this.onKey, true);
    window.removeEventListener("resize", this.onResize);
    this.root.classList.add("ui-title-out");
    window.setTimeout(() => {
      this.scene?.dispose();
      this.scene = null;
      this.root.remove();
    }, 450);
    this.opts.onPlay();
  }
}
