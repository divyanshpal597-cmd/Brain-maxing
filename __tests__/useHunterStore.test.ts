jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { dayKey, PENALTY_DURATION_MS } from '@/lib/quests';
import { useHunterStore } from '@/stores/useHunterStore';

const store = () => useHunterStore.getState();
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  store().resetHunter();
});

describe('quests', () => {
  it('clamps progress and completes at target', () => {
    store().logQuestProgress('pushups', 60);
    expect(store().quests.find((q) => q.id === 'pushups')?.currentValue).toBe(60);
    store().logQuestProgress('pushups', 999);
    const q = store().quests.find((q) => q.id === 'pushups');
    expect(q?.currentValue).toBe(100);
    expect(q?.isCompleted).toBe(true);
    expect(store().profile.totalXP).toBe(30);
    expect(store().xpPulse?.amount).toBe(30);
  });

  it('does not re-award completed quests', () => {
    store().completeQuest('pushups');
    store().completeQuest('pushups');
    expect(store().profile.totalXP).toBe(30);
  });

  it('grants the full-clear bundle when every quest is done', () => {
    for (const q of store().quests) store().completeQuest(q.id);
    const { lastReward, streak, inventory, profile, pendingLevelUp } = store();
    expect(lastReward).not.toBeNull();
    expect(lastReward!.statPoints).toBeGreaterThanOrEqual(1);
    expect(lastReward!.statPoints).toBeLessThanOrEqual(3);
    expect(inventory).toHaveLength(1);
    expect(streak.current).toBe(1);
    // 150 quest XP + 50 bonus = 200 -> level 2 (100) + 100 into level 2
    expect(profile.level).toBe(2);
    expect(pendingLevelUp?.toLevel).toBe(2);
    expect(profile.unallocatedPoints).toBe(3 + lastReward!.statPoints);
  });
});

describe('allocateStat', () => {
  it('spends points and no-ops at zero', () => {
    store().allocateStat('STR');
    expect(store().stats.STR).toBe(10);
    store().grantXP(100);
    store().allocateStat('STR');
    expect(store().stats.STR).toBe(11);
    expect(store().profile.unallocatedPoints).toBe(2);
  });
});

describe('penalty protocol', () => {
  const now = Date.now();

  it('opens a 4h Penalty Zone on a missed day and issues fresh quests', () => {
    store().logQuestProgress('pushups', 10);
    store().syncDay(now + DAY);
    const { penalty, quests, questDay } = store();
    expect(penalty.isActive).toBe(true);
    expect(penalty.expiresAt).toBe(now + DAY + PENALTY_DURATION_MS);
    expect(penalty.emergencyTask).not.toBeNull();
    expect(quests.every((q) => q.currentValue === 0)).toBe(true);
    expect(questDay).toBe(dayKey(now + DAY));
  });

  it('does not penalize a cleared day', () => {
    for (const q of store().quests) store().completeQuest(q.id);
    store().syncDay(now + DAY);
    expect(store().penalty.isActive).toBe(false);
  });

  it('preserves the streak when the emergency task is survived', () => {
    useHunterStore.setState({ streak: { current: 6, best: 6, lastClearedDay: null } });
    store().syncDay(now + DAY);
    const target = store().penalty.emergencyTask!.targetValue;
    store().logEmergencyProgress(target);
    expect(store().penalty.isActive).toBe(false);
    store().syncDay(now + DAY + PENALTY_DURATION_MS + 1);
    expect(store().streak.current).toBe(6);
  });

  it('halves (never zeroes) the streak when the zone expires', () => {
    useHunterStore.setState({ streak: { current: 7, best: 7, lastClearedDay: null } });
    store().syncDay(now + DAY);
    store().syncDay(now + DAY + PENALTY_DURATION_MS);
    expect(store().penalty.isActive).toBe(false);
    expect(store().streak.current).toBe(3);
    expect(store().streak.best).toBe(7);
  });
});
