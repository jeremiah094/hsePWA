import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Platform, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

// react-native-web's RefreshControl silently ignores refreshing/onRefresh —
// there's no pull gesture on web — so web needs an explicit refresh action.
export function RefreshButton({ refreshing, onRefresh }: { refreshing: boolean; onRefresh: () => void }) {
  const theme = useTheme();
  if (Platform.OS !== 'web') return null;

  return (
    <Pressable onPress={onRefresh} disabled={refreshing} style={styles.button} hitSlop={8}>
      {refreshing ? (
        <ActivityIndicator size="small" />
      ) : (
        <SymbolView
          name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }}
          size={18}
          tintColor={theme.text}
        />
      )}
      <ThemedText type="link">Refresh</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
});
