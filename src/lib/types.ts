export interface Transaction {
  id?: number
  statementId: number
  date: string // ISO yyyy-mm-dd
  description: string
  amount: number // positive = money in, negative = money out
  balance?: number
  category: string
  hash: string // dedup fingerprint
}

export interface Statement {
  id?: number
  fileName: string
  uploadedAt: string
  fileType: 'csv' | 'pdf'
  transactionCount: number
}

export const CATEGORIES = [
  'Income',
  'Groceries',
  'Dining',
  'Transport',
  'Utilities',
  'Rent/Mortgage',
  'Shopping',
  'Health',
  'Entertainment',
  'Subscriptions',
  'Transfers',
  'Fees/Charges',
  'Other',
] as const

export type Category = (typeof CATEGORIES)[number]
