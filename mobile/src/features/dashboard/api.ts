import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

import { useAccounts } from '@/features/accounts/api';

export interface AccountBalanceInfo {
  accountId: string;
  closingBalance: number | null;
  isReconciled: boolean | null;
  statementPeriodEnd: string | null;
}

/** Latest known closing balance (main ledger) per account, derived from each account's most recent statement. */
export function useLatestAccountBalances() {
  const { user } = useAuth();
  const { data: accounts } = useAccounts();
  const accountIds = (accounts ?? []).map((a) => a.id);

  return useQuery({
    queryKey: ['dashboard-balances', accountIds],
    enabled: !!user && accountIds.length > 0,
    queryFn: async (): Promise<Record<string, AccountBalanceInfo>> => {
      const { data: statements, error: statementsError } = await supabase
        .from('bank_recon_statements')
        .select('id, account_id, period_end, uploaded_at, parse_status')
        .in('account_id', accountIds)
        .eq('parse_status', 'parsed')
        .order('period_end', { ascending: false, nullsFirst: false })
        .order('uploaded_at', { ascending: false });
      if (statementsError) throw statementsError;

      const statementIds = (statements ?? []).map((s) => s.id);
      if (statementIds.length === 0) return {};

      const { data: balances, error: balancesError } = await supabase
        .from('bank_recon_statement_balances')
        .select('statement_id, closing_balance, is_reconciled')
        .in('statement_id', statementIds)
        .is('pocket_id', null);
      if (balancesError) throw balancesError;

      const balanceByStatement = new Map(balances?.map((b) => [b.statement_id, b]));
      const result: Record<string, AccountBalanceInfo> = {};

      // Statements are already ordered latest-first, so the first match per
      // account is its most recent parsed statement.
      for (const statement of statements ?? []) {
        if (result[statement.account_id]) continue;
        const balance = balanceByStatement.get(statement.id);
        if (!balance) continue;
        result[statement.account_id] = {
          accountId: statement.account_id,
          closingBalance: Number(balance.closing_balance),
          isReconciled: balance.is_reconciled,
          statementPeriodEnd: statement.period_end,
        };
      }

      return result;
    },
  });
}

export interface AccountFlow {
  accountId: string;
  income: number;
  spend: number;
}

/** Lifetime income (credits) vs spend (debits) per account, from parsed transactions. */
export function useAccountFlows() {
  const { user } = useAuth();
  const { data: accounts } = useAccounts();
  const accountIds = (accounts ?? []).map((a) => a.id);

  return useQuery({
    queryKey: ['dashboard-account-flows', accountIds],
    enabled: !!user && accountIds.length > 0,
    queryFn: async (): Promise<Record<string, AccountFlow>> => {
      const { data, error } = await supabase
        .from('bank_recon_transactions')
        .select('account_id, amount, direction')
        .in('account_id', accountIds);
      if (error) throw error;

      const result: Record<string, AccountFlow> = {};
      for (const t of data ?? []) {
        const flow = result[t.account_id] ?? (result[t.account_id] = { accountId: t.account_id, income: 0, spend: 0 });
        if (t.direction === 'credit') flow.income += Number(t.amount);
        else flow.spend += Number(t.amount);
      }
      return result;
    },
  });
}

export interface CategorySpend {
  categoryId: string | null;
  name: string;
  amount: number;
}

/** Lifetime spend (debits) grouped by category, across all of the user's accounts. */
export function useCategorySpend() {
  const { user } = useAuth();
  const { data: accounts } = useAccounts();
  const accountIds = (accounts ?? []).map((a) => a.id);

  return useQuery({
    queryKey: ['dashboard-category-spend', accountIds],
    enabled: !!user && accountIds.length > 0,
    queryFn: async (): Promise<CategorySpend[]> => {
      const { data: transactions, error } = await supabase
        .from('bank_recon_transactions')
        .select('category_id, amount')
        .in('account_id', accountIds)
        .eq('direction', 'debit');
      if (error) throw error;

      const { data: categories, error: categoriesError } = await supabase
        .from('bank_recon_categories')
        .select('id, name');
      if (categoriesError) throw categoriesError;
      const nameById = new Map((categories ?? []).map((c) => [c.id, c.name]));

      const totals = new Map<string, number>();
      for (const t of transactions ?? []) {
        const key = t.category_id ?? 'uncategorized';
        totals.set(key, (totals.get(key) ?? 0) + Number(t.amount));
      }

      return Array.from(totals.entries())
        .map(([key, amount]) => ({
          categoryId: key === 'uncategorized' ? null : key,
          name: key === 'uncategorized' ? 'Uncategorized' : nameById.get(key) ?? 'Uncategorized',
          amount,
        }))
        .sort((a, b) => b.amount - a.amount);
    },
  });
}

export function useAllLoanSchedules() {
  const { user } = useAuth();
  const { data: accounts } = useAccounts();
  const loanAccountIds = (accounts ?? []).filter((a) => a.account_type === 'loan').map((a) => a.id);

  return useQuery({
    queryKey: ['loan-schedules', loanAccountIds],
    enabled: !!user && loanAccountIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_recon_loan_schedules')
        .select('*')
        .in('account_id', loanAccountIds);
      if (error) throw error;
      return data;
    },
  });
}
