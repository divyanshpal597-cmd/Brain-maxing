import type { LootDrop, LootKind, LootRarity } from '@/types/hunter';
import { defaultRng, pick, randomInt, uid, type Rng } from '@/lib/random';

/** Variable-ratio drop table: 70% common / 25% rare / 5% legendary. */
export const LOOT_WEIGHTS: ReadonlyArray<readonly [LootRarity, number]> = [
  ['common', 0.7],
  ['rare', 0.25],
  ['legendary', 0.05],
];

const TABLE: Record<LootRarity, { kind: LootKind; names: readonly string[] }> = {
  common: {
    kind: 'recovery_item',
    names: ['Recovery Potion', 'Electrolyte Vial', 'Stretch Scroll', 'Foam Roller Relic'],
  },
  rare: {
    kind: 'dungeon_key',
    names: ['Dungeon Key: Iron Gate', 'Dungeon Key: Red Gate', 'Dungeon Key: Double Dungeon'],
  },
  legendary: {
    kind: 'shadow_soldier',
    names: ['Shadow Soldier: Igris', 'Shadow Soldier: Iron', 'Shadow Soldier: Tank', 'Shadow Soldier: Beru'],
  },
};

/** Passive XP bonus granted by each Shadow Soldier extraction. */
export const SHADOW_XP_BONUS = 0.05;

export function rollRarity(rng: Rng = defaultRng): LootRarity {
  let roll = rng();
  for (const [rarity, weight] of LOOT_WEIGHTS) {
    if (roll < weight) return rarity;
    roll -= weight;
  }
  return 'common';
}

export function rollLoot(rng: Rng = defaultRng, now = Date.now()): LootDrop {
  const rarity = rollRarity(rng);
  const entry = TABLE[rarity];
  return {
    id: uid('loot'),
    rarity,
    kind: entry.kind,
    name: pick(entry.names, rng),
    ...(rarity === 'legendary' ? { xpBonus: SHADOW_XP_BONUS } : {}),
    obtainedAt: now,
  };
}

/** Stat points granted for clearing the full daily quest: +1 to +3. */
export function rollStatPoints(rng: Rng = defaultRng): number {
  return randomInt(1, 3, rng);
}

export function shadowBonus(inventory: readonly LootDrop[]): number {
  return inventory.reduce((sum, item) => sum + (item.xpBonus ?? 0), 0);
}
