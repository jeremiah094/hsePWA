export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      bank_recon_accounts: {
        Row: {
          account_type: Database['public']['Enums']['account_type']
          archived_at: string | null
          bank_id: string
          created_at: string
          id: string
          is_joint: boolean
          monthly_target_amount: number | null
          nickname: string
          user_id: string
        }
        Insert: {
          account_type: Database['public']['Enums']['account_type']
          archived_at?: string | null
          bank_id: string
          created_at?: string
          id?: string
          is_joint?: boolean
          monthly_target_amount?: number | null
          nickname: string
          user_id: string
        }
        Update: {
          account_type?: Database['public']['Enums']['account_type']
          archived_at?: string | null
          bank_id?: string
          created_at?: string
          id?: string
          is_joint?: boolean
          monthly_target_amount?: number | null
          nickname?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bank_recon_accounts_bank_id_fkey'
            columns: ['bank_id']
            isOneToOne: false
            referencedRelation: 'bank_recon_banks'
            referencedColumns: ['id']
          },
        ]
      }
      bank_recon_banks: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      bank_recon_categories: {
        Row: {
          created_at: string
          id: string
          is_custom: boolean
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_custom?: boolean
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_custom?: boolean
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bank_recon_loan_schedules: {
        Row: {
          account_id: string
          created_at: string
          due_day_of_month: number
          expected_amount: number
          id: string
          last_paid_date: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          due_day_of_month: number
          expected_amount: number
          id?: string
          last_paid_date?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          due_day_of_month?: number
          expected_amount?: number
          id?: string
          last_paid_date?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bank_recon_loan_schedules_account_id_fkey'
            columns: ['account_id']
            isOneToOne: false
            referencedRelation: 'bank_recon_accounts'
            referencedColumns: ['id']
          },
        ]
      }
      bank_recon_merchant_category_map: {
        Row: {
          category_id: string
          created_at: string
          id: string
          merchant_pattern: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          merchant_pattern: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          merchant_pattern?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bank_recon_merchant_category_map_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'bank_recon_categories'
            referencedColumns: ['id']
          },
        ]
      }
      bank_recon_pockets: {
        Row: {
          account_id: string
          archived_at: string | null
          created_at: string
          id: string
          is_system_pocket: boolean
          name: string
          user_id: string
        }
        Insert: {
          account_id: string
          archived_at?: string | null
          created_at?: string
          id?: string
          is_system_pocket?: boolean
          name: string
          user_id: string
        }
        Update: {
          account_id?: string
          archived_at?: string | null
          created_at?: string
          id?: string
          is_system_pocket?: boolean
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bank_recon_pockets_account_id_fkey'
            columns: ['account_id']
            isOneToOne: false
            referencedRelation: 'bank_recon_accounts'
            referencedColumns: ['id']
          },
        ]
      }
      bank_recon_statement_balances: {
        Row: {
          closing_balance: number
          id: string
          is_reconciled: boolean | null
          opening_balance: number
          pocket_id: string | null
          statement_id: string
          transactions_sum: number | null
          user_id: string
        }
        Insert: {
          closing_balance: number
          id?: string
          is_reconciled?: boolean | null
          opening_balance: number
          pocket_id?: string | null
          statement_id: string
          transactions_sum?: number | null
          user_id: string
        }
        Update: {
          closing_balance?: number
          id?: string
          is_reconciled?: boolean | null
          opening_balance?: number
          pocket_id?: string | null
          statement_id?: string
          transactions_sum?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bank_recon_statement_balances_pocket_id_fkey'
            columns: ['pocket_id']
            isOneToOne: false
            referencedRelation: 'bank_recon_pockets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bank_recon_statement_balances_statement_id_fkey'
            columns: ['statement_id']
            isOneToOne: false
            referencedRelation: 'bank_recon_statements'
            referencedColumns: ['id']
          },
        ]
      }
      bank_recon_statements: {
        Row: {
          account_id: string
          file_path: string
          id: string
          parse_error: string | null
          parse_status: Database['public']['Enums']['parse_status']
          period_end: string | null
          period_start: string | null
          raw_extracted: Json | null
          uploaded_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          file_path: string
          id?: string
          parse_error?: string | null
          parse_status?: Database['public']['Enums']['parse_status']
          period_end?: string | null
          period_start?: string | null
          raw_extracted?: Json | null
          uploaded_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          file_path?: string
          id?: string
          parse_error?: string | null
          parse_status?: Database['public']['Enums']['parse_status']
          period_end?: string | null
          period_start?: string | null
          raw_extracted?: Json | null
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bank_recon_statements_account_id_fkey'
            columns: ['account_id']
            isOneToOne: false
            referencedRelation: 'bank_recon_accounts'
            referencedColumns: ['id']
          },
        ]
      }
      bank_recon_transactions: {
        Row: {
          account_id: string
          amount: number
          category_id: string | null
          classification_confidence: number | null
          classification_status: Database['public']['Enums']['classification_status']
          created_at: string
          date: string
          description: string
          direction: Database['public']['Enums']['txn_direction']
          id: string
          is_internal_transfer: boolean
          linked_transaction_id: string | null
          pocket_id: string | null
          statement_id: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id?: string | null
          classification_confidence?: number | null
          classification_status?: Database['public']['Enums']['classification_status']
          created_at?: string
          date: string
          description: string
          direction: Database['public']['Enums']['txn_direction']
          id?: string
          is_internal_transfer?: boolean
          linked_transaction_id?: string | null
          pocket_id?: string | null
          statement_id: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string | null
          classification_confidence?: number | null
          classification_status?: Database['public']['Enums']['classification_status']
          created_at?: string
          date?: string
          description?: string
          direction?: Database['public']['Enums']['txn_direction']
          id?: string
          is_internal_transfer?: boolean
          linked_transaction_id?: string | null
          pocket_id?: string | null
          statement_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bank_recon_transactions_account_id_fkey'
            columns: ['account_id']
            isOneToOne: false
            referencedRelation: 'bank_recon_accounts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bank_recon_transactions_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'bank_recon_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bank_recon_transactions_linked_transaction_id_fkey'
            columns: ['linked_transaction_id']
            isOneToOne: false
            referencedRelation: 'bank_recon_transactions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bank_recon_transactions_pocket_id_fkey'
            columns: ['pocket_id']
            isOneToOne: false
            referencedRelation: 'bank_recon_pockets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bank_recon_transactions_statement_id_fkey'
            columns: ['statement_id']
            isOneToOne: false
            referencedRelation: 'bank_recon_statements'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      account_type: 'current' | 'savings' | 'loan' | 'joint'
      classification_status: 'auto' | 'confirmed' | 'corrected'
      parse_status: 'pending' | 'parsed' | 'failed' | 'needs_review'
      txn_direction: 'debit' | 'credit'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database['public']

export type Tables<T extends keyof DefaultSchema['Tables']> = DefaultSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof DefaultSchema['Tables']> = DefaultSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof DefaultSchema['Tables']> = DefaultSchema['Tables'][T]['Update']
export type Enums<T extends keyof DefaultSchema['Enums']> = DefaultSchema['Enums'][T]
