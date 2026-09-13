import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useCreateBank } from './api';

interface BankFormModalProps {
  visible: boolean;
  onClose: () => void;
}

export function BankFormModal({ visible, onClose }: BankFormModalProps) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const createBank = useCreateBank();

  function reset() {
    setName('');
    setError(null);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Give this bank a name.');
      return;
    }
    try {
      await createBank.mutateAsync(name.trim());
      reset();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <ThemedView style={styles.backdrop}>
        <ThemedView type="backgroundElement" style={styles.sheet}>
          <ThemedText type="subtitle">Add a bank</ThemedText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Bank of Ireland"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            autoFocus
          />
          {error && <ThemedText type="small">{error}</ThemedText>}

          <ThemedView style={styles.row}>
            <Pressable
              onPress={() => {
                reset();
                onClose();
              }}
              style={styles.secondaryButton}>
              <ThemedText type="smallBold">Cancel</ThemedText>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={createBank.isPending}
              style={[styles.primaryButton, { opacity: createBank.isPending ? 0.7 : 1 }]}>
              {createBank.isPending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <ThemedText type="smallBold" style={styles.primaryLabel}>
                  Save
                </ThemedText>
              )}
            </Pressable>
          </ThemedView>
        </ThemedView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'flex-end',
  },
  secondaryButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  primaryButton: {
    backgroundColor: '#3c87f7',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    minWidth: 80,
    alignItems: 'center',
  },
  primaryLabel: { color: '#ffffff' },
});
