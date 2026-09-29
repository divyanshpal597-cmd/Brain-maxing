# HUNTER SYSTEM

A Solo Leveling–style fitness RPG. Local-first Expo app: all game state lives in a persisted Zustand store, so it runs fully offline; Supabase is wired for cloud sync.

## Stack

Expo SDK 57 · Expo Router · TypeScript (strict) · NativeWind 4 · Zustand + AsyncStorage · Reanimated 4 · react-native-svg · Lucide · expo-haptics · expo-audio · Supabase

## Run

```bash
npm install
npm start          # then i / a / w
npm test           # engine + store unit tests
npm run typecheck
```

Copy `.env.example` to `.env` and fill in Supabase keys to enable the cloud client. Apply `supabase/migrations/` with `supabase db push`.

## Layout

| Path | Purpose |
| --- | --- |
| `types/hunter.ts` | Domain models (profile, stats, quests, penalty, loot) |
| `lib/progression.ts` | XP curve `floor(100·1.15^(L−1))`, rank bands, level-up rollover, streak multiplier |
| `lib/loot.ts` | 70/25/5 variable drop table, +1–3 stat point rolls, Shadow Soldier XP bonus |
| `lib/quests.ts` | Daily quest templates, Penalty Zone emergency tasks, day keys |
| `lib/feedback.ts` | Haptic + audio cues (quest tick, stat allocate, level-up, penalty) |
| `stores/useHunterStore.ts` | Persisted game store and all action handlers |
| `components/hud/` | HUD panels, XP bar, stat radar, quest card, penalty banner, system modals |
| `app/index.tsx` | Home HUD screen |
| `supabase/migrations/` | Postgres schema with RLS |

## Game rules

- **Ranks:** E (1–10) · D (11–25) · C (26–45) · B (46–70) · A (71–95) · S (96–100). +3 stat points per level.
- **Daily quest:** each goal grants XP × streak multiplier (+5%/day, max +50%, plus Shadow Soldier bonuses). Clearing all goals grants +50 bonus XP, +1–3 stat points and a loot roll.
- **Penalty Protocol:** a missed day opens a 4-hour Penalty Zone with a low-barrier recovery task (10-min stretch or 1,500 steps). Survive it and the streak is untouched; let it expire and the streak is halved, never zeroed.
