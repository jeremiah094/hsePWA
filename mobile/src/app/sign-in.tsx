import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';

export default function SignInScreen() {
  const theme = useTheme();
  const { signInWithPassword, signUpWithPassword } = useAuth();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter an email and password.');
      return;
    }
    setSubmitting(true);
    const result =
      mode === 'sign-in'
        ? await signInWithPassword(email.trim(), password)
        : await signUpWithPassword(email.trim(), password);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
    } else if (mode === 'sign-up') {
      setConfirmationSent(true);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <ThemedText type="title" style={styles.title}>
          Reconcile
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
          Every bank, one balance.
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">Email</ThemedText>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          />

          <ThemedText type="smallBold" style={styles.fieldSpacing}>
            Password
          </ThemedText>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            placeholder="••••••••"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          />

          {error && (
            <ThemedText type="small" themeColor="text" style={styles.error}>
              {error}
            </ThemedText>
          )}

          {confirmationSent && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.error}>
              Check your email to confirm your account, then sign in.
            </ThemedText>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={({ pressed }) => [
              styles.submitButton,
              { opacity: pressed || submitting ? 0.7 : 1 },
            ]}>
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <ThemedText type="smallBold" style={styles.submitLabel}>
                {mode === 'sign-in' ? 'Sign in' : 'Create account'}
              </ThemedText>
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              setError(null);
              setConfirmationSent(false);
              setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
            }}
            style={styles.switchModeButton}>
            <ThemedText type="link" themeColor="textSecondary">
              {mode === 'sign-in'
                ? "Don't have an account? Create one"
                : 'Already have an account? Sign in'}
            </ThemedText>
          </Pressable>
        </ThemedView>
      </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.two,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: Spacing.four },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.half,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  fieldSpacing: { marginTop: Spacing.three },
  error: { marginTop: Spacing.two },
  submitButton: {
    marginTop: Spacing.four,
    backgroundColor: '#3c87f7',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  submitLabel: { color: '#ffffff' },
  switchModeButton: {
    marginTop: Spacing.three,
    alignItems: 'center',
  },
});
