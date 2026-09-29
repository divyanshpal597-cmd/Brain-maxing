import { Check, Plus } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { palette } from '@/constants/theme';
import { cue } from '@/lib/feedback';
import { CATEGORY_STAT, QUEST_STEP } from '@/lib/quests';
import type { DailyQuest } from '@/types/hunter';

import { HudPanel } from './HudPanel';
import { SystemLabel } from './SystemLabel';

interface Props {
  quests: DailyQuest[];
  onLog: (id: string, amount: number) => void;
  onComplete: (id: string) => void;
}

function QuestRow({ quest, onLog, onComplete }: { quest: DailyQuest } & Omit<Props, 'quests'>) {
  const ratio = quest.currentValue / quest.targetValue;
  const done = quest.isCompleted;
  const step = QUEST_STEP[quest.unit];

  return (
    <View className="mb-3">
      <View className="flex-row items-center">
        <Pressable
          disabled={done}
          onPress={() => {
            cue('questTick');
            onComplete(quest.id);
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={`Mark ${quest.title} complete`}
          hitSlop={8}
          className="mr-3 h-8 w-8 items-center justify-center border"
          style={{
            borderColor: done ? palette.cyan : palette.line,
            backgroundColor: done ? palette.cyan + '26' : 'transparent',
          }}
        >
          {done && <Check size={18} color={palette.cyan} strokeWidth={3} />}
        </Pressable>

        <View className="flex-1">
          <Text
            className="font-sans-semibold text-base"
            style={{ color: done ? palette.textMuted : palette.text, textDecorationLine: done ? 'line-through' : 'none' }}
          >
            {quest.title}
          </Text>
          <Text className="font-mono text-xs text-ink-muted">
            [{quest.currentValue.toLocaleString()}/{quest.targetValue.toLocaleString()} {quest.unit}] ·{' '}
            {CATEGORY_STAT[quest.category]} · +{quest.xpReward} EXP
          </Text>
        </View>

        {!done && (
          <Pressable
            onPress={() => {
              const willComplete = quest.currentValue + step >= quest.targetValue;
              cue(willComplete ? 'questTick' : 'statAllocate');
              onLog(quest.id, step);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Log ${step} ${quest.unit} of ${quest.title}`}
            hitSlop={8}
            className="h-10 min-w-[56px] flex-row items-center justify-center border border-line px-2 active:border-cyan"
          >
            <Plus size={12} color={palette.cyan} />
            <Text className="font-mono text-xs text-cyan">{step}</Text>
          </Pressable>
        )}
      </View>
      <View className="ml-11 mt-1 h-[3px] bg-void">
        <View style={{ width: `${ratio * 100}%`, height: '100%', backgroundColor: done ? palette.cyan : palette.monarch }} />
      </View>
    </View>
  );
}

export function QuestCard({ quests, onLog, onComplete }: Props) {
  const cleared = quests.filter((q) => q.isCompleted).length;
  return (
    <HudPanel>
      <SystemLabel>Daily Quest</SystemLabel>
      <Text className="mb-1 text-center font-sans-bold text-lg uppercase tracking-hud text-ink">
        Preparation to Become Strong
      </Text>
      <Text className="mb-4 text-center font-mono text-xs text-ink-muted">
        GOALS {cleared}/{quests.length}
      </Text>
      {quests.map((q) => (
        <QuestRow key={q.id} quest={q} onLog={onLog} onComplete={onComplete} />
      ))}
      <Text className="mt-1 text-center font-sans text-xs" style={{ color: palette.crimson }}>
        WARNING: Failure to complete the daily quest will open the Penalty Zone.
      </Text>
    </HudPanel>
  );
}
