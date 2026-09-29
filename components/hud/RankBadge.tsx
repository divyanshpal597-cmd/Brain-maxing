import { Text, View } from 'react-native';

import { rankColors } from '@/constants/theme';
import type { HunterRank } from '@/types/hunter';

export function RankBadge({ rank, size = 44 }: { rank: HunterRank; size?: number }) {
  const color = rankColors[rank] ?? '#FFFFFF';
  return (
    <View
      accessibilityLabel={`${rank}-Rank`}
      style={{
        width: size,
        height: size,
        borderWidth: 2,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: '45deg' }],
        shadowColor: color,
        shadowOpacity: 0.8,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 },
        backgroundColor: color + '1A',
      }}
    >
      <Text
        className="font-mono-bold"
        style={{ color, fontSize: size * 0.42, transform: [{ rotate: '-45deg' }] }}
      >
        {rank}
      </Text>
    </View>
  );
}
