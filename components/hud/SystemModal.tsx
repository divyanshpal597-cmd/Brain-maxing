import { useEffect, type ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { palette } from '@/constants/theme';

import { HudPanel } from './HudPanel';

interface Props {
  visible: boolean;
  accent?: string;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  onClose: () => void;
}

/** System notification window: scanline expand-in, overshoot settle, glowing frame. */
export function SystemModal({ visible, accent = palette.cyan, title, children, confirmLabel = 'CONFIRM', onClose }: Props) {
  const scaleY = useSharedValue(0.02);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    scaleY.value = 0.02;
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: 180 });
    scaleY.value = withSequence(
      withTiming(0.02, { duration: 120 }),
      withSpring(1, { damping: 11, stiffness: 140 }),
    );
  }, [visible, scaleY, opacity]);

  const windowStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scaleY: scaleY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View
        style={[{ flex: 1, backgroundColor: '#050813D9', justifyContent: 'center', padding: 24 }, backdropStyle]}
      >
        <Animated.View style={windowStyle}>
          <HudPanel accent={accent} className="px-5 py-6">
            <View className="mb-4 items-center border-b pb-3" style={{ borderColor: accent + '55' }}>
              <Text className="font-sans-bold text-lg uppercase tracking-hud" style={{ color: accent }}>
                {title}
              </Text>
            </View>
            {children}
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              className="mt-6 h-12 items-center justify-center border"
              style={{ borderColor: accent, backgroundColor: accent + '1A' }}
            >
              <Text className="font-sans-bold uppercase tracking-hud" style={{ color: accent }}>
                {confirmLabel}
              </Text>
            </Pressable>
          </HudPanel>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
