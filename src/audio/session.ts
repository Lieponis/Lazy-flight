// iPhone audio session (Agent 7e, bug S1): the game must NOT stop the player's other media (Spotify, YouTube...).
//
// On iPhone, a web page that makes sound normally takes over the phone's audio and pauses other apps.
// Safari 16.4+ has `navigator.audioSession.type`. "ambient" means: mix with other apps' audio, and follow the
// silent switch (switch on silent = the game is quiet). Other browsers (Android, desktop) do not have it: then
// nothing happens, and they already mix sounds anyway.

/** The bit of `navigator` we need. Kept loose so tests can pass a fake. */
export interface NavigatorLike {
  audioSession?: { type?: string } | null;
}

export type SessionResult = "set" | "already" | "unsupported" | "failed";

/**
 * Asks the browser to MIX the game's sound with other apps (type "ambient"). Call right before the sound engine
 * is created or woken. Never throws. Returns what happened (for tests and the report).
 */
export function useAmbientAudioSession(nav: NavigatorLike | undefined = (globalThis as { navigator?: NavigatorLike }).navigator): SessionResult {
  try {
    const session = nav?.audioSession;
    if (!session || typeof session !== "object" || !("type" in session)) return "unsupported";
    if (session.type === "ambient") return "already";
    session.type = "ambient";
    return session.type === "ambient" ? "set" : "failed";
  } catch {
    return "failed";
  }
}
