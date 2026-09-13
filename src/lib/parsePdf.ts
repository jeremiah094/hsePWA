import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { parseDateToISO } from './parseDate'
import type { RawRow } from './parseCsv'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

interface TextItem {
  str: string
  x: number
  y: number
}

async function extractLines(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const lines: string[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    const items: TextItem[] = (content.items as Array<{ str?: string; transform?: number[] }>)
      .filter((it) => it.str && it.str.trim() !== '' && it.transform)
      .map((it) => ({ str: it.str!, x: it.transform![4], y: it.transform![5] }))

    // Group text items into visual lines by rounded y-position, then sort left-to-right.
    const rows = new Map<number, TextItem[]>()
    for (const item of items) {
      const key = Math.round(item.y / 2) * 2
      if (!rows.has(key)) rows.set(key, [])
      rows.get(key)!.push(item)
    }

    const sortedKeys = [...rows.keys()].sort((a, b) => b - a) // top to bottom (PDF y grows upward)
    for (const key of sortedKeys) {
      const rowItems = rows.get(key)!.sort((a, b) => a.x - b.x)
      lines.push(rowItems.map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim())
    }
  }

  return lines.filter(Boolean)
}

const DATE_TOKEN = String.raw`(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2}|[A-Za-z]{3,9}\s+\d{1,2}(?:,?\s+\d{4})?)`
const AMOUNT_TOKEN = String.raw`[-(]?\$?\d[\d,]*\.\d{2}\)?`
const LINE_PATTERN = new RegExp(
  `^(${DATE_TOKEN})\\s+(.+?)\\s+(${AMOUNT_TOKEN})(?:\\s+(${AMOUNT_TOKEN}))?$`,
)

function toNumber(raw: string): number {
  const negative = /^\(.*\)$/.test(raw) || raw.startsWith('-')
  const cleaned = raw.replace(/[^0-9.]/g, '')
  const value = parseFloat(cleaned)
  return negative ? -Math.abs(value) : value
}

// Best-effort PDF bank statement parser: reconstructs lines from PDF text
// positions and matches "date ... amount [balance]" per line. Statement
// layouts vary a lot, so this won't catch every bank — CSV export is more
// reliable when available.
export async function parsePdfStatement(file: File): Promise<RawRow[]> {
  const lines = await extractLines(file)
  const rows: RawRow[] = []

  for (const line of lines) {
    const match = line.match(LINE_PATTERN)
    if (!match) continue

    const [, dateRaw, description, amountRaw, balanceRaw] = match
    const iso = parseDateToISO(dateRaw)
    if (!iso) continue
    if (!description.trim()) continue

    rows.push({
      date: iso,
      description: description.trim(),
      amount: toNumber(amountRaw),
      balance: balanceRaw ? toNumber(balanceRaw) : undefined,
    })
  }

  if (rows.length === 0) {
    throw new Error(
      'Could not find recognizable transaction lines in this PDF. Try a CSV export from your bank instead.',
    )
  }

  return rows
}
