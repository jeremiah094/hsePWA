import { ActivityIndicator, Platform, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';

// react-native-web's RefreshControl silently ignores refreshing/onRefresh —
// there's no pull gesture on web — so web needs an explicit refresh action.
export function RefreshButton({ refreshing, onRefresh }: { refreshing: boolean; onRefresh: () => void }) {
  if (Platform.OS !== 'web') return null;

  return (
    <Pressable onPress={onRefresh} disabled={refreshing} style={styles.button} hitSlop={8}>
      {refreshing ? <ActivityIndicator size="small" /> : <ThemedText type="link">Refresh</ThemedText>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
});
