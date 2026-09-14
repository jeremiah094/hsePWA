import { useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RefreshButton } from '@/components/ui/refresh-button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatMoney } from '@/lib/format';

import { usePockets } from '@/features/accounts/api';
import { PocketPickerModal } from '@/features/accounts/pocket-picker-modal';
import { useCategories } from '@/features/categories/api';
import { CategoryPickerModal } from '@/features/categories/category-picker-modal';
import { AddTransactionModal } from '@/features/statements/add-transaction-modal';
import {
  useBulkConfirmHighConfidence,
  useConfirmTransaction,
  useMoveTransactionPocket,
  useRecategorizeTransaction,
  useRejectTransaction,
  useResetTransactionStatus,
  useStatement,
  useStatementBalances,
  useTransactions,
} from '@/features/statements/api';
import type { Transaction } from '@/features/statements/api';

const HIGH_CONFIDENCE = 0.75;

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'rejected';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'rejected', label: 'Rejected' },
];

function matchesFilter(status: Transaction['classification_status'], filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'pending') return status === 'auto';
  if (filter === 'rejected') return status === 'rejected';
  return status === 'confirmed' || status === 'corrected';
}

function confidenceTone(confidence: number | null): { label: string; color: string } {
  if (confidence == null) return { label: 'Unclassified', color: '#9aa0a6' };
  if (confidence >= HIGH_CONFIDENCE) return { label: 'High confidence', color: '#2ea043' };
  if (confidence >= 0.5) return { label: 'Medium confidence', color: '#d29922' };
  return { label: 'Low confidence', color: '#f85149' };
}

export default function StatementReviewScreen() {
  const theme = useTheme();
  const { statementId } = useLocalSearchParams<{ statementId: string }>();
  const { data: statement, isFetching: statementFetching, refetch: refetchStatement } = useStatement(statementId);
  const { data: balances, isFetching: balancesFetching, refetch: refetchBalances } = useStatementBalances(statementId);
  const {
    data: transactions,
    isLoading,
    isFetching: transactionsFetching,
    refetch: refetchTransactions,
  } = useTransactions(statementId);
  const { data: categories } = useCategories();
  const { data: pockets } = usePockets(statement?.account_id);
  const confirmTransaction = useConfirmTransaction();
  const rejectTransaction = useRejectTransaction();
  const resetTransactionStatus = useResetTransactionStatus();
  const bulkConfirm = useBulkConfirmHighConfidence();
  const recategorize = useRecategorizeTransaction();
  const movePocket = useMoveTransactionPocket();

  const [pickerTransaction, setPickerTransaction] = useState<Transaction | null>(null);
  const [pocketPickerTransaction, setPocketPickerTransaction] = useState<Transaction | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [addTransactionVisible, setAddTransactionVisible] = useState(false);

  const categoryName = (id: string | null) => categories?.find((c) => c.id === id)?.name ?? 'Uncategorized';
  const pocketName = (id: string | null) => pockets?.find((p) => p.id === id)?.name ?? 'No pocket';

  const accountBalance = balances?.find((b) => b.pocket_id === null);
  const pendingCount = (transactions ?? []).filter((t) => t.classification_status === 'auto').length;

  const filterCounts = useMemo(() => {
    const all = transactions ?? [];
    return {
      all: all.length,
      pending: all.filter((t) => t.classification_status === 'auto').length,
      confirmed: all.filter((t) => t.classification_status === 'confirmed' || t.classification_status === 'corrected').length,
      rejected: all.filter((t) => t.classification_status === 'rejected').length,
    };
  }, [transactions]);

  const filteredTransactions = useMemo(
    () => (transactions ?? []).filter((t) => matchesFilter(t.classification_status, statusFilter)),
    [transactions, statusFilter],
  );

  if (isLoading || !statement) {
    return (
      <ThemedView style={styles.centerFill}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const isRefreshing = statementFetching || balancesFetching || transactionsFetching;
  function handleRefresh() {
    refetchStatement();
    refetchBalances();
    refetchTransactions();
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.headerRow}>
        <ThemedText type="subtitle">Statement</ThemedText>
        <ThemedView style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
          <Pressable onPress={() => setAddTransactionVisible(true)}>
            <ThemedText type="linkPrimary">+ Add transaction</ThemedText>
          </Pressable>
          <RefreshButton refreshing={isRefreshing} onRefresh={handleRefresh} />
        </ThemedView>
      </ThemedView>

      {statement.ai_summary && (
        <ThemedView type="backgroundElement" style={styles.summaryCard}>
          <ThemedView style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <SymbolView name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} size={14} tintColor="#3c87f7" />
            <ThemedText type="smallBold">AI summary</ThemedText>
          </ThemedView>
          <ThemedText type="small" themeColor="textSecondary">
            {statement.ai_summary}
          </ThemedText>
        </ThemedView>
      )}

      {accountBalance && (
        <ThemedView
          type="backgroundElement"
          style={[styles.reconciliationCard, { borderColor: accountBalance.is_reconciled === false ? '#f85149' : undefined }]}>
          <ThemedText type="smallBold">
            {formatMoney(Number(accountBalance.opening_balance))} → {formatMoney(Number(accountBalance.closing_balance))}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {accountBalance.is_reconciled === true
              ? 'Reconciled — transactions match the statement balance.'
              : accountBalance.is_reconciled === false
                ? 'Mismatch — transactions do not sum to the statement balance. Review before trusting this period.'
                : 'Not verified — this statement has no single opening/closing balance to check against.'}
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

      <ThemedView style={styles.filterRow}>
        {FILTERS.map((filter) => {
          const active = statusFilter === filter.key;
          return (
            <Pressable key={filter.key} onPress={() => setStatusFilter(filter.key)}>
              <ThemedView
                style={[
                  styles.filterChip,
                  { borderColor: theme.backgroundSelected },
                  active && { backgroundColor: theme.backgroundSelected },
                ]}>
                <ThemedText type="small">
                  {filter.label} ({filterCounts[filter.key]})
                </ThemedText>
              </ThemedView>
            </Pressable>
          );
        })}
      </ThemedView>

      <FlatList
        data={filteredTransactions}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        renderItem={({ item }) => {
          const tone = confidenceTone(item.classification_confidence);
          const isPending = item.classification_status === 'auto';
          const isRejected = item.classification_status === 'rejected';
          return (
            <ThemedView type="backgroundElement" style={styles.row}>
              <ThemedView style={{ flex: 1, gap: 2 }}>
                <ThemedText type="default">{item.description}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDate(item.date)}
                </ThemedText>
                <ThemedView style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }}>
                  <Pressable onPress={() => setPickerTransaction(item)}>
                    <ThemedView style={[styles.chip, { borderColor: tone.color }]}>
                      <ThemedView style={[styles.dot, { backgroundColor: tone.color }]} />
                      <ThemedText type="small">{categoryName(item.category_id)}</ThemedText>
                    </ThemedView>
                  </Pressable>
                  <Pressable onPress={() => setPocketPickerTransaction(item)}>
                    <ThemedView style={[styles.chip, { borderColor: theme.backgroundSelected }]}>
                      <ThemedText type="small">{pocketName(item.pocket_id)}</ThemedText>
                    </ThemedView>
                  </Pressable>
                </ThemedView>
              </ThemedView>

              <ThemedView style={{ alignItems: 'flex-end', gap: Spacing.two }}>
                <ThemedText type="smallBold">
                  {item.direction === 'credit' ? '+' : '−'}
                  {formatMoney(Number(item.amount))}
                </ThemedText>
                {isPending ? (
                  <ThemedView style={{ flexDirection: 'row', gap: Spacing.three }}>
                    <Pressable onPress={() => rejectTransaction.mutate(item.id)}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Reject
                      </ThemedText>
                    </Pressable>
                    <Pressable onPress={() => confirmTransaction.mutate(item.id)}>
                      <ThemedText type="linkPrimary">Accept</ThemedText>
                    </Pressable>
                  </ThemedView>
                ) : (
                  <ThemedView style={{ alignItems: 'flex-end', gap: 2 }}>
                    <ThemedText type="small" style={isRejected ? styles.rejectedLabel : undefined} themeColor={isRejected ? undefined : 'textSecondary'}>
                      {isRejected ? 'Rejected' : item.classification_status === 'corrected' ? 'Corrected' : 'Confirmed'}
                    </ThemedText>
                    <Pressable onPress={() => resetTransactionStatus.mutate(item.id)}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Undo
                      </ThemedText>
                    </Pressable>
                  </ThemedView>
                )}
              </ThemedView>
            </ThemedView>
          );
        }}
        ListEmptyComponent={
          <ThemedText type="small" themeColor="textSecondary" style={{ padding: Spacing.three }}>
            {statusFilter === 'all' ? 'No transactions parsed for this statement.' : `No ${statusFilter} transactions.`}
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

      <PocketPickerModal
        visible={!!pocketPickerTransaction}
        accountId={statement.account_id}
        onClose={() => setPocketPickerTransaction(null)}
        onSelect={(pocketId) => {
          if (!pocketPickerTransaction) return;
          movePocket.mutate({ transactionId: pocketPickerTransaction.id, pocketId });
        }}
      />

      <AddTransactionModal
        visible={addTransactionVisible}
        onClose={() => setAddTransactionVisible(false)}
        statementId={statementId}
        accountId={statement.account_id}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  summaryCard: {
    margin: Spacing.three,
    marginBottom: 0,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: 4,
  },
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
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    flexWrap: 'wrap',
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
  },
  listContent: { padding: Spacing.three, gap: Spacing.two },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  chip: {
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
  rejectedLabel: { color: '#f85149' },
});
