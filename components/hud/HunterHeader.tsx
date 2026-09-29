import { Flame } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { palette } from '@/constants/theme';
import { streakMultiplier } from '@/lib/progression';
import type { HunterProfile, StreakState } from '@/types/hunter';

import { HudPanel } from './HudPanel';
import { RankBadge } from './RankBadge';
import { XPBar } from './XPBar';

interface Props {
  profile: HunterProfile;
  streak: StreakState;
  shadowBonus: number;
}

export function HunterHeader({ profile, streak, shadowBonus }: Props) {
  const mult = streakMultiplier(streak.current, shadowBonus);
  return (
    <HudPanel>
      <View className="mb-4 flex-row items-center">
        <RankBadge rank={profile.rank} />
        <View className="ml-5 flex-1">
          <Text className="font-sans-semibold text-xs uppercase tracking-hud text-ink-muted">Player</Text>
          <Text numberOfLines={1} className="font-sans-bold text-2xl text-ink">
            {profile.name}
          </Text>
          <Text className="font-sans-semibold text-xs uppercase tracking-hud" style={{ color: palette.monarch }}>
            {profile.rank}-Rank Hunter
          </Text>
        </View>
        <View className="items-end">
          <Text className="font-sans-semibold text-xs uppercase tracking-hud text-ink-muted">Level</Text>
          <Text className="font-mono-bold text-4xl text-cyan">{profile.level}</Text>
        </View>
      </View>

      <XPBar current={profile.currentXP} max={profile.nextLevelXP} />

      <View className="mt-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Flame size={14} color={palette.gold} />
          <Text className="ml-1 font-mono text-xs text-ink">
            STREAK {streak.current}d
          </Text>
        </View>
        <Text className="font-mono text-xs text-ink-muted">EXP ×{mult.toFixed(2)}</Text>
      </View>
    </HudPanel>
  );
}
