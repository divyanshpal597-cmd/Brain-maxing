import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';

import { FloatingXP } from '@/components/hud/FloatingXP';
import { HunterHeader } from '@/components/hud/HunterHeader';
import { LevelUpModal } from '@/components/hud/LevelUpModal';
import { PenaltyBanner } from '@/components/hud/PenaltyBanner';
import { QuestCard } from '@/components/hud/QuestCard';
import { RewardModal } from '@/components/hud/RewardModal';
import { StatPanel } from '@/components/hud/StatPanel';
import { palette } from '@/constants/theme';
import { shadowBonus } from '@/lib/loot';
import { useHunterStore } from '@/stores/useHunterStore';

export default function HomeHUD() {
  const { profile, stats, quests, streak, penalty, inventory, pendingLevelUp, lastReward, xpPulse } =
    useHunterStore(
      useShallow((s) => ({
        profile: s.profile,
        stats: s.stats,
        quests: s.quests,
        streak: s.streak,
        penalty: s.penalty,
        inventory: s.inventory,
        pendingLevelUp: s.pendingLevelUp,
        lastReward: s.lastReward,
        xpPulse: s.xpPulse,
      })),
    );
  const actions = useHunterStore.getState();
  const bonus = useMemo(() => shadowBonus(inventory), [inventory]);
  const onPenaltyExpire = useCallback(() => useHunterStore.getState().syncDay(), []);

  return (
    <View style={{ flex: 1, backgroundColor: palette.void }}>
      <LinearGradient
        colors={[palette.monarch + '22', 'transparent', palette.cyan + '12']}
        style={{ position: 'absolute', inset: 0 }}
      />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerClassName="gap-4 px-4 pb-12 pt-2">
          <Text className="text-center font-sans-bold text-xs uppercase tracking-hud text-cyan">
            ⟨ System ⟩
          </Text>

          <View>
            <HunterHeader profile={profile} streak={streak} shadowBonus={bonus} />
            <FloatingXP pulse={xpPulse} />
          </View>

          {penalty.isActive && (
            <PenaltyBanner penalty={penalty} onLog={actions.logEmergencyProgress} onExpire={onPenaltyExpire} />
          )}

          <QuestCard quests={quests} onLog={actions.logQuestProgress} onComplete={actions.completeQuest} />

          <StatPanel stats={stats} points={profile.unallocatedPoints} onAllocate={actions.allocateStat} />
        </ScrollView>
      </SafeAreaView>

      {/* Level-up plays first; the loot reveal follows once it's dismissed. */}
      <LevelUpModal event={pendingLevelUp} onClose={actions.dismissLevelUp} />
      {!pendingLevelUp && <RewardModal reward={lastReward} onClose={actions.dismissReward} />}
    </View>
  );
}
