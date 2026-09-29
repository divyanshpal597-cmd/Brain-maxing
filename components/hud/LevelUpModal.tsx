import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { palette, rankColors } from '@/constants/theme';
import { levelUpBurst } from '@/lib/feedback';
import type { LevelUpEvent } from '@/types/hunter';

import { SystemModal } from './SystemModal';

export function LevelUpModal({ event, onClose }: { event: LevelUpEvent | null; onClose: () => void }) {
  const glow = useSharedValue(0);
  const pop = useSharedValue(0.6);

  useEffect(() => {
    if (!event) return;
    levelUpBurst();
    pop.value = 0.6;
    pop.value = withDelay(250, withSequence(withTiming(1.25, { duration: 220 }), withTiming(1, { duration: 260 })));
    glow.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [event, glow, pop]);

  const levelStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
    textShadowRadius: 8 + glow.value * 18,
  }));

  if (!event) return null;
  const promoted = event.toRank !== event.fromRank;

  return (
    <SystemModal visible title="Level Up!" onClose={onClose} accent={promoted ? palette.gold : palette.cyan}>
      <View className="items-center">
        <Text className="font-sans-semibold text-sm uppercase tracking-hud text-ink-muted">Your level has increased</Text>
        <View className="my-3 flex-row items-center">
          <Text className="font-mono text-2xl text-ink-muted">{event.fromLevel}</Text>
          <Text className="mx-3 font-mono text-xl text-ink-muted">→</Text>
          <Animated.Text
            style={[
              { fontFamily: 'SpaceMono-Bold', fontSize: 56, color: palette.cyan, textShadowColor: palette.cyan },
              levelStyle,
            ]}
          >
            {event.toLevel}
          </Animated.Text>
        </View>
        {promoted && (
          <Text className="mb-2 font-sans-bold text-base uppercase tracking-hud" style={{ color: rankColors[event.toRank] }}>
            Rank Up: {event.fromRank} → {event.toRank}-Rank
          </Text>
        )}
        <Text className="font-mono text-sm" style={{ color: palette.monarch }}>
          +{event.pointsGained} STAT POINTS
        </Text>
      </View>
    </SystemModal>
  );
}
