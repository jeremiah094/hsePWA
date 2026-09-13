# hsePWA — Bank Statement Insights (MVP)

Upload a few bank statements and instantly see your transactions, spending by
category, and monthly trends. Everything runs in the browser: files are
parsed on-device and stored in IndexedDB — nothing is ever uploaded to a
server.

## What's in this MVP

- **Upload** — drag and drop `.csv` or `.pdf` bank statements (multiple at once)
- **Parsing** — CSV columns (date/description/amount, or debit+credit) are
  auto-detected; PDF text is reconstructed line-by-line and matched
  heuristically (best-effort — CSV exports are more reliable)
- **Categorization** — transactions are auto-tagged (Groceries, Dining,
  Transport, Utilities, Income, …) via keyword rules; you can change any
  category from the Transactions table
- **Dedup** — re-uploading an overlapping statement won't double-count
  transactions
- **Dashboard** — total income/spending/net, spending-by-category chart,
  income vs. spending by month, top merchants
- **PWA** — installable, works offline after first load

## Run it

```bash
npm install
npm run dev
```

Then open the printed local URL, go to **Upload**, and drop a statement.

## Build

```bash
npm run build
npm run preview
```

## Stack

Vite + React + TypeScript + Tailwind CSS, Dexie (IndexedDB), Papaparse (CSV),
pdfjs-dist (PDF text extraction), Recharts, vite-plugin-pwa.

## Notes on scope

This is a first, thin MVP to validate the core loop — upload → parse → see
insights — end to end. Not yet handled: bank-specific PDF layouts beyond the
generic heuristic, multi-currency, recurring-transaction detection, and
export. Categorization rules are a starting set and easy to extend in
`src/lib/categorize.ts`.
