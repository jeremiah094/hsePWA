import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';

export type Statement = Tables<'bank_recon_statements'>;
export type StatementBalance = Tables<'bank_recon_statement_balances'>;
export type Transaction = Tables<'bank_recon_transactions'>;

export function useStatements(accountId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['statements', accountId],
    enabled: !!user && !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_recon_statements')
        .select('*')
        .eq('account_id', accountId!)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useStatement(statementId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['statement', statementId],
    enabled: !!user && !!statementId,
    refetchInterval: (query) => (query.state.data?.parse_status === 'pending' ? 1500 : false),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_recon_statements')
        .select('*')
        .eq('id', statementId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useStatementBalances(statementId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['statement-balances', statementId],
    enabled: !!user && !!statementId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_recon_statement_balances')
        .select('*')
        .eq('statement_id', statementId!);
      if (error) throw error;
      return data;
    },
  });
}

/** Picks a PDF, uploads it to Storage, creates the statement row, and kicks off parsing. */
export function useUploadStatement(accountId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not signed in');

      const picked = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]) return null;

      const file = picked.assets[0];
      const path = `${user.id}/${accountId}/${Date.now()}-${file.name}`;

      // fetch()-to-blob works uniformly for both a native file:// URI and a
      // web blob: URI, so the same upload path serves every platform.
      const blob = await fetch(file.uri).then((r) => r.blob());

      const { error: uploadError } = await supabase.storage
        .from('bank-statements')
        .upload(path, blob, { contentType: 'application/pdf' });
      if (uploadError) throw uploadError;

      const { data: statement, error: insertError } = await supabase
        .from('bank_recon_statements')
        .insert({ user_id: user.id, account_id: accountId, file_path: path, parse_status: 'pending' })
        .select()
        .single();
      if (insertError) throw insertError;

      // The edge function updates the statement row as it works, and the
      // review screen polls that row for status — but if the invoke call
      // itself fails (network, CORS), nothing will ever update it, so mark
      // the statement failed here rather than leaving it stuck "pending".
      const { error: invokeError } = await supabase.functions.invoke('parse-statement', {
        body: { statementId: statement.id },
      });
      if (invokeError) {
        await supabase
          .from('bank_recon_statements')
          .update({ parse_status: 'failed', parse_error: invokeError.message })
          .eq('id', statement.id);
      }

      return statement;
    },
    onSuccess: (statement) => {
      if (statement) queryClient.invalidateQueries({ queryKey: ['statements', accountId] });
    },
  });
}

export function useTransactions(statementId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['transactions', statementId],
    enabled: !!user && !!statementId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_recon_transactions')
        .select('*')
        .eq('statement_id', statementId!)
        .order('classification_confidence', { ascending: true, nullsFirst: true })
        .order('date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Confirms a transaction's current category as-is (no correction). */
export function useConfirmTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (transactionId: string) => {
      const { error } = await supabase
        .from('bank_recon_transactions')
        .update({ classification_status: 'confirmed' })
        .eq('id', transactionId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useBulkConfirmHighConfidence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ statementId, minConfidence }: { statementId: string; minConfidence: number }) => {
      const { error } = await supabase
        .from('bank_recon_transactions')
        .update({ classification_status: 'confirmed' })
        .eq('statement_id', statementId)
        .eq('classification_status', 'auto')
        .gte('classification_confidence', minConfidence);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

/**
 * Recategorizes one transaction and remembers the merchant → category
 * mapping so future statements auto-classify it the same way.
 */
export function useRecategorizeTransaction() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transactionId,
      description,
      categoryId,
    }: {
      transactionId: string;
      description: string;
      categoryId: string;
    }) => {
      if (!user) throw new Error('Not signed in');

      const { error: txnError } = await supabase
        .from('bank_recon_transactions')
        .update({ category_id: categoryId, classification_status: 'corrected', classification_confidence: 1 })
        .eq('id', transactionId);
      if (txnError) throw txnError;

      const pattern = merchantPatternFromDescription(description);
      const { error: mapError } = await supabase
        .from('bank_recon_merchant_category_map')
        .upsert(
          { user_id: user.id, merchant_pattern: pattern, category_id: categoryId },
          { onConflict: 'user_id,merchant_pattern' },
        );
      if (mapError) throw mapError;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

/** Normalizes a raw statement description into a stable merchant pattern for future matching. */
export function merchantPatternFromDescription(description: string): string {
  return description
    .toUpperCase()
    .replace(/\d{4,}/g, '') // drop long numbers (card/ref numbers)
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .slice(0, 3)
    .join(' ')
    .trim();
}
