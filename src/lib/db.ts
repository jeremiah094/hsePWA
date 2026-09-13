import Dexie, { type Table } from 'dexie'
import type { Statement, Transaction } from './types'

class StatementsDB extends Dexie {
  statements!: Table<Statement, number>
  transactions!: Table<Transaction, number>

  constructor() {
    super('hsepwa-statements')
    this.version(1).stores({
      statements: '++id, fileName, uploadedAt',
      transactions: '++id, statementId, date, category, hash',
    })
  }
}

export const db = new StatementsDB()

export async function clearAllData() {
  await db.transaction('rw', db.statements, db.transactions, async () => {
    await db.statements.clear()
    await db.transactions.clear()
  })
}
