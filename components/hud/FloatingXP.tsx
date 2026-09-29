import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { fonts, palette } from '@/constants/theme';
import type { XPPulse } from '@/stores/useHunterStore';

/** "+30 EXP" that rises and fades each time `pulse.key` changes. */
export function FloatingXP({ pulse }: { pulse: XPPulse | null }) {
  const t = useSharedValue(1);

  useEffect(() => {
    if (!pulse) return;
    t.value = 0;
    t.value = withSequence(withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }));
  }, [pulse?.key, t]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.15 ? t.value / 0.15 : 1 - (t.value - 0.15) / 0.85,
    transform: [{ translateY: -40 * t.value }, { scale: 1 + 0.2 * (1 - t.value) }],
  }));

  if (!pulse) return null;
  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          right: 16,
          top: 8,
          fontFamily: fonts.monoBold,
          fontSize: 18,
          color: palette.cyan,
          textShadowColor: palette.cyan,
          textShadowRadius: 12,
        },
        style,
      ]}
    >
      +{pulse.amount} EXP
    </Animated.Text>
  );
}
