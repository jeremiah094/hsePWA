import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

export function useCategories() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['categories', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_recon_categories')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

/** Adds a new user-defined category, available alongside the built-in ones. */
export function useCreateCategory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error('Not signed in');
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Category name is required');

      const { data, error } = await supabase
        .from('bank_recon_categories')
        .insert({ user_id: user.id, name: trimmed, is_custom: true })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });
}
