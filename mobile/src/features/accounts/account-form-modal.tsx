import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Switch, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { Account, AccountType, Bank } from './api';
import { useCreateAccount, useUpdateAccount } from './api';

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'current', label: 'Current' },
  { value: 'savings', label: 'Savings' },
  { value: 'loan', label: 'Loan' },
  { value: 'joint', label: 'Joint' },
];

interface AccountFormModalProps {
  visible: boolean;
  onClose: () => void;
  bank: Bank | null;
  editingAccount?: Account | null;
}

export function AccountFormModal({ visible, onClose, bank, editingAccount }: AccountFormModalProps) {
  const theme = useTheme();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();

  const [nickname, setNickname] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('current');
  const [isJoint, setIsJoint] = useState(false);
  const [monthlyTarget, setMonthlyTarget] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (editingAccount) {
      setNickname(editingAccount.nickname);
      setAccountType(editingAccount.account_type);
      setIsJoint(editingAccount.is_joint);
      setMonthlyTarget(
        editingAccount.monthly_target_amount != null ? String(editingAccount.monthly_target_amount) : '',
      );
    } else {
      setNickname('');
      setAccountType('current');
      setIsJoint(false);
      setMonthlyTarget('');
    }
    setError(null);
  }, [visible, editingAccount]);

  const isPending = createAccount.isPending || updateAccount.isPending;

  async function handleSave() {
    if (!nickname.trim()) {
      setError('Give this account a nickname.');
      return;
    }
    const target = monthlyTarget.trim() ? Number(monthlyTarget.trim()) : null;
    if (monthlyTarget.trim() && (Number.isNaN(target) || target! < 0)) {
      setError('Monthly target must be a positive number.');
      return;
    }

    try {
      if (editingAccount) {
        await updateAccount.mutateAsync({
          id: editingAccount.id,
          changes: {
            nickname: nickname.trim(),
            account_type: accountType,
            is_joint: isJoint,
            monthly_target_amount: target,
          },
        });
      } else {
        if (!bank) throw new Error('Pick a bank first.');
        await createAccount.mutateAsync({
          bankId: bank.id,
          nickname: nickname.trim(),
          accountType,
          isJoint,
          monthlyTargetAmount: target,
        });
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <ThemedView style={styles.backdrop}>
        <ThemedView type="backgroundElement" style={styles.sheet}>
          <ThemedText type="subtitle">
            {editingAccount ? 'Edit account' : `Add account · ${bank?.name ?? ''}`}
          </ThemedText>

          <ThemedText type="smallBold">Nickname</ThemedText>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            placeholder="e.g. Everyday spending"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            autoFocus
          />

          <ThemedText type="smallBold" style={styles.fieldSpacing}>
            Type
          </ThemedText>
          <ThemedView style={styles.typeRow}>
            {ACCOUNT_TYPES.map((t) => {
              const selected = t.value === accountType;
              return (
                <Pressable
                  key={t.value}
                  onPress={() => {
                    setAccountType(t.value);
                    if (t.value === 'joint') setIsJoint(true);
                  }}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: selected ? '#3c87f7' : theme.backgroundSelected,
                    },
                  ]}>
                  <ThemedText
                    type="small"
                    style={selected ? styles.typeChipLabelSelected : undefined}>
                    {t.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ThemedView>

          <ThemedView style={[styles.row, styles.fieldSpacing]}>
            <ThemedText type="smallBold">Joint account</ThemedText>
            <Switch value={isJoint} onValueChange={setIsJoint} />
          </ThemedView>

          <ThemedText type="smallBold" style={styles.fieldSpacing}>
            Monthly target (optional)
          </ThemedText>
          <TextInput
            value={monthlyTarget}
            onChangeText={setMonthlyTarget}
            placeholder="e.g. 400"
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          />

          {error && <ThemedText type="small">{error}</ThemedText>}

          <ThemedView style={[styles.row, styles.actionsRow]}>
            <Pressable onPress={onClose} style={styles.secondaryButton}>
              <ThemedText type="smallBold">Cancel</ThemedText>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={isPending}
              style={[styles.primaryButton, { opacity: isPending ? 0.7 : 1 }]}>
              {isPending ? (
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
    gap: Spacing.two,
    maxHeight: '90%',
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  fieldSpacing: { marginTop: Spacing.two },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  typeChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
  },
  typeChipLabelSelected: { color: '#ffffff' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionsRow: { justifyContent: 'flex-end', gap: Spacing.two, marginTop: Spacing.three },
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
