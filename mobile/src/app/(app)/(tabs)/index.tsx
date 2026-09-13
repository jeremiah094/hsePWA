import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { formatMoney } from '@/lib/format';
import { calculateSafeToSpend } from '@/lib/safe-to-spend';
import { useAuth } from '@/lib/auth-context';

import { useAccounts } from '@/features/accounts/api';
import { useAllLoanSchedules, useLatestAccountBalances } from '@/features/dashboard/api';

export default function DashboardScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const {
    data: accounts,
    isLoading: accountsLoading,
    isFetching: accountsFetching,
    refetch: refetchAccounts,
  } = useAccounts();
  const {
    data: balances,
    isLoading: balancesLoading,
    isFetching: balancesFetching,
    refetch: refetchBalances,
  } = useLatestAccountBalances();
  const { data: loanSchedules, refetch: refetchLoanSchedules } = useAllLoanSchedules();

  const isLoading = accountsLoading || balancesLoading;
  const isRefreshing = accountsFetching || balancesFetching;

  function handleRefresh() {
    refetchAccounts();
    refetchBalances();
    refetchLoanSchedules();
  }

  const netPosition = useMemo(() => {
    if (!accounts || !balances) return 0;
    return accounts.reduce((sum, a) => sum + (balances[a.id]?.closingBalance ?? 0), 0);
  }, [accounts, balances]);

  const safeToSpend = useMemo(() => {
    if (!accounts || !balances) return null;
    return calculateSafeToSpend({
      balances: accounts.map((a) => ({
        accountId: a.id,
        isSpendRelevant: a.account_type === 'current' || a.account_type === 'joint',
        currentBalance: balances[a.id]?.closingBalance ?? 0,
      })),
      loanCommitments: (loanSchedules ?? []).map((l) => ({
        accountId: l.account_id,
        dueDayOfMonth: l.due_day_of_month,
        expectedAmount: Number(l.expected_amount),
        lastPaidDate: l.last_paid_date,
      })),
    });
  }, [accounts, balances, loanSchedules]);

  if (isLoading) {
    return (
      <ThemedView style={styles.centerFill}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.centerFill}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}>
        <ThemedText type="smallBold">No accounts yet</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 4, marginBottom: Spacing.three }}>
          Add a bank and an account to get started.
        </ThemedText>
        <Pressable onPress={() => router.push('/(app)/(tabs)/accounts')}>
          <ThemedText type="linkPrimary">Go to Accounts</ThemedText>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}>
      <ThemedView type="backgroundElement" style={styles.heroCard}>
        <ThemedText type="small" themeColor="textSecondary">
          Net position
        </ThemedText>
        <ThemedText type="title" style={styles.netPositionValue}>
          {formatMoney(netPosition)}
        </ThemedText>

        {safeToSpend && (
          <ThemedView style={styles.safeToSpendRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Safe to spend
            </ThemedText>
            <ThemedText type="smallBold">{formatMoney(safeToSpend.safeToSpend)}</ThemedText>
          </ThemedView>
        )}
      </ThemedView>

      <ThemedText type="smallBold">Accounts</ThemedText>
      {accounts.map((account) => {
        const balance = balances?.[account.id];
        const loanSchedule = loanSchedules?.find((l) => l.account_id === account.id);
        const paidThisMonth =
          loanSchedule?.last_paid_date &&
          new Date(loanSchedule.last_paid_date).getMonth() === new Date().getMonth() &&
          new Date(loanSchedule.last_paid_date).getFullYear() === new Date().getFullYear();

        return (
          <Pressable
            key={account.id}
            onPress={() => router.push(`/account/${account.id}`)}
            style={styles.tileWrapper}>
            <ThemedView type="backgroundElement" style={styles.tile}>
              <ThemedView style={styles.tileHeaderRow}>
                <ThemedText type="default">{account.nickname}</ThemedText>
                <ThemedText type="smallBold">
                  {balance?.closingBalance != null ? formatMoney(balance.closingBalance) : '—'}
                </ThemedText>
              </ThemedView>
              <ThemedText type="small" themeColor="textSecondary">
                {account.bank.name} · {account.account_type}
              </ThemedText>

              {balance && balance.isReconciled === false && (
                <ThemedText type="small" style={styles.mismatchLabel}>
                  ⚠ Reconciliation mismatch — review latest statement
                </ThemedText>
              )}

              {account.account_type === 'loan' && loanSchedule && (
                <ThemedText type="small" themeColor="textSecondary">
                  Repayment {formatMoney(Number(loanSchedule.expected_amount))}:{' '}
                  {paidThisMonth ? 'paid this month' : `due day ${loanSchedule.due_day_of_month}`}
                </ThemedText>
              )}

              {account.is_joint && account.monthly_target_amount != null && (
                <ThemedText type="small" themeColor="textSecondary">
                  Joint target {formatMoney(Number(account.monthly_target_amount))}/mo
                </ThemedText>
              )}

              {!balance && (
                <ThemedText type="small" themeColor="textSecondary">
                  No parsed statements yet
                </ThemedText>
              )}
            </ThemedView>
          </Pressable>
        );
      })}

      <Pressable onPress={signOut} style={styles.signOutButton}>
        <ThemedText type="small" themeColor="textSecondary">
          Sign out
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  heroCard: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.one },
  netPositionValue: { fontSize: 36, lineHeight: 40 },
  safeToSpendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.three,
  },
  tileWrapper: {},
  tile: { borderRadius: Spacing.three, padding: Spacing.three, gap: 2 },
  tileHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mismatchLabel: { color: '#f85149' },
  signOutButton: { alignItems: 'center', paddingVertical: Spacing.three, marginTop: Spacing.three },
});
