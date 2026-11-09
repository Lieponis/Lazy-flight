// Ranks: one set per job kind (cargo, passengers, tours), earned by delivering jobs of that kind.
// Rank 1 is where everybody starts. Higher rank = bigger-paying jobs unlocked + a small pay bonus.
// All the numbers are in settings.ts; the funny names are here.

import { RANK_JOBS_NEEDED, RANK_MAX_REWARD, RANK_REWARD_BONUS_PERCENT } from "./settings";
import type { Job } from "../universe";

export type RankKind = "TRADE" | "PASSENGER" | "TOUR";
export const RANK_KINDS: RankKind[] = ["TRADE", "PASSENGER", "TOUR"];

/** What the player sees as the name of the category. */
export const RANK_KIND_LABELS: Record<RankKind, string> = {
  TRADE: "cargo",
  PASSENGER: "passengers",
  TOUR: "tours",
};

/** The three funny rank names of each kind. Edit freely. */
export const RANK_NAMES: Record<RankKind, [string, string, string]> = {
  TRADE: ["Box Pusher", "Crate Wrangler", "Freight Baron"],
  PASSENGER: ["Snack Cart Rookie", "Seatbelt Sheriff", "Captain Comfort"],
  TOUR: ["Flag Holder", "Tour Wrangler", "Grand Guide"],
};

/** How many jobs of each kind you have delivered. Plain numbers, saved with the game. */
export type CompletedJobs = Record<RankKind, number>;

export function emptyCompletedJobs(): CompletedJobs {
  return { TRADE: 0, PASSENGER: 0, TOUR: 0 };
}

export function isRankKind(kind: string): kind is RankKind {
  return kind === "TRADE" || kind === "PASSENGER" || kind === "TOUR";
}

/** 0, 1 or 2 (= rank 1, 2 or 3) for this many delivered jobs of a kind. */
export function rankIndexFor(kind: RankKind, jobsDone: number): 0 | 1 | 2 {
  const [second, third] = RANK_JOBS_NEEDED[kind];
  return jobsDone >= third ? 2 : jobsDone >= second ? 1 : 0;
}

/** The lowest rank (0, 1 or 2) needed to take this job. Based on its plain reward. Other kinds need none. */
export function requiredRankIndex(job: Job): 0 | 1 | 2 {
  if (!isRankKind(job.kind)) return 0;
  const [first, second] = RANK_MAX_REWARD[job.kind];
  return job.reward <= first ? 0 : job.reward <= second ? 1 : 2;
}

/** Extra pay percent a player of this rank gets on a job of this kind. */
export function rankBonusPercent(kind: string, completed: CompletedJobs): number {
  if (!isRankKind(kind)) return 0;
  return RANK_REWARD_BONUS_PERCENT[rankIndexFor(kind, completed[kind])];
}

/** One row of the ranks screen. */
export interface RankInfo {
  kind: RankKind;
  /** "cargo", "passengers" or "tours". */
  label: string;
  jobsDone: number;
  /** 0, 1 or 2. */
  rankIndex: 0 | 1 | 2;
  /** 1, 2 or 3. */
  rankNumber: number;
  rankName: string;
  /** The next rank's name, or null at the top. */
  nextRankName: string | null;
  /** Jobs still to deliver for the next rank, or null at the top. */
  jobsToNext: number | null;
  /** Extra pay percent at this rank. */
  rewardBonusPercent: number;
  /** The biggest reward you may take at this rank, or null (no limit) at the top. */
  maxReward: number | null;
}

export function rankInfos(completed: CompletedJobs): RankInfo[] {
  return RANK_KINDS.map((kind) => {
    const jobsDone = completed[kind];
    const rankIndex = rankIndexFor(kind, jobsDone);
    const needed = RANK_JOBS_NEEDED[kind];
    return {
      kind,
      label: RANK_KIND_LABELS[kind],
      jobsDone,
      rankIndex,
      rankNumber: rankIndex + 1,
      rankName: RANK_NAMES[kind][rankIndex],
      nextRankName: rankIndex === 2 ? null : RANK_NAMES[kind][rankIndex + 1],
      jobsToNext: rankIndex === 2 ? null : Math.max(0, needed[rankIndex] - jobsDone),
      rewardBonusPercent: RANK_REWARD_BONUS_PERCENT[rankIndex],
      maxReward: rankIndex === 2 ? null : RANK_MAX_REWARD[kind][rankIndex],
    };
  });
}
