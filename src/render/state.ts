// What is selected right now. Agent 4 and Agent 5 can READ this (and listen for changes)
// without knowing anything about drawing.

export type ScreenName = "starmap" | "system" | "flight";

export interface RenderState {
  /** Which screen is showing. */
  screen: ScreenName;
  /** The system the player is in, e.g. "3:-2:5:0". */
  currentSystemId: string;
  /** Star selected on the starmap, or null. */
  selectedSystemId: string | null;
  /** The system shown in the system view (null while on the starmap). */
  viewedSystemId: string | null;
  /** Planet (and dock) selected in the system view, e.g. "3:-2:5:0/2", or null. */
  selectedPlanetId: string | null;
}

export type StateListener = (state: Readonly<RenderState>) => void;

export class StateStore {
  private state: RenderState;
  private listeners: StateListener[] = [];

  constructor(currentSystemId: string) {
    this.state = {
      screen: "starmap",
      currentSystemId,
      selectedSystemId: null,
      viewedSystemId: null,
      selectedPlanetId: null,
    };
  }

  get(): Readonly<RenderState> {
    return this.state;
  }

  set(patch: Partial<RenderState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners.slice()) listener(this.state);
  }

  /** Returns a function that stops listening. */
  subscribe(listener: StateListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}
