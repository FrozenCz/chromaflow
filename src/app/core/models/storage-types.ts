/**
 * Typed keys and payload shapes for values persisted via StorageService.
 *
 * Keys are stored as a frozen `as const` object so that consumers reference
 * them symbolically (e.g. `StorageKey.CampaignProgress`) while the underlying
 * string value is stable for LocalStorage.
 */
export const StorageKey = {
  CampaignProgress: 'chromaflow.campaignProgress',
  GameSettings: 'chromaflow.gameSettings',
  DailyStreak: 'chromaflow.dailyStreak',
  OverallStats: 'chromaflow.overallStats',
} as const;

export type StorageKey = (typeof StorageKey)[keyof typeof StorageKey];

/**
 * Progress for a single completed campaign level.
 */
export interface LevelProgress {
  /** Stable level identifier (e.g. `w1-l3`). */
  readonly levelId: string;
  /** Number of stars earned (0-3). */
  readonly stars: number;
  /** Lowest move count achieved so far. */
  readonly bestMoves: number;
  /** ISO 8601 timestamp of the latest completion. */
  readonly completedAt: string;
}

/**
 * Aggregated campaign progress across all worlds/levels.
 */
export interface CampaignProgress {
  /** Map of levelId → progress entry for completed levels. */
  readonly completedLevels: Readonly<Record<string, LevelProgress>>;
  /** Total stars collected across all completed levels. */
  readonly totalStars: number;
}

/**
 * User-configurable game settings.
 */
export interface GameSettings {
  /** Master volume between 0 and 1. */
  readonly volume: number;
  /** Whether sound effects are muted. */
  readonly muted: boolean;
  /** Whether dark mode is enabled. */
  readonly darkMode: boolean;
}

/**
 * Daily challenge streak tracker.
 */
export interface DailyStreak {
  /** Current consecutive-day streak count. */
  readonly currentStreak: number;
  /** Longest streak ever achieved. */
  readonly longestStreak: number;
  /** ISO date (YYYY-MM-DD) of the most recent completed daily challenge. */
  readonly lastCompletedDate: string | null;
}

/**
 * Aggregated gameplay statistics.
 */
export interface OverallStats {
  /** Total levels completed across all modes. */
  readonly totalLevelsCompleted: number;
  /** Total moves the player has performed. */
  readonly totalMoves: number;
  /** Total play time in seconds. */
  readonly totalPlayTimeSeconds: number;
  /** Number of perfect (3-star) completions. */
  readonly perfectCompletions: number;
}

/**
 * Compile-time mapping from a `StorageKey` to the shape stored under it.
 * Used by `StorageService` to provide strongly-typed convenience helpers.
 */
export interface StorageValueMap {
  [StorageKey.CampaignProgress]: CampaignProgress;
  [StorageKey.GameSettings]: GameSettings;
  [StorageKey.DailyStreak]: DailyStreak;
  [StorageKey.OverallStats]: OverallStats;
}
