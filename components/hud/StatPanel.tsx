import { Plus } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { palette } from '@/constants/theme';
import { cue } from '@/lib/feedback';
import { STAT_KEYS, type HunterStats, type StatKey } from '@/types/hunter';

import { HudPanel } from './HudPanel';
import { StatRadar } from './StatRadar';
import { SystemLabel } from './SystemLabel';

const STAT_META: Record<StatKey, { name: string; hint: string }> = {
  STR: { name: 'Strength', hint: 'Resistance & reps' },
  AGI: { name: 'Agility', hint: 'Steps, pace & HIIT' },
  END: { name: 'Endurance', hint: 'Duration & consistency' },
  PER: { name: 'Perception', hint: 'Sleep, hydration & recovery' },
};

interface Props {
  stats: HunterStats;
  points: number;
  onAllocate: (stat: StatKey) => void;
}

function StatCard({ stat, value, canAllocate, onAllocate }: {
  stat: StatKey;
  value: number;
  canAllocate: boolean;
  onAllocate: () => void;
}) {
  const meta = STAT_META[stat];
  return (
    <View
      className="mb-2 flex-row items-center border border-line bg-panel-raised px-3 py-2"
      style={{ minHeight: 52 }}
    >
      <View className="flex-1">
        <View className="flex-row items-baseline">
          <Text className="w-12 font-mono-bold text-sm text-cyan">{stat}</Text>
          <Text className="font-mono-bold text-xl text-ink">{value}</Text>
        </View>
        <Text className="font-sans text-xs text-ink-muted">
          {meta.name} · {meta.hint}
        </Text>
      </View>
      {canAllocate && (
        <Pressable
          onPress={() => {
            cue('statAllocate');
            onAllocate();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Allocate a point to ${meta.name}`}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center border border-cyan active:bg-cyan/20"
        >
          <Plus size={18} color={palette.cyan} />
        </Pressable>
      )}
    </View>
  );
}

export function StatPanel({ stats, points, onAllocate }: Props) {
  return (
    <HudPanel accent={points > 0 ? palette.monarch : palette.cyan}>
      <View className="flex-row items-center justify-between">
        <SystemLabel>Status</SystemLabel>
        {points > 0 && (
          <Text className="mb-3 font-mono text-xs" style={{ color: palette.monarch }}>
            AVAILABLE POINTS: {points}
          </Text>
        )}
      </View>
      <View className="mb-3 items-center">
        <StatRadar stats={stats} />
      </View>
      {STAT_KEYS.map((k) => (
        <StatCard
          key={k}
          stat={k}
          value={stats[k]}
          canAllocate={points > 0}
          onAllocate={() => onAllocate(k)}
        />
      ))}
    </HudPanel>
  );
}
