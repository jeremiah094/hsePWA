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
