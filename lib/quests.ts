import type { DailyQuest, EmergencyTask, QuestCategory, StatKey } from '@/types/hunter';
import { defaultRng, pick, type Rng } from '@/lib/random';

/** Penalty Zone lasts 4 hours from the moment a missed day is detected. */
export const PENALTY_DURATION_MS = 4 * 60 * 60 * 1000;
/** Base XP granted on top of per-quest XP when every daily quest is cleared. */
export const DAILY_CLEAR_BONUS_XP = 50;

export const CATEGORY_STAT: Record<QuestCategory, StatKey> = {
  strength: 'STR',
  agility: 'AGI',
  endurance: 'END',
  perception: 'PER',
};

type QuestTemplate = Omit<DailyQuest, 'currentValue' | 'isCompleted'>;

/** "DAILY QUEST: PREPARATION TO BECOME STRONG" */
export const DAILY_QUEST_TEMPLATES: readonly QuestTemplate[] = [
  { id: 'pushups', title: 'Push-ups', category: 'strength', targetValue: 100, unit: 'reps', xpReward: 30 },
  { id: 'situps', title: 'Sit-ups', category: 'endurance', targetValue: 100, unit: 'reps', xpReward: 30 },
  { id: 'squats', title: 'Squats', category: 'strength', targetValue: 100, unit: 'reps', xpReward: 30 },
  { id: 'run', title: 'Running', category: 'agility', targetValue: 10, unit: 'km', xpReward: 40 },
  { id: 'hydrate', title: 'Hydration', category: 'perception', targetValue: 2000, unit: 'ml', xpReward: 20 },
];

export function generateDailyQuests(): DailyQuest[] {
  return DAILY_QUEST_TEMPLATES.map((t) => ({ ...t, currentValue: 0, isCompleted: false }));
}

const EMERGENCY_TEMPLATES: readonly EmergencyTask[] = [
  {
    id: 'stretch',
    title: 'Survival Protocol: Stretch',
    description: 'Complete 10 minutes of mobility stretching.',
    targetValue: 10,
    currentValue: 0,
    unit: 'min',
  },
  {
    id: 'recovery_walk',
    title: 'Survival Protocol: Recovery Walk',
    description: 'Walk 1,500 recovery steps.',
    targetValue: 1500,
    currentValue: 0,
    unit: 'steps',
  },
];

export function rollEmergencyTask(rng: Rng = defaultRng): EmergencyTask {
  return { ...pick(EMERGENCY_TEMPLATES, rng) };
}

/** Local calendar day key (YYYY-MM-DD). */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function allCleared(quests: readonly DailyQuest[]): boolean {
  return quests.length > 0 && quests.every((q) => q.isCompleted);
}

/** Amount a single "+" tap logs, per unit. */
export const QUEST_STEP: Record<DailyQuest['unit'], number> = {
  reps: 10,
  km: 1,
  steps: 500,
  min: 1,
  ml: 250,
  hrs: 1,
};
