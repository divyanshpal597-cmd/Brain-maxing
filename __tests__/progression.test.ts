import { rollLoot, rollRarity, rollStatPoints } from '@/lib/loot';
import { applyXP, createProfile, MAX_LEVEL, rankForLevel, streakMultiplier, xpForNextLevel } from '@/lib/progression';

describe('xpForNextLevel', () => {
  it('follows floor(100 * 1.15^(level-1))', () => {
    expect(xpForNextLevel(1)).toBe(100);
    expect(xpForNextLevel(2)).toBe(114);
    expect(xpForNextLevel(10)).toBe(Math.floor(100 * Math.pow(1.15, 9)));
  });
});

describe('rankForLevel', () => {
  it.each([
    [1, 'E'], [10, 'E'], [11, 'D'], [25, 'D'], [26, 'C'], [45, 'C'],
    [46, 'B'], [70, 'B'], [71, 'A'], [95, 'A'], [96, 'S'], [100, 'S'],
  ] as const)('level %i -> %s', (level, rank) => {
    expect(rankForLevel(level)).toBe(rank);
  });
});

describe('applyXP', () => {
  const base = createProfile('Test', 'h1');

  it('accumulates without leveling below threshold', () => {
    const { profile, levelUp } = applyXP(base, 99);
    expect(profile.level).toBe(1);
    expect(profile.currentXP).toBe(99);
    expect(levelUp).toBeNull();
  });

  it('carries overflow across multiple levels and awards points', () => {
    const { profile, levelUp } = applyXP(base, 100 + 114 + 5);
    expect(profile.level).toBe(3);
    expect(profile.currentXP).toBe(5);
    expect(profile.nextLevelXP).toBe(xpForNextLevel(3));
    expect(profile.unallocatedPoints).toBe(6);
    expect(levelUp).toEqual({ fromLevel: 1, toLevel: 3, fromRank: 'E', toRank: 'E', pointsGained: 6 });
  });

  it('reports rank promotion', () => {
    let total = 0;
    for (let l = 1; l <= 10; l++) total += xpForNextLevel(l);
    const { profile, levelUp } = applyXP(base, total);
    expect(profile.level).toBe(11);
    expect(levelUp?.toRank).toBe('D');
  });

  it('caps at MAX_LEVEL', () => {
    const { profile } = applyXP(base, 1e12);
    expect(profile.level).toBe(MAX_LEVEL);
    expect(profile.currentXP).toBe(profile.nextLevelXP);
    expect(profile.totalXP).toBe(1e12);
  });

  it('ignores negative XP', () => {
    expect(applyXP(base, -50).profile.currentXP).toBe(0);
  });
});

describe('streakMultiplier', () => {
  it('scales 5%/day and caps at +50%', () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(4)).toBeCloseTo(1.2);
    expect(streakMultiplier(40)).toBeCloseTo(1.5);
    expect(streakMultiplier(40, 0.1)).toBeCloseTo(1.6);
  });
});

describe('loot', () => {
  it('maps rolls onto the 70/25/5 table', () => {
    expect(rollRarity(() => 0)).toBe('common');
    expect(rollRarity(() => 0.69)).toBe('common');
    expect(rollRarity(() => 0.7)).toBe('rare');
    expect(rollRarity(() => 0.949)).toBe('rare');
    expect(rollRarity(() => 0.95)).toBe('legendary');
  });

  it('gives legendary drops an XP bonus', () => {
    const drop = rollLoot(() => 0.99);
    expect(drop.kind).toBe('shadow_soldier');
    expect(drop.xpBonus).toBeGreaterThan(0);
  });

  it('rolls stat points in [1, 3]', () => {
    expect(rollStatPoints(() => 0)).toBe(1);
    expect(rollStatPoints(() => 0.999)).toBe(3);
  });
});
