import { Text, View } from 'react-native';

import { palette } from '@/constants/theme';

/** The bracketed "[ SYSTEM ]" style section header. */
export function SystemLabel({ children, color = palette.cyan }: { children: string; color?: string }) {
  return (
    <View className="mb-3 flex-row items-center">
      <View style={{ width: 3, height: 14, backgroundColor: color, marginRight: 8 }} />
      <Text className="font-sans-bold text-sm uppercase tracking-hud" style={{ color }}>
        {children}
      </Text>
    </View>
  );
}
