import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useCategories } from '@/features/categories/api';
import { CategoryPickerModal } from '@/features/categories/category-picker-modal';

import { useAddManualTransaction } from './api';

interface AddTransactionModalProps {
  visible: boolean;
  onClose: () => void;
  statementId: string;
  accountId: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

export function AddTransactionModal({ visible, onClose, statementId, accountId }: AddTransactionModalProps) {
  const theme = useTheme();
  const { data: categories } = useCategories();
  const addTransaction = useAddManualTransaction();

  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'debit' | 'credit'>('debit');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryName = categories?.find((c) => c.id === categoryId)?.name ?? 'No category';

  function reset() {
    setDate(todayISO());
    setDescription('');
    setAmount('');
    setDirection('debit');
    setCategoryId(null);
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function save() {
    if (!isValidISODate(date)) return setError('Enter a valid date as YYYY-MM-DD.');
    if (!description.trim()) return setError('Enter a description.');
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return setError('Enter an amount greater than 0.');

    setError(null);
    await addTransaction.mutateAsync({
      statementId,
      accountId,
      date,
      description: description.trim(),
      amount: parsedAmount,
      direction,
      categoryId,
    });
    close();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <ThemedView type="backgroundElement" style={styles.sheet}>
            <ThemedText type="subtitle" style={{ marginBottom: Spacing.three }}>
              Add transaction
            </ThemedText>

            <ThemedText type="smallBold">Date</ThemedText>
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            />

            <ThemedText type="smallBold" style={{ marginTop: Spacing.three }}>
              Description
            </ThemedText>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Tesco"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            />

            <ThemedText type="smallBold" style={{ marginTop: Spacing.three }}>
              Amount
            </ThemedText>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            />

            <ThemedView style={{ flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three }}>
              {(['debit', 'credit'] as const).map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setDirection(option)}
                  style={[
                    styles.toggle,
                    {
                      borderColor: theme.backgroundSelected,
                      backgroundColor: direction === option ? theme.backgroundSelected : 'transparent',
                    },
                  ]}>
                  <ThemedText type="small">{option === 'debit' ? 'Money out' : 'Money in'}</ThemedText>
                </Pressable>
              ))}
            </ThemedView>

            <ThemedText type="smallBold" style={{ marginTop: Spacing.three }}>
              Category
            </ThemedText>
            <Pressable
              onPress={() => setPickerVisible(true)}
              style={[styles.input, { borderColor: theme.backgroundSelected, justifyContent: 'center' }]}>
              <ThemedText type="default">{categoryName}</ThemedText>
            </Pressable>

            {error && (
              <ThemedText type="small" style={styles.error}>
                {error}
              </ThemedText>
            )}

            <ThemedView style={{ flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.four, justifyContent: 'flex-end' }}>
              <Pressable onPress={close}>
                <ThemedText type="smallBold">Cancel</ThemedText>
              </Pressable>
              <Pressable onPress={save} disabled={addTransaction.isPending}>
                <ThemedText type="linkPrimary">{addTransaction.isPending ? 'Saving…' : 'Save'}</ThemedText>
              </Pressable>
            </ThemedView>
          </ThemedView>
        </Pressable>
      </Pressable>

      <CategoryPickerModal visible={pickerVisible} onClose={() => setPickerVisible(false)} onSelect={setCategoryId} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    marginTop: 4,
  },
  toggle: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  error: { color: '#f85149', marginTop: Spacing.two },
});
