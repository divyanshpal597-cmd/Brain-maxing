import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { rollLoot, rollStatPoints, shadowBonus } from '@/lib/loot';
import { applyXP, createProfile, streakMultiplier } from '@/lib/progression';
import {
  allCleared,
  DAILY_CLEAR_BONUS_XP,
  dayKey,
  generateDailyQuests,
  PENALTY_DURATION_MS,
  rollEmergencyTask,
} from '@/lib/quests';
import { uid } from '@/lib/random';
import type {
  DailyQuest,
  HunterProfile,
  HunterStats,
  LevelUpEvent,
  LootDrop,
  PenaltyState,
  QuestClearReward,
  StatKey,
  StreakState,
} from '@/types/hunter';

/** Floating "+XP" indicator; `key` changes on every gain so the UI can replay the animation. */
export interface XPPulse {
  amount: number;
  key: string;
}

interface HunterState {
  profile: HunterProfile;
  stats: HunterStats;
  quests: DailyQuest[];
  /** Day the current quest list was issued for. */
  questDay: string | null;
  streak: StreakState;
  penalty: PenaltyState;
  inventory: LootDrop[];

  // Transient UI events (not persisted).
  pendingLevelUp: LevelUpEvent | null;
  lastReward: QuestClearReward | null;
  xpPulse: XPPulse | null;
}

interface HunterActions {
  setName: (name: string) => void;
  /** Roll the day over, issue new quests, and open/close the Penalty Zone. Call on launch and foreground. */
  syncDay: (now?: number) => void;
  logQuestProgress: (questId: string, amount: number) => void;
  completeQuest: (questId: string) => void;
  allocateStat: (stat: StatKey) => void;
  logEmergencyProgress: (amount: number) => void;
  completeEmergencyTask: () => void;
  grantXP: (amount: number) => void;
  dismissLevelUp: () => void;
  dismissReward: () => void;
  resetHunter: () => void;
}

export type HunterStore = HunterState & HunterActions;

const INITIAL_STATS: HunterStats = { STR: 10, AGI: 10, END: 10, PER: 10 };
const INACTIVE_PENALTY: PenaltyState = { isActive: false, expiresAt: null, emergencyTask: null };

function initialState(): HunterState {
  return {
    profile: createProfile('Sung Jin-Woo', uid('hunter')),
    stats: { ...INITIAL_STATS },
    quests: generateDailyQuests(),
    questDay: dayKey(Date.now()),
    streak: { current: 0, best: 0, lastClearedDay: null },
    penalty: INACTIVE_PENALTY,
    inventory: [],
    pendingLevelUp: null,
    lastReward: null,
    xpPulse: null,
  };
}

/** Collapse back-to-back level-ups into one event so the modal shows the full jump. */
function mergeLevelUp(prev: LevelUpEvent | null, next: LevelUpEvent | null): LevelUpEvent | null {
  if (!next) return prev;
  if (!prev) return next;
  return {
    fromLevel: prev.fromLevel,
    fromRank: prev.fromRank,
    toLevel: next.toLevel,
    toRank: next.toRank,
    pointsGained: prev.pointsGained + next.pointsGained,
  };
}

export const useHunterStore = create<HunterStore>()(
  persist(
    (set, get) => {
      /** Applies XP with streak + Shadow Soldier multipliers and queues level-up/pulse events. */
      const gainXP = (base: number, multiplied = true): number => {
        const { profile, streak, inventory, pendingLevelUp } = get();
        const mult = multiplied ? streakMultiplier(streak.current, shadowBonus(inventory)) : 1;
        const amount = Math.round(base * mult);
        const result = applyXP(profile, amount);
        set({
          profile: result.profile,
          pendingLevelUp: mergeLevelUp(pendingLevelUp, result.levelUp),
          xpPulse: { amount, key: uid('xp') },
        });
        return amount;
      };

      /** Grants the full-clear bundle: bonus XP, +1–3 stat points, a loot roll, and a streak tick. */
      const clearDailyQuest = () => {
        const xp = gainXP(DAILY_CLEAR_BONUS_XP);
        const statPoints = rollStatPoints();
        const loot = rollLoot();
        const { profile, streak, inventory } = get();
        const current = streak.current + 1;
        set({
          profile: { ...profile, unallocatedPoints: profile.unallocatedPoints + statPoints },
          inventory: [...inventory, loot],
          streak: {
            current,
            best: Math.max(streak.best, current),
            lastClearedDay: dayKey(Date.now()),
          },
          lastReward: { xp, statPoints, loot },
        });
      };

      const updateQuest = (questId: string, nextValue: (q: DailyQuest) => number) => {
        const quest = get().quests.find((q) => q.id === questId);
        if (!quest || quest.isCompleted) return;

        const currentValue = Math.max(0, Math.min(quest.targetValue, nextValue(quest)));
        const isCompleted = currentValue >= quest.targetValue;
        const quests = get().quests.map((q) =>
          q.id === questId ? { ...q, currentValue, isCompleted } : q,
        );
        set({ quests });

        if (!isCompleted) return;
        gainXP(quest.xpReward);
        if (allCleared(quests)) clearDailyQuest();
      };

      return {
        ...initialState(),

        setName: (name) => set((s) => ({ profile: { ...s.profile, name: name.trim() || s.profile.name } })),

        syncDay: (now = Date.now()) => {
          const { penalty, streak, quests, questDay } = get();

          // Penalty Zone expired unsurvived: decay the streak by half. Never zero it outright.
          if (penalty.isActive && penalty.expiresAt !== null && now >= penalty.expiresAt) {
            set({
              penalty: INACTIVE_PENALTY,
              streak: { ...streak, current: Math.floor(streak.current / 2) },
            });
          }

          const today = dayKey(now);
          if (questDay === today) return;

          const missed = questDay !== null && !allCleared(quests);
          set({
            quests: generateDailyQuests(),
            questDay: today,
            ...(missed && !get().penalty.isActive
              ? {
                  penalty: {
                    isActive: true,
                    expiresAt: now + PENALTY_DURATION_MS,
                    emergencyTask: rollEmergencyTask(),
                  },
                }
              : {}),
          });
        },

        logQuestProgress: (questId, amount) => updateQuest(questId, (q) => q.currentValue + amount),

        completeQuest: (questId) => updateQuest(questId, (q) => q.targetValue),

        allocateStat: (stat) => {
          const { profile, stats } = get();
          if (profile.unallocatedPoints <= 0) return;
          set({
            profile: { ...profile, unallocatedPoints: profile.unallocatedPoints - 1 },
            stats: { ...stats, [stat]: stats[stat] + 1 },
          });
        },

        logEmergencyProgress: (amount) => {
          const { penalty } = get();
          const task = penalty.emergencyTask;
          if (!penalty.isActive || !task) return;
          const currentValue = Math.min(task.targetValue, task.currentValue + amount);
          if (currentValue >= task.targetValue) {
            get().completeEmergencyTask();
            return;
          }
          set({ penalty: { ...penalty, emergencyTask: { ...task, currentValue } } });
        },

        // Surviving the Penalty Zone preserves the streak multiplier untouched.
        completeEmergencyTask: () => {
          if (!get().penalty.isActive) return;
          set({ penalty: INACTIVE_PENALTY });
          gainXP(10, false);
        },

        grantXP: (amount) => {
          gainXP(amount, false);
        },

        dismissLevelUp: () => set({ pendingLevelUp: null }),
        dismissReward: () => set({ lastReward: null }),
        resetHunter: () => set(initialState()),
      };
    },
    {
      name: 'hunter-system/v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ profile, stats, quests, questDay, streak, penalty, inventory }) => ({
        profile,
        stats,
        quests,
        questDay,
        streak,
        penalty,
        inventory,
      }),
    },
  ),
);
