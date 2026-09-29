import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { palette } from '@/constants/theme';
import { cue } from '@/lib/feedback';
import { QUEST_STEP } from '@/lib/quests';
import type { PenaltyState } from '@/types/hunter';

import { HudPanel } from './HudPanel';
import { SystemLabel } from './SystemLabel';

function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

interface Props {
  penalty: PenaltyState;
  onLog: (amount: number) => void;
  onExpire: () => void;
}

/** Penalty Zone: 4h survival countdown with a low-barrier recovery task. */
export function PenaltyBanner({ penalty, onLog, onExpire }: Props) {
  const [now, setNow] = useState(Date.now());

  // Alarm once when the zone opens.
  useEffect(() => {
    if (penalty.isActive) cue('penalty');
  }, [penalty.expiresAt]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = (penalty.expiresAt ?? 0) - now;
  useEffect(() => {
    if (penalty.isActive && remaining <= 0) onExpire();
  }, [penalty.isActive, remaining <= 0, onExpire]);

  const task = penalty.emergencyTask;
  if (!penalty.isActive || !task) return null;
  const step = QUEST_STEP[task.unit];

  return (
    <HudPanel accent={palette.crimson}>
      <View className="flex-row items-center justify-between">
        <SystemLabel color={palette.crimson}>Penalty Zone</SystemLabel>
        <AlertTriangle size={16} color={palette.crimson} style={{ marginBottom: 12 }} />
      </View>
      <Text
        accessibilityLabel={`Time remaining ${formatRemaining(remaining)}`}
        className="mb-2 text-center font-mono-bold text-3xl"
        style={{ color: palette.crimson }}
      >
        {formatRemaining(remaining)}
      </Text>
      <Text className="text-center font-sans-bold text-base uppercase text-ink">{task.title}</Text>
      <Text className="mb-3 text-center font-sans text-sm text-ink-muted">
        {task.description} Survive to preserve your streak multiplier.
      </Text>
      <View className="flex-row items-center">
        <View className="mr-3 h-[4px] flex-1 bg-void">
          <View
            style={{
              width: `${(task.currentValue / task.targetValue) * 100}%`,
              height: '100%',
              backgroundColor: palette.crimson,
            }}
          />
        </View>
        <Text className="mr-3 font-mono text-xs text-ink">
          {task.currentValue}/{task.targetValue} {task.unit}
        </Text>
        <Pressable
          onPress={() => {
            cue('questTick');
            onLog(step);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Log ${step} ${task.unit}`}
          className="h-10 items-center justify-center border px-3"
          style={{ borderColor: palette.crimson }}
        >
          <Text className="font-mono text-xs" style={{ color: palette.crimson }}>
            +{step}
          </Text>
        </Pressable>
      </View>
    </HudPanel>
  );
}
