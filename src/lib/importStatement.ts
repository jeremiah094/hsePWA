import { db } from './db'
import { parseCsvStatement } from './parseCsv'
import { parsePdfStatement } from './parsePdf'
import { categorize } from './categorize'
import { hashRow } from './hash'
import type { RawRow } from './parseCsv'

export interface ImportResult {
  fileName: string
  imported: number
  duplicates: number
  error?: string
}

export async function importStatementFile(file: File): Promise<ImportResult> {
  const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv'
  const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf'

  if (!isCsv && !isPdf) {
    return { fileName: file.name, imported: 0, duplicates: 0, error: 'Unsupported file type — upload a .csv or .pdf statement.' }
  }

  let rows: RawRow[]
  try {
    rows = isCsv ? await parseCsvStatement(file) : await parsePdfStatement(file)
  } catch (err) {
    return { fileName: file.name, imported: 0, duplicates: 0, error: (err as Error).message }
  }

  if (rows.length === 0) {
    return { fileName: file.name, imported: 0, duplicates: 0, error: 'No transactions found in this file.' }
  }

  const existingHashes = new Set((await db.transactions.toArray()).map((t) => t.hash))

  const statementId = await db.statements.add({
    fileName: file.name,
    uploadedAt: new Date().toISOString(),
    fileType: isCsv ? 'csv' : 'pdf',
    transactionCount: 0,
  })

  let imported = 0
  let duplicates = 0
  const toInsert = []

  for (const row of rows) {
    const hash = hashRow(row.date, row.description, row.amount.toFixed(2))
    if (existingHashes.has(hash)) {
      duplicates++
      continue
    }
    existingHashes.add(hash)
    toInsert.push({
      statementId,
      date: row.date,
      description: row.description,
      amount: row.amount,
      balance: row.balance,
      category: categorize(row.description, row.amount),
      hash,
    })
    imported++
  }

  if (toInsert.length > 0) {
    await db.transactions.bulkAdd(toInsert)
  }
  await db.statements.update(statementId, { transactionCount: imported })

  if (imported === 0) {
    await db.statements.delete(statementId)
  }

  return { fileName: file.name, imported, duplicates }
}
