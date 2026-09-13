import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabsLayout() {
  const scheme = useColorScheme();
  const theme = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#3c87f7',
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.backgroundSelected,
          // On web this renders as a top-of-content bar rather than a bottom
          // bar; a sidebar layout is a natural phase-2 upgrade for desktop.
          position: Platform.OS === 'web' ? 'relative' : 'absolute',
        },
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
      }}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="accounts" options={{ title: 'Accounts' }} />
    </Tabs>
  );
}
