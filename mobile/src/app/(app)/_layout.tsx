import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="account/[accountId]" options={{ title: 'Account' }} />
      <Stack.Screen name="statement/[statementId]" options={{ title: 'Review transactions' }} />
    </Stack>
  );
}
