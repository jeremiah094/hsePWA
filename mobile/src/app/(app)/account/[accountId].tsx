import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatMoney } from '@/lib/format';

import {
  useAccount,
  useDeleteAccountPermanently,
  useLoanSchedule,
  useUpsertLoanSchedule,
} from '@/features/accounts/api';
import { useDeleteStatement, useStatements, useUploadStatement } from '@/features/statements/api';
import type { Statement } from '@/features/statements/api';

const STATUS_LABEL: Record<Statement['parse_status'], string> = {
  pending: 'Parsing…',
  parsed: 'Parsed',
  failed: 'Failed',
  needs_review: 'Needs review',
};

export default function AccountDetailScreen() {
  const { accountId } = useLocalSearchParams<{ accountId: string }>();
  const theme = useTheme();
  const router = useRouter();

  const { data: account, isLoading: accountLoading } = useAccount(accountId);
  const { data: statements, isLoading: statementsLoading } = useStatements(accountId);
  const uploadStatement = useUploadStatement(accountId);
  const deleteAccount = useDeleteAccountPermanently();
  const deleteStatement = useDeleteStatement();

  if (accountLoading || !account) {
    return (
      <ThemedView style={styles.centerFill}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  function confirmDelete() {
    Alert.alert(
      'Delete this account permanently?',
      'This removes the account and all of its statements and transactions. This cannot be undone. Consider archiving instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: async () => {
            await deleteAccount.mutateAsync(accountId);
            router.back();
          },
        },
      ],
    );
  }

  function confirmDeleteStatement(statement: Statement) {
    Alert.alert(
      'Remove this statement?',
      'This deletes the uploaded PDF and all of its parsed transactions. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => deleteStatement.mutate({ statementId: statement.id, filePath: statement.file_path }),
        },
      ],
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedView type="backgroundElement" style={styles.headerCard}>
        <ThemedText type="subtitle">{account.nickname}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {account.bank.name} · {account.account_type}
          {account.is_joint ? ' · Joint' : ''}
        </ThemedText>
        {account.monthly_target_amount != null && (
          <ThemedText type="small" themeColor="textSecondary">
            Target: {formatMoney(Number(account.monthly_target_amount))}/mo
          </ThemedText>
        )}
      </ThemedView>

      {account.account_type === 'loan' && <LoanScheduleCard accountId={accountId} />}

      <ThemedView style={styles.sectionHeaderRow}>
        <ThemedText type="smallBold">Statements</ThemedText>
        <Pressable onPress={() => uploadStatement.mutate()} disabled={uploadStatement.isPending}>
          {uploadStatement.isPending ? (
            <ActivityIndicator />
          ) : (
            <ThemedText type="linkPrimary">+ Upload PDF</ThemedText>
          )}
        </Pressable>
      </ThemedView>

      {uploadStatement.isError && (
        <ThemedText type="small">{(uploadStatement.error as Error).message}</ThemedText>
      )}

      {statementsLoading && <ActivityIndicator />}

      {!statementsLoading && (statements?.length ?? 0) === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          No statements uploaded yet.
        </ThemedText>
      )}

      {statements?.map((statement) => (
        <ThemedView key={statement.id} style={[styles.statementRow, { borderColor: theme.backgroundSelected }]}>
          <Pressable
            onPress={() => statement.parse_status === 'parsed' && router.push(`/statement/${statement.id}`)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
            <ThemedView style={{ flex: 1, gap: 2 }}>
              <ThemedText type="default">
                {statement.period_start && statement.period_end
                  ? `${formatDate(statement.period_start)} – ${formatDate(statement.period_end)}`
                  : new Date(statement.uploaded_at).toLocaleDateString()}
              </ThemedText>
              {statement.parse_status === 'failed' && statement.parse_error && (
                <ThemedText type="small" themeColor="textSecondary">
                  {statement.parse_error}
                </ThemedText>
              )}
            </ThemedView>
            <ThemedText type="small" themeColor={statement.parse_status === 'failed' ? 'text' : 'textSecondary'}>
              {STATUS_LABEL[statement.parse_status]}
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => confirmDeleteStatement(statement)} hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary">
              Remove
            </ThemedText>
          </Pressable>
        </ThemedView>
      ))}

      <Pressable onPress={confirmDelete} style={styles.deleteButton}>
        <ThemedText type="small">Delete account permanently</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

function LoanScheduleCard({ accountId }: { accountId: string }) {
  const theme = useTheme();
  const { data: schedule } = useLoanSchedule(accountId);
  const upsert = useUpsertLoanSchedule();
  const [editing, setEditing] = useState(false);
  const [dueDay, setDueDay] = useState(schedule ? String(schedule.due_day_of_month) : '1');
  const [amount, setAmount] = useState(schedule ? String(schedule.expected_amount) : '');

  async function save() {
    const due = Number(dueDay);
    const expected = Number(amount);
    if (!due || due < 1 || due > 31 || !expected || expected <= 0) return;
    await upsert.mutateAsync({
      id: schedule?.id,
      accountId,
      dueDayOfMonth: due,
      expectedAmount: expected,
      lastPaidDate: schedule?.last_paid_date ?? null,
    });
    setEditing(false);
  }

  if (!editing && !schedule) {
    return (
      <Pressable onPress={() => setEditing(true)} style={[styles.headerCard, { borderWidth: 1, borderColor: theme.backgroundSelected }]}>
        <ThemedText type="linkPrimary">+ Set up loan repayment schedule</ThemedText>
      </Pressable>
    );
  }

  if (editing) {
    return (
      <ThemedView type="backgroundElement" style={styles.headerCard}>
        <ThemedText type="smallBold">Due day of month</ThemedText>
        <TextInput
          value={dueDay}
          onChangeText={setDueDay}
          keyboardType="number-pad"
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />
        <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>
          Expected amount
        </ThemedText>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />
        <ThemedView style={{ flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three, justifyContent: 'flex-end' }}>
          <Pressable onPress={() => setEditing(false)}>
            <ThemedText type="smallBold">Cancel</ThemedText>
          </Pressable>
          <Pressable onPress={save}>
            <ThemedText type="linkPrimary">Save</ThemedText>
          </Pressable>
        </ThemedView>
      </ThemedView>
    );
  }

  const dueThisMonth = new Date();
  dueThisMonth.setDate(schedule!.due_day_of_month);
  const paidThisMonth =
    schedule!.last_paid_date &&
    new Date(schedule!.last_paid_date).getMonth() === new Date().getMonth() &&
    new Date(schedule!.last_paid_date).getFullYear() === new Date().getFullYear();

  return (
    <Pressable onPress={() => setEditing(true)} style={styles.headerCard}>
      <ThemedView type="backgroundElement" style={{ padding: Spacing.three, borderRadius: Spacing.three, gap: 2 }}>
        <ThemedText type="smallBold">Loan repayment</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatMoney(Number(schedule!.expected_amount))} due on day {schedule!.due_day_of_month} ·{' '}
          {paidThisMonth ? 'Paid this month' : 'Due'}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerCard: { borderRadius: Spacing.three, padding: Spacing.three, gap: 4 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  deleteButton: { alignItems: 'center', paddingVertical: Spacing.three, marginTop: Spacing.three },
});
