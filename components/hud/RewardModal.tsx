import { useEffect } from 'react';
import { Gem, KeyRound, Ghost } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { palette } from '@/constants/theme';
import { cue } from '@/lib/feedback';
import type { LootRarity, QuestClearReward } from '@/types/hunter';

import { SystemModal } from './SystemModal';

const RARITY: Record<LootRarity, { color: string; label: string; Icon: typeof Gem }> = {
  common: { color: palette.cyan, label: 'Common', Icon: Gem },
  rare: { color: palette.monarch, label: 'Rare', Icon: KeyRound },
  legendary: { color: palette.gold, label: 'Legendary', Icon: Ghost },
};

export function RewardModal({ reward, onClose }: { reward: QuestClearReward | null; onClose: () => void }) {
  useEffect(() => {
    if (reward) cue(reward.loot.rarity === 'legendary' ? 'levelUp' : 'questTick');
  }, [reward]);

  if (!reward) return null;
  const { color, label, Icon } = RARITY[reward.loot.rarity];

  return (
    <SystemModal visible title="Daily Quest Cleared" onClose={onClose} confirmLabel="Claim">
      <View className="items-center">
        <Text className="mb-4 font-sans text-sm text-ink-muted">Rewards have been issued.</Text>
        <Text className="font-mono text-base text-ink">+{reward.xp} EXP (clear bonus)</Text>
        <Text className="mb-5 font-mono text-base" style={{ color: palette.monarch }}>
          +{reward.statPoints} STAT POINT{reward.statPoints > 1 ? 'S' : ''}
        </Text>
        <View className="w-full items-center border p-4" style={{ borderColor: color + '88', backgroundColor: color + '14' }}>
          <Icon size={32} color={color} />
          <Text className="mt-2 font-sans-semibold text-xs uppercase tracking-hud" style={{ color }}>
            {label} Drop
          </Text>
          <Text className="font-sans-bold text-lg text-ink">{reward.loot.name}</Text>
          {reward.loot.xpBonus ? (
            <Text className="font-mono text-xs" style={{ color }}>
              Passive: +{Math.round(reward.loot.xpBonus * 100)}% EXP
            </Text>
          ) : null}
        </View>
      </View>
    </SystemModal>
  );
}
