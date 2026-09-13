import { Alert, Platform } from 'react-native';

// react-native-web's Alert.alert() is a no-op — it never shows a dialog and
// never calls back, so any destructive action gated behind it silently does
// nothing on web. Fall back to window.confirm there.
export function confirmAsync(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'OK', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
