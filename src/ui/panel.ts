// TEMPORARY trade panel: plain HTML text and buttons. Agent 5 replaces it.
// It only READS the Game and calls: game.accept(jobId), game.refuel(). Nothing else.

import "./panel.css";
import { formatDuration, getShip, refuel, type Game } from "../game";
import { getDock, getSystem } from "../universe";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export class TradePanel {
  private root = el("div", "trade-panel");
  private summary = el("span", "tp-summary");
  private toggle = el("button");
  private body = el("div", "tp-body");
  private countdown: HTMLElement | null = null;
  private progressBar: HTMLProgressElement | null = null;
  private notice = "";
  private lastSlot = -1;

  constructor(
    parent: HTMLElement,
    private game: Game,
  ) {
    const head = el("div", "tp-head");
    this.toggle.type = "button";
    this.toggle.addEventListener("click", () => {
      this.root.classList.toggle("tp-collapsed");
      this.updateToggle();
    });
    head.append(this.summary, this.toggle);
    this.root.append(head, this.body);
    if (window.innerWidth < 700) this.root.classList.add("tp-collapsed"); // phones start folded away
    this.updateToggle();
    parent.appendChild(this.root);
    this.rebuild();
  }

  private updateToggle(): void {
    this.toggle.textContent = this.root.classList.contains("tp-collapsed") ? "Show" : "Hide";
  }

  private dockLabel(dockId: string): string {
    const dock = getDock(this.game.seed, dockId);
    if (!dock) return dockId;
    const system = getSystem(this.game.seed, dock.systemId);
    return `${dock.name} (${system?.name ?? "?"})`;
  }

  private summaryText(): string {
    const s = this.game.state;
    return `Credits ${s.credits} | Fuel ${s.fuel}/${getShip(s.shipId).fuelTankSize}`;
  }

  /** Called often (cheap): updates the numbers and the countdown without rebuilding the buttons. */
  tick(): void {
    this.summary.textContent = this.summaryText();
    const progress = this.game.progress();
    if (progress) {
      if (this.countdown) this.countdown.textContent = formatDuration(progress.remainingMs / 1000 / this.game.clock.speed);
      if (this.progressBar) this.progressBar.value = progress.fraction;
    }
    if (!this.game.state.currentJob && this.game.currentSlot() !== this.lastSlot) this.rebuild(); // board refreshes
  }

  /** Rebuilds the whole panel. Called when the game changes. */
  rebuild(): void {
    const game = this.game;
    const s = game.state;
    this.lastSlot = game.currentSlot();
    this.countdown = null;
    this.progressBar = null;
    this.summary.textContent = this.summaryText();
    this.body.replaceChildren();

    // Where am I
    const where = el("div", "tp-section");
    where.append(el("div", "tp-heading", "Location"));
    where.append(el("div", undefined, `${this.dockLabel(s.currentDockId)} | Ship: ${getShip(s.shipId).name}`));
    this.body.append(where);

    if (this.notice) this.body.append(el("div", "tp-section tp-notice", this.notice));

    // Funny debrief after a delivery
    if (game.lastArrival && !s.currentJob) {
      const a = game.lastArrival;
      const box = el("div", "tp-section tp-debrief");
      box.append(el("div", undefined, `Delivered! +${a.reward} credits`), el("div", undefined, a.debrief));
      this.body.append(box);
    }

    if (s.currentJob) {
      // In flight
      const job = s.currentJob;
      const sec = el("div", "tp-section");
      sec.append(el("div", "tp-heading", "Current job"));
      sec.append(el("div", undefined, `${job.amount} x ${job.itemName} to ${this.dockLabel(job.destinationDockId)}`));
      sec.append(el("div", undefined, `Reward on arrival: ${job.reward} credits`));
      const line = el("div", undefined, "Arrives in ");
      this.countdown = el("b");
      line.append(this.countdown);
      sec.append(line);
      this.progressBar = el("progress", "tp-progress");
      this.progressBar.max = 1;
      sec.append(this.progressBar);
      this.body.append(sec);
      this.tick();
    } else {
      // Docked: mission board
      const sec = el("div", "tp-section");
      sec.append(el("div", "tp-heading", "Mission board"));
      const list = el("ul", "tp-jobs");
      for (const entry of game.getBoard()) {
        const { job, block } = entry;
        const item = el("li", block ? "tp-job tp-blocked" : "tp-job");
        item.append(
          el("div", "tp-job-title", `${job.kind}: ${job.amount} x ${job.itemName} to ${this.dockLabel(job.destinationDockId)}`),
          el(
            "div",
            undefined,
            `${job.totalDistance} ly | pays ${job.reward} cr | trip ${formatDuration(entry.tripSeconds)} | fuel ${entry.fuelNeeded}`,
          ),
          el("div", "tp-blurb", job.blurb),
        );
        if (block) {
          item.append(el("div", "tp-reason", `Blocked: ${block.text}`));
        } else {
          const accept = el("button", undefined, "Accept");
          accept.type = "button";
          accept.addEventListener("click", () => {
            const result = game.accept(job.id);
            this.notice = result.ok ? "" : result.block.text;
            if (!result.ok) this.rebuild();
          });
          item.append(accept);
        }
        list.append(item);
      }
      sec.append(list);
      this.body.append(sec);

      // Refuel
      const preview = refuel(s);
      const fuelSec = el("div", "tp-section");
      const button = el("button", undefined, preview.ok ? `Refuel +${preview.units} for ${preview.cost} cr` : "Refuel");
      button.type = "button";
      button.disabled = !preview.ok;
      button.addEventListener("click", () => {
        const result = game.refuel();
        this.notice = result.ok ? "" : result.reason;
        if (!result.ok) this.rebuild();
      });
      fuelSec.append(button);
      if (!preview.ok) fuelSec.append(el("span", undefined, ` ${preview.reason}`));
      this.body.append(fuelSec);
    }
  }
}
