import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Enums, Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';

export type Bank = Tables<'bank_recon_banks'>;
export type Account = Tables<'bank_recon_accounts'>;
export type Pocket = Tables<'bank_recon_pockets'>;
export type AccountType = Enums<'account_type'>;

export interface AccountWithBank extends Account {
  bank: Bank;
  pockets: Pocket[];
}

// ---- Banks ----

export function useBanks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['banks', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('bank_recon_banks').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateBank() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error('Not signed in');
      const payload: TablesInsert<'bank_recon_banks'> = { name, user_id: user.id };
      const { data, error } = await supabase
        .from('bank_recon_banks')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['banks'] }),
  });
}

// Deletes the bank and, via cascade, every account/pocket/statement/
// transaction/loan schedule under it. There's no "archive" for banks —
// archive the accounts individually if you want to keep their history.
export function useDeleteBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bank_recon_banks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banks'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-balances'] });
    },
  });
}

// ---- Accounts (with bank + pockets joined) ----

export function useAccounts(options?: { includeArchived?: boolean }) {
  const { user } = useAuth();
  const includeArchived = options?.includeArchived ?? false;

  return useQuery({
    queryKey: ['accounts', user?.id, includeArchived],
    enabled: !!user,
    queryFn: async (): Promise<AccountWithBank[]> => {
      let query = supabase
        .from('bank_recon_accounts')
        .select('*, bank:bank_recon_banks(*), pockets:bank_recon_pockets(*)')
        .order('created_at');
      if (!includeArchived) query = query.is('archived_at', null);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as AccountWithBank[];
    },
  });
}

export function useAccount(accountId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['account', accountId],
    enabled: !!user && !!accountId,
    queryFn: async (): Promise<AccountWithBank> => {
      const { data, error } = await supabase
        .from('bank_recon_accounts')
        .select('*, bank:bank_recon_banks(*), pockets:bank_recon_pockets(*)')
        .eq('id', accountId!)
        .single();
      if (error) throw error;
      return data as unknown as AccountWithBank;
    },
  });
}

export interface CreateAccountInput {
  bankId: string;
  nickname: string;
  accountType: AccountType;
  isJoint: boolean;
  monthlyTargetAmount: number | null;
}

export function useCreateAccount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAccountInput) => {
      if (!user) throw new Error('Not signed in');
      const payload: TablesInsert<'bank_recon_accounts'> = {
        user_id: user.id,
        bank_id: input.bankId,
        nickname: input.nickname,
        account_type: input.accountType,
        is_joint: input.isJoint,
        monthly_target_amount: input.monthlyTargetAmount,
      };
      const { data, error } = await supabase
        .from('bank_recon_accounts')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: TablesUpdate<'bank_recon_accounts'> }) => {
      const { data, error } = await supabase
        .from('bank_recon_accounts')
        .update(changes)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

// Archiving hides an account from active views but keeps its statements and
// transactions intact for historical reconciliation — never hard-delete by
// default.
export function useArchiveAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase
        .from('bank_recon_accounts')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

// Explicit, separate, irreversible action — distinct from archiving.
export function useDeleteAccountPermanently() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bank_recon_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  });
}

// ---- Loan schedules ----

export function useLoanSchedule(accountId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['loan-schedule', accountId],
    enabled: !!user && !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_recon_loan_schedules')
        .select('*')
        .eq('account_id', accountId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertLoanSchedule() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      accountId: string;
      dueDayOfMonth: number;
      expectedAmount: number;
      lastPaidDate: string | null;
    }) => {
      if (!user) throw new Error('Not signed in');
      const payload: TablesInsert<'bank_recon_loan_schedules'> = {
        id: input.id,
        user_id: user.id,
        account_id: input.accountId,
        due_day_of_month: input.dueDayOfMonth,
        expected_amount: input.expectedAmount,
        last_paid_date: input.lastPaidDate,
      };
      const { data, error } = await supabase
        .from('bank_recon_loan_schedules')
        .upsert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, input) =>
      queryClient.invalidateQueries({ queryKey: ['loan-schedule', input.accountId] }),
  });
}
