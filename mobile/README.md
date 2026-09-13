# Bank Reconciliation — MVP

Upload monthly bank statements across multiple banks and accounts and see one
reconciled view of your finances — balances, categorized spend, loan payment
status — without cross-checking PDFs by hand. One Expo Router codebase for
iOS, Android, and web; Supabase for auth, Postgres, storage, and parsing.

## Stack

- **App**: Expo Router (TypeScript), React 19 / React Native 0.86, targeting
  iOS/Android/web from `src/app`
- **Backend**: Supabase — Postgres + Row Level Security, Auth, Storage
  (`bank-statements` bucket), one Edge Function (`parse-statement`)
- **Data fetching**: TanStack Query against the Supabase client
- **Styling**: the template's built-in theme-token system (`ThemedText`,
  `ThemedView`, `src/constants/theme.ts`) — consistent across native and web
  without an extra styling library

## Project layout

```
src/
  app/
    _layout.tsx              root: providers + auth guard (Stack.Protected)
    sign-in.tsx               email/password sign in & sign up
    (app)/
      (tabs)/index.tsx        Dashboard — net position, safe-to-spend, account tiles
      (tabs)/accounts.tsx     Account manager — banks, accounts, pockets
      account/[accountId].tsx statements list, PDF upload, loan schedule
      statement/[statementId].tsx  transaction review + recategorization
  features/
    accounts/                 banks/accounts/pockets/loan-schedule queries + forms
    statements/                statement + transaction queries, upload flow
    categories/                category list + picker
    dashboard/                 balance/loan aggregation for the dashboard
  lib/
    supabase.ts                Supabase client (env-configured)
    auth-context.tsx           session state, exposed via useAuth()
    safe-to-spend.ts           pure, shared "safe to spend" calculation
    database.types.ts          generated Supabase types
supabase/functions/parse-statement/  Edge Function: parses a statement
```

## Backend

Schema, RLS policies, seed categories, and the storage bucket are already
applied to the `beacon` Supabase project (this repo doesn't own a dedicated
project — see migration history in the Supabase dashboard for
`bank_recon_*` tables). Every `bank_recon_*` table carries a `user_id`
column and an RLS policy scoping it to `auth.uid()`.

### What's real vs. mocked (MVP)

- **Real**: auth, schema/RLS, storage upload, the full
  upload → Edge Function → transactions → review pipeline, merchant-learning
  corrections, reconciliation-mismatch flagging, the safe-to-spend
  calculation.
- **Mocked**: `parse-statement` generates plausible transactions instead of
  extracting real text from the uploaded PDF (the file is still stored for
  real). Swapping in real PDF parsing later only means replacing
  `generateMockTransactions` — the classification, reconciliation, and
  storage code around it doesn't change.

## Run it

```bash
npm install
cp .env.example .env   # fill in EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
npx expo start
```

## Deferred (post-MVP, per the build spec)

Joint account contribution-vs-spend detail screen, monthly recap, real PDF
text extraction and pocket detection, internal-transfer auto-linking,
partner shared access, notifications, export/reporting, multi-currency,
direct bank API integrations.
