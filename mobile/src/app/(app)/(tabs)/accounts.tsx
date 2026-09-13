import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Collapsible } from '@/components/ui/collapsible';
import { RefreshButton } from '@/components/ui/refresh-button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { confirmAsync } from '@/lib/confirm';
import { formatMoney } from '@/lib/format';

import type { Account, AccountWithBank, Bank } from '@/features/accounts/api';
import {
  useAccounts,
  useArchiveAccount,
  useBanks,
  useDeleteAccountPermanently,
  useDeleteBank,
} from '@/features/accounts/api';
import { AccountFormModal } from '@/features/accounts/account-form-modal';
import { BankFormModal } from '@/features/accounts/bank-form-modal';

const TYPE_LABEL: Record<Account['account_type'], string> = {
  current: 'Current',
  savings: 'Savings',
  loan: 'Loan',
  joint: 'Joint',
};

export default function AccountsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data: banks, isLoading: banksLoading, refetch: refetchBanks } = useBanks();
  const { data: accounts, isLoading: accountsLoading, refetch: refetchAccounts } = useAccounts();
  const archiveAccount = useArchiveAccount();
  const deleteAccount = useDeleteAccountPermanently();
  const deleteBank = useDeleteBank();

  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [accountModalState, setAccountModalState] = useState<{
    bank: Bank | null;
    editingAccount: Account | null;
  } | null>(null);

  const accountsByBank = useMemo(() => {
    const map = new Map<string, AccountWithBank[]>();
    for (const account of accounts ?? []) {
      const list = map.get(account.bank_id) ?? [];
      list.push(account);
      map.set(account.bank_id, list);
    }
    return map;
  }, [accounts]);

  const isLoading = banksLoading || accountsLoading;

  async function confirmArchive(account: Account) {
    const ok = await confirmAsync(
      account.archived_at ? 'Unarchive account?' : 'Archive account?',
      account.archived_at
        ? 'This account will reappear in your active views.'
        : 'This hides it from active views. Its statements and transactions are kept for historical reconciliation.',
    );
    if (ok) archiveAccount.mutate({ id: account.id, archived: !account.archived_at });
  }

  async function confirmDeleteAccount(account: Account) {
    const ok = await confirmAsync(
      'Delete this account permanently?',
      'This removes the account and all of its statements and transactions. This cannot be undone. Consider archiving instead.',
    );
    if (ok) deleteAccount.mutate(account.id);
  }

  async function confirmDeleteBank(bank: Bank) {
    const ok = await confirmAsync(
      `Delete ${bank.name}?`,
      'This deletes the bank and every account, statement, and transaction under it. This cannot be undone.',
    );
    if (ok) deleteBank.mutate(bank.id);
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => {
              refetchBanks();
              refetchAccounts();
            }}
          />
        }>
        <ThemedView style={styles.headerRow}>
          <ThemedText type="subtitle">Accounts</ThemedText>
          <RefreshButton
            refreshing={isLoading}
            onRefresh={() => {
              refetchBanks();
              refetchAccounts();
            }}
          />
        </ThemedView>

        {!isLoading && (banks?.length ?? 0) === 0 && (
          <ThemedView type="backgroundElement" style={styles.emptyState}>
            <ThemedText type="smallBold">No banks yet</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Add a bank, then add its accounts underneath it.
            </ThemedText>
          </ThemedView>
        )}

        {banks?.map((bank) => {
          const bankAccounts = accountsByBank.get(bank.id) ?? [];
          return (
            <ThemedView key={bank.id} type="backgroundElement" style={styles.bankSection}>
              <ThemedView style={styles.bankHeaderRow}>
                <ThemedText type="smallBold">{bank.name}</ThemedText>
                <ThemedView style={{ flexDirection: 'row', gap: Spacing.three }}>
                  <Pressable onPress={() => setAccountModalState({ bank, editingAccount: null })}>
                    <ThemedText type="linkPrimary">+ Add account</ThemedText>
                  </Pressable>
                  <Pressable onPress={() => confirmDeleteBank(bank)}>
                    <ThemedText type="link" themeColor="textSecondary">
                      Delete bank
                    </ThemedText>
                  </Pressable>
                </ThemedView>
              </ThemedView>

              {bankAccounts.length === 0 && (
                <ThemedText type="small" themeColor="textSecondary">
                  No accounts under this bank yet.
                </ThemedText>
              )}

              {bankAccounts.map((account) => (
                <ThemedView key={account.id} style={styles.accountCard}>
                  <Pressable
                    onPress={() => router.push(`/account/${account.id}`)}
                    style={styles.accountRow}>
                    <ThemedView style={{ flex: 1, gap: 2 }}>
                      <ThemedText type="default">{account.nickname}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {TYPE_LABEL[account.account_type]}
                        {account.is_joint ? ' · Joint' : ''}
                        {account.monthly_target_amount != null
                          ? ` · target ${formatMoney(Number(account.monthly_target_amount))}/mo`
                          : ''}
                      </ThemedText>
                    </ThemedView>
                    <ThemedText type="link" themeColor="textSecondary">
                      View ›
                    </ThemedText>
                  </Pressable>

                  {account.pockets.length > 0 && (
                    <Collapsible title={`${account.pockets.length} pocket${account.pockets.length === 1 ? '' : 's'}`}>
                      {account.pockets.map((pocket) => (
                        <ThemedText key={pocket.id} type="small" style={{ paddingVertical: 4 }}>
                          {pocket.name}
                        </ThemedText>
                      ))}
                    </Collapsible>
                  )}

                  <ThemedView style={styles.actionsRow}>
                    <Pressable
                      onPress={() => setAccountModalState({ bank, editingAccount: account })}>
                      <ThemedText type="link" themeColor="textSecondary">
                        Edit
                      </ThemedText>
                    </Pressable>
                    <Pressable onPress={() => confirmArchive(account)}>
                      <ThemedText type="link" themeColor="textSecondary">
                        {account.archived_at ? 'Unarchive' : 'Archive'}
                      </ThemedText>
                    </Pressable>
                    <Pressable onPress={() => confirmDeleteAccount(account)}>
                      <ThemedText type="link" themeColor="textSecondary">
                        Delete
                      </ThemedText>
                    </Pressable>
                  </ThemedView>
                </ThemedView>
              ))}
            </ThemedView>
          );
        })}

        <Pressable
          onPress={() => setBankModalVisible(true)}
          style={[styles.addBankButton, { borderColor: theme.backgroundSelected }]}>
          <ThemedText type="linkPrimary">+ Add bank</ThemedText>
        </Pressable>
      </ScrollView>

      <BankFormModal visible={bankModalVisible} onClose={() => setBankModalVisible(false)} />
      <AccountFormModal
        visible={!!accountModalState}
        onClose={() => setAccountModalState(null)}
        bank={accountModalState?.bank ?? null}
        editingAccount={accountModalState?.editingAccount}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emptyState: { padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.one },
  bankSection: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  bankHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  accountCard: { gap: Spacing.one, paddingTop: Spacing.one },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  actionsRow: { flexDirection: 'row', gap: Spacing.three, paddingBottom: Spacing.one },
  addBankButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Spacing.three,
    padding: Spacing.three,
    alignItems: 'center',
  },
});
