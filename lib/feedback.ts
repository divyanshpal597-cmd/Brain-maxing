import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

/**
 * Tactile + audio cues for the System HUD. Every call is fire-and-forget and
 * swallows failures: feedback must never block or crash a state change.
 */

const SOURCES = {
  questTick: require('@/assets/sfx/quest-tick.wav'),
  statAllocate: require('@/assets/sfx/stat-allocate.wav'),
  levelUp: require('@/assets/sfx/level-up.wav'),
  penalty: require('@/assets/sfx/penalty.wav'),
} as const;

export type Cue = keyof typeof SOURCES;

const players: Partial<Record<Cue, AudioPlayer>> = {};
let initialized = false;

/** Preload players once at app start so the first cue has no decode latency. */
export async function initFeedback(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    // Game SFX should mix with the user's workout music, not pause it.
    await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
    for (const cue of Object.keys(SOURCES) as Cue[]) {
      players[cue] = createAudioPlayer(SOURCES[cue]);
    }
  } catch {
    // Audio unavailable (e.g. web without user gesture) — haptics still work.
  }
}

function playSound(cue: Cue) {
  const player = players[cue];
  if (!player) return;
  try {
    player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    // ignore
  }
}

const HAPTICS: Record<Cue, () => Promise<void>> = {
  questTick: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  statAllocate: () => Haptics.selectionAsync(),
  levelUp: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  penalty: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};

export function cue(name: Cue): void {
  HAPTICS[name]().catch(() => {});
  playSound(name);
}

/** Staggered heavy pulses for the level-up sequence. */
export function levelUpBurst(): void {
  cue('levelUp');
  [120, 260, 420].forEach((delay) =>
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}), delay),
  );
}
