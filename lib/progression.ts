import type { HunterProfile, HunterRank, LevelUpEvent } from '@/types/hunter';

export const MAX_LEVEL = 100;
/** Stat points awarded for each level gained. */
export const POINTS_PER_LEVEL = 3;
/** Each consecutive cleared day adds +5% XP, capped at +50%. */
export const STREAK_BONUS_PER_DAY = 0.05;
export const MAX_STREAK_BONUS = 0.5;

/** Upper bound (inclusive) of each rank's level band. */
const RANK_CEILINGS: ReadonlyArray<readonly [HunterRank, number]> = [
  ['E', 10],
  ['D', 25],
  ['C', 45],
  ['B', 70],
  ['A', 95],
  ['S', MAX_LEVEL],
];

/** XP required to clear `level` and reach `level + 1`. */
export function xpForNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.15, level - 1));
}

export function rankForLevel(level: number): HunterRank {
  for (const [rank, ceiling] of RANK_CEILINGS) {
    if (level <= ceiling) return rank;
  }
  return 'S';
}

export function streakMultiplier(streak: number, shadowBonus = 0): number {
  return 1 + Math.min(streak * STREAK_BONUS_PER_DAY, MAX_STREAK_BONUS) + shadowBonus;
}

export interface XPGainResult {
  profile: HunterProfile;
  levelUp: LevelUpEvent | null;
}

/**
 * Adds XP, rolling over as many levels as the amount covers. Overflow XP carries
 * into the next level; at MAX_LEVEL the bar stays full and further XP only counts
 * toward totalXP.
 */
export function applyXP(profile: HunterProfile, amount: number): XPGainResult {
  const gain = Math.max(0, Math.floor(amount));
  let { level, currentXP } = profile;
  const fromLevel = level;
  currentXP += gain;

  while (level < MAX_LEVEL && currentXP >= xpForNextLevel(level)) {
    currentXP -= xpForNextLevel(level);
    level += 1;
  }

  const nextLevelXP = xpForNextLevel(level);
  if (level >= MAX_LEVEL) currentXP = nextLevelXP;

  const levelsGained = level - fromLevel;
  const pointsGained = levelsGained * POINTS_PER_LEVEL;
  const rank = rankForLevel(level);

  return {
    profile: {
      ...profile,
      level,
      rank,
      currentXP,
      nextLevelXP,
      totalXP: profile.totalXP + gain,
      unallocatedPoints: profile.unallocatedPoints + pointsGained,
    },
    levelUp:
      levelsGained > 0
        ? { fromLevel, toLevel: level, fromRank: profile.rank, toRank: rank, pointsGained }
        : null,
  };
}

export function createProfile(name: string, id: string): HunterProfile {
  return {
    id,
    name,
    level: 1,
    rank: rankForLevel(1),
    currentXP: 0,
    nextLevelXP: xpForNextLevel(1),
    totalXP: 0,
    unallocatedPoints: 0,
  };
}
