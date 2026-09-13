import Papa from 'papaparse'
import { parseDateToISO } from './parseDate'

export interface RawRow {
  date: string
  description: string
  amount: number
  balance?: number
}

function findColumn(headers: string[], patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const hit = headers.find((h) => pattern.test(h))
    if (hit) return hit
  }
  return undefined
}

function toNumber(raw: string | undefined): number | undefined {
  if (raw == null) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const negative = /^\(.*\)$/.test(trimmed) || /^-/.test(trimmed)
  const cleaned = trimmed.replace(/[^0-9.]/g, '')
  if (!cleaned) return undefined
  const value = parseFloat(cleaned)
  if (Number.isNaN(value)) return undefined
  return negative ? -Math.abs(value) : value
}

export async function parseCsvStatement(file: File): Promise<RawRow[]> {
  const text = await file.text()
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  const headers = result.meta.fields ?? []
  const dateCol = findColumn(headers, [/^date$/i, /trans.*date/i, /^date/i])
  const descCol = findColumn(headers, [/desc/i, /narrative/i, /particular/i, /memo/i, /detail/i, /payee/i])
  const amountCol = findColumn(headers, [/^amount$/i, /^value$/i, /^amount/i])
  const debitCol = findColumn(headers, [/debit/i, /withdrawal/i, /money out/i, /paid out/i])
  const creditCol = findColumn(headers, [/credit/i, /deposit/i, /money in/i, /paid in/i])
  const balanceCol = findColumn(headers, [/balance/i])

  if (!dateCol || !descCol || (!amountCol && !debitCol && !creditCol)) {
    throw new Error(
      `Could not recognize this CSV's columns. Found headers: ${headers.join(', ') || '(none)'}`,
    )
  }

  const rows: RawRow[] = []
  for (const record of result.data) {
    const dateRaw = record[dateCol]
    const iso = dateRaw ? parseDateToISO(dateRaw) : null
    if (!iso) continue

    const description = (record[descCol] ?? '').trim()
    if (!description) continue

    let amount: number | undefined
    if (amountCol) {
      amount = toNumber(record[amountCol])
    } else {
      const debit = toNumber(debitCol ? record[debitCol] : undefined) ?? 0
      const credit = toNumber(creditCol ? record[creditCol] : undefined) ?? 0
      amount = credit - Math.abs(debit)
    }
    if (amount == null) continue

    const balance = balanceCol ? toNumber(record[balanceCol]) : undefined

    rows.push({ date: iso, description, amount, balance })
  }

  return rows
}
