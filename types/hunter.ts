/**
 * Core domain models for HUNTER SYSTEM.
 * All timestamps are epoch milliseconds so they serialize cleanly through AsyncStorage.
 */

export const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'] as const;
export type HunterRank = (typeof RANKS)[number];

export const STAT_KEYS = ['STR', 'AGI', 'END', 'PER'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

/** STR: resistance volume · AGI: steps/cardio · END: duration/consistency · PER: recovery/sleep/hydration. */
export type HunterStats = Record<StatKey, number>;

export interface HunterProfile {
  id: string;
  name: string;
  level: number;
  rank: HunterRank;
  /** XP accumulated toward the next level (resets on level-up, carrying overflow). */
  currentXP: number;
  /** XP required to clear the current level: floor(100 * 1.15^(level - 1)). */
  nextLevelXP: number;
  /** Lifetime XP earned, never decreases. */
  totalXP: number;
  unallocatedPoints: number;
}

export type QuestCategory = 'strength' | 'agility' | 'endurance' | 'perception';

export type QuestUnit = 'reps' | 'km' | 'steps' | 'min' | 'ml' | 'hrs';

export interface DailyQuest {
  id: string;
  title: string;
  category: QuestCategory;
  targetValue: number;
  currentValue: number;
  unit: QuestUnit;
  isCompleted: boolean;
  /** Base XP granted on completion, before streak multiplier. */
  xpReward: number;
}

export interface EmergencyTask {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  currentValue: number;
  unit: QuestUnit;
}

export interface PenaltyState {
  isActive: boolean;
  /** Epoch ms when the Penalty Zone closes; null when inactive. */
  expiresAt: number | null;
  emergencyTask: EmergencyTask | null;
}

export type LootRarity = 'common' | 'rare' | 'legendary';

export type LootKind = 'recovery_item' | 'dungeon_key' | 'shadow_soldier';

export interface LootDrop {
  id: string;
  rarity: LootRarity;
  kind: LootKind;
  name: string;
  /** Legendary Shadow Soldiers grant a passive XP multiplier bonus (e.g. 0.05 = +5%). */
  xpBonus?: number;
  obtainedAt: number;
}

export interface StreakState {
  /** Consecutive days with the daily quest cleared (or penalty survived). */
  current: number;
  best: number;
  /** Local calendar day (YYYY-MM-DD) of the last cleared day. */
  lastClearedDay: string | null;
}

/** Payload describing everything granted when the daily quest is fully cleared. */
export interface QuestClearReward {
  xp: number;
  statPoints: number;
  loot: LootDrop;
}

/** Transient event the UI consumes to play the level-up sequence. */
export interface LevelUpEvent {
  fromLevel: number;
  toLevel: number;
  fromRank: HunterRank;
  toRank: HunterRank;
  pointsGained: number;
}
