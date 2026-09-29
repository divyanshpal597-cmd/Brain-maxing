import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { palette } from '@/constants/theme';

interface XPBarProps {
  current: number;
  max: number;
}

/** Holographic XP bar: spring-filled gradient with a sweeping scanline shimmer. */
export function XPBar({ current, max }: XPBarProps) {
  const progress = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const ratio = max > 0 ? Math.min(1, current / max) : 0;

  useEffect(() => {
    progress.value = withSpring(ratio, { damping: 18, stiffness: 90 });
  }, [ratio, progress]);

  useEffect(() => {
    shimmer.value = withRepeat(
      withDelay(800, withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) })),
      -1,
    );
  }, [shimmer]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const shimmerStyle = useAnimatedStyle(() => ({ left: `${shimmer.value * 120 - 20}%` }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Experience"
      accessibilityValue={{ min: 0, max, now: current }}
    >
      <View className="mb-1 flex-row items-end justify-between">
        <Text className="font-sans-semibold text-xs uppercase tracking-hud text-ink-muted">EXP</Text>
        <Text className="font-mono text-xs text-cyan">
          {current.toLocaleString()} / {max.toLocaleString()}
        </Text>
      </View>
      <View
        style={{ height: 10, backgroundColor: palette.void, borderWidth: 1, borderColor: palette.line, overflow: 'hidden' }}
      >
        <Animated.View style={[{ height: '100%', overflow: 'hidden' }, fillStyle]}>
          <LinearGradient
            colors={[palette.monarch, palette.cyan]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
          <Animated.View
            style={[
              { position: 'absolute', top: 0, bottom: 0, width: '20%', backgroundColor: '#FFFFFF40' },
              shimmerStyle,
            ]}
          />
        </Animated.View>
      </View>
    </View>
  );
}
