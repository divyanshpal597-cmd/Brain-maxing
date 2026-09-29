import '../global.css';

import { Rajdhani_400Regular, Rajdhani_600SemiBold, Rajdhani_700Bold } from '@expo-google-fonts/rajdhani';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { palette } from '@/constants/theme';
import { initFeedback } from '@/lib/feedback';
import { useHunterStore } from '@/stores/useHunterStore';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Rajdhani: Rajdhani_400Regular,
    'Rajdhani-SemiBold': Rajdhani_600SemiBold,
    'Rajdhani-Bold': Rajdhani_700Bold,
    SpaceMono: SpaceMono_400Regular,
    'SpaceMono-Bold': SpaceMono_700Bold,
  });

  useEffect(() => {
    initFeedback();
    const sync = () => useHunterStore.getState().syncDay();
    // Run once rehydration from AsyncStorage finishes, then on every foreground.
    const unsubHydrate = useHunterStore.persist.onFinishHydration(sync);
    if (useHunterStore.persist.hasHydrated()) sync();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && sync());
    return () => {
      unsubHydrate();
      sub.remove();
    };
  }, []);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: palette.void }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.void },
          animation: 'fade',
        }}
      />
    </SafeAreaProvider>
  );
}
