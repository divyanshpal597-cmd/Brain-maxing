import { useEffect, type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { palette } from '@/constants/theme';

interface HudPanelProps {
  children: ReactNode;
  accent?: string;
  /** Breathing glow on the border. Disable for dense lists to save frames. */
  glow?: boolean;
  className?: string;
  style?: ViewStyle;
}

const CORNER = 12;

function Corner({ color, position }: { color: string; position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const top = position[0] === 't';
  const left = position[1] === 'l';
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: CORNER,
        height: CORNER,
        [top ? 'top' : 'bottom']: -1,
        [left ? 'left' : 'right']: -1,
        borderColor: color,
        [top ? 'borderTopWidth' : 'borderBottomWidth']: 2,
        [left ? 'borderLeftWidth' : 'borderRightWidth']: 2,
      }}
    />
  );
}

/** Holographic System window: translucent slate, hairline border, bracketed corners, breathing glow. */
export function HudPanel({ children, accent = palette.cyan, glow = true, className, style }: HudPanelProps) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!glow) return;
    pulse.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [glow, pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(pulse.value, [0, 1], [0.25, 0.7]),
    borderColor: accent + (pulse.value > 0.5 ? '88' : '55'),
  }));

  return (
    <Animated.View
      style={[
        {
          backgroundColor: palette.panel + 'E6',
          borderWidth: 1,
          borderColor: accent + '55',
          shadowColor: accent,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 0 },
          elevation: 8,
        },
        glowStyle,
        style,
      ]}
    >
      <View className={className ?? 'p-4'}>{children}</View>
      <Corner color={accent} position="tl" />
      <Corner color={accent} position="tr" />
      <Corner color={accent} position="bl" />
      <Corner color={accent} position="br" />
    </Animated.View>
  );
}
