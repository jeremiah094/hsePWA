import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { formatDate, formatMoney } from '@/lib/format';

import { useCategories } from '@/features/categories/api';
import { CategoryPickerModal } from '@/features/categories/category-picker-modal';
import {
  useBulkConfirmHighConfidence,
  useConfirmTransaction,
  useRecategorizeTransaction,
  useStatement,
  useStatementBalances,
  useTransactions,
} from '@/features/statements/api';
import type { Transaction } from '@/features/statements/api';

const HIGH_CONFIDENCE = 0.75;

function confidenceTone(confidence: number | null): { label: string; color: string } {
  if (confidence == null) return { label: 'Unclassified', color: '#9aa0a6' };
  if (confidence >= HIGH_CONFIDENCE) return { label: 'High confidence', color: '#2ea043' };
  if (confidence >= 0.5) return { label: 'Medium confidence', color: '#d29922' };
  return { label: 'Low confidence', color: '#f85149' };
}

export default function StatementReviewScreen() {
  const { statementId } = useLocalSearchParams<{ statementId: string }>();
  const { data: statement } = useStatement(statementId);
  const { data: balances } = useStatementBalances(statementId);
  const { data: transactions, isLoading } = useTransactions(statementId);
  const { data: categories } = useCategories();
  const confirmTransaction = useConfirmTransaction();
  const bulkConfirm = useBulkConfirmHighConfidence();
  const recategorize = useRecategorizeTransaction();

  const [pickerTransaction, setPickerTransaction] = useState<Transaction | null>(null);

  const categoryName = (id: string | null) => categories?.find((c) => c.id === id)?.name ?? 'Uncategorized';

  const accountBalance = balances?.find((b) => b.pocket_id === null);
  const pendingCount = (transactions ?? []).filter((t) => t.classification_status === 'auto').length;

  if (isLoading || !statement) {
    return (
      <ThemedView style={styles.centerFill}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {accountBalance && (
        <ThemedView
          type="backgroundElement"
          style={[styles.reconciliationCard, { borderColor: accountBalance.is_reconciled ? undefined : '#f85149' }]}>
          <ThemedText type="smallBold">
            {formatMoney(Number(accountBalance.opening_balance))} → {formatMoney(Number(accountBalance.closing_balance))}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {accountBalance.is_reconciled
              ? 'Reconciled — transactions match the statement balance.'
              : 'Mismatch — transactions do not sum to the statement balance. Review before trusting this period.'}
          </ThemedText>
        </ThemedView>
      )}

      {pendingCount > 0 && (
        <Pressable
          onPress={() => bulkConfirm.mutate({ statementId, minConfidence: HIGH_CONFIDENCE })}
          disabled={bulkConfirm.isPending}
          style={styles.bulkAcceptButton}>
          <ThemedText type="linkPrimary">
            Accept all high-confidence ({(transactions ?? []).filter((t) => t.classification_status === 'auto' && (t.classification_confidence ?? 0) >= HIGH_CONFIDENCE).length})
          </ThemedText>
        </Pressable>
      )}

      <FlatList
        data={transactions ?? []}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const tone = confidenceTone(item.classification_confidence);
          const accepted = item.classification_status !== 'auto';
          return (
            <ThemedView type="backgroundElement" style={styles.row}>
              <ThemedView style={{ flex: 1, gap: 2 }}>
                <ThemedText type="default">{item.description}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDate(item.date)}
                </ThemedText>
                <Pressable onPress={() => setPickerTransaction(item)}>
                  <ThemedView style={[styles.categoryChip, { borderColor: tone.color }]}>
                    <ThemedView style={[styles.dot, { backgroundColor: tone.color }]} />
                    <ThemedText type="small">{categoryName(item.category_id)}</ThemedText>
                  </ThemedView>
                </Pressable>
              </ThemedView>

              <ThemedView style={{ alignItems: 'flex-end', gap: Spacing.two }}>
                <ThemedText type="smallBold">
                  {item.direction === 'credit' ? '+' : '−'}
                  {formatMoney(Number(item.amount))}
                </ThemedText>
                {accepted ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.classification_status === 'corrected' ? 'Corrected' : 'Confirmed'}
                  </ThemedText>
                ) : (
                  <Pressable onPress={() => confirmTransaction.mutate(item.id)}>
                    <ThemedText type="linkPrimary">Accept</ThemedText>
                  </Pressable>
                )}
              </ThemedView>
            </ThemedView>
          );
        }}
        ListEmptyComponent={
          <ThemedText type="small" themeColor="textSecondary" style={{ padding: Spacing.three }}>
            No transactions parsed for this statement.
          </ThemedText>
        }
      />

      <CategoryPickerModal
        visible={!!pickerTransaction}
        onClose={() => setPickerTransaction(null)}
        onSelect={(categoryId) => {
          if (!pickerTransaction) return;
          recategorize.mutate({
            transactionId: pickerTransaction.id,
            description: pickerTransaction.description,
            categoryId,
          });
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  reconciliationCard: {
    margin: Spacing.three,
    marginBottom: 0,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 2,
  },
  bulkAcceptButton: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  listContent: { padding: Spacing.three, gap: Spacing.two },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
