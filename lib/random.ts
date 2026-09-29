/** Injectable RNG so reward logic stays deterministic under test. Returns [0, 1). */
export type Rng = () => number;

export const defaultRng: Rng = Math.random;

export function randomInt(min: number, max: number, rng: Rng = defaultRng): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(items: readonly T[], rng: Rng = defaultRng): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error('pick() called with an empty list');
  return item;
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
