// Bank statement parser — MVP mock.
//
// Real PDF-to-transaction extraction is deferred (per the build spec, the
// pipeline should be wired end-to-end first with a stubbed parser). This
// function still does everything a real parser must: read the uploaded
// statement's identity, generate line items, classify each one against the
// user's merchant_category_map then keyword rules, reconcile the ledger's
// opening/closing balance against the generated transactions, and write
// everything back — so swapping in real PDF extraction later only means
// replacing `generateMockTransactions` with real parsing, not touching any
// of the classification/reconciliation/storage logic around it.

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface ParseRequest {
  statementId: string;
}

interface Category {
  id: string;
  name: string;
  user_id: string | null;
}

interface MerchantMapEntry {
  merchant_pattern: string;
  category_id: string;
}

interface MockTxn {
  date: string; // ISO date
  description: string;
  amount: number; // positive magnitude
  direction: 'debit' | 'credit';
}

const KEYWORD_RULES: Array<[RegExp, string]> = [
  [/TESCO|LIDL|ALDI|SUPERVALU|SUPERMARKET|GROCERY/i, 'Groceries'],
  [/NETFLIX|SPOTIFY|DISNEY\+|APPLE\.COM\/BILL|YOUTUBE PREMIUM/i, 'OTT/Subscriptions'],
  [/DOMINOS|MCDONALD|KFC|RESTAURANT|CAFE|DELIVEROO|JUST EAT/i, 'Eating Out'],
  [/LOAN REPAYMENT|LOAN PAYMENT/i, 'Loan Payments'],
  [/TRANSFER TO|TRANSFER FROM|STANDING ORDER/i, 'Bank Transfers'],
  [/AMAZON|EBAY|ONLINE STORE|ASOS/i, 'Online Shopping'],
  [/PUB|BAR |NIGHTCLUB|OFF LICENCE/i, 'Night Out'],
  [/STEAM|PLAYSTATION|XBOX|NINTENDO/i, 'Gaming'],
  [/ELECTRIC|GAS BILL|WATER CHARGES|BROADBAND|UTILITY/i, 'Bills/Utilities'],
  [/IRISH RAIL|DUBLIN BUS|LUAS|TAXI|FUEL|PETROL/i, 'Transport'],
];

const MOCK_MERCHANTS: Array<{ description: string; min: number; max: number; direction: 'debit' | 'credit' }> = [
  { description: 'TESCO SUPERMARKET', min: 15, max: 90, direction: 'debit' },
  { description: 'LIDL', min: 10, max: 60, direction: 'debit' },
  { description: 'NETFLIX.COM', min: 12, max: 18, direction: 'debit' },
  { description: 'SPOTIFY', min: 10, max: 13, direction: 'debit' },
  { description: 'DOMINOS PIZZA', min: 15, max: 35, direction: 'debit' },
  { description: 'MCDONALDS', min: 6, max: 18, direction: 'debit' },
  { description: 'AMAZON.CO.UK', min: 10, max: 120, direction: 'debit' },
  { description: 'THE LOCAL PUB', min: 10, max: 60, direction: 'debit' },
  { description: 'STEAM GAMES', min: 5, max: 50, direction: 'debit' },
  { description: 'ELECTRIC IRELAND', min: 40, max: 110, direction: 'debit' },
  { description: 'IRISH RAIL', min: 5, max: 30, direction: 'debit' },
  { description: 'STANDING ORDER TO SAVINGS', min: 50, max: 300, direction: 'debit' },
];

// Deterministic PRNG so re-parsing the same statement id is idempotent-ish.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) hash = (hash * 33) ^ input.charCodeAt(i);
  return hash >>> 0;
}

function generateMockTransactions(statementId: string, periodEnd: Date): MockTxn[] {
  const rand = mulberry32(seedFromString(statementId));
  const count = 8 + Math.floor(rand() * 6); // 8-13 spend lines
  const txns: MockTxn[] = [];

  for (let i = 0; i < count; i++) {
    const merchant = MOCK_MERCHANTS[Math.floor(rand() * MOCK_MERCHANTS.length)];
    const amount = Math.round((merchant.min + rand() * (merchant.max - merchant.min)) * 100) / 100;
    const daysAgo = Math.floor(rand() * 28);
    const date = new Date(periodEnd);
    date.setDate(date.getDate() - daysAgo);
    txns.push({
      date: date.toISOString().slice(0, 10),
      description: merchant.description,
      amount,
      direction: merchant.direction,
    });
  }

  // A salary credit, like a real current-account statement would have.
  const salaryDate = new Date(periodEnd);
  salaryDate.setDate(1);
  txns.push({
    date: salaryDate.toISOString().slice(0, 10),
    description: 'SALARY PAYMENT ACME LTD',
    amount: Math.round((2200 + rand() * 800) * 100) / 100,
    direction: 'credit',
  });

  return txns.sort((a, b) => a.date.localeCompare(b.date));
}

function merchantPatternFromDescription(description: string): string {
  return description
    .toUpperCase()
    .replace(/\d{4,}/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .slice(0, 3)
    .join(' ')
    .trim();
}

function classify(
  description: string,
  direction: 'debit' | 'credit',
  categories: Category[],
  merchantMap: MerchantMapEntry[],
): { categoryId: string | null; confidence: number } {
  const pattern = merchantPatternFromDescription(description);
  const learned = merchantMap.find((m) => m.merchant_pattern === pattern);
  if (learned) return { categoryId: learned.category_id, confidence: 0.97 };

  for (const [rule, categoryName] of KEYWORD_RULES) {
    if (rule.test(description)) {
      const category = categories.find((c) => c.name === categoryName);
      if (category) return { categoryId: category.id, confidence: 0.8 };
    }
  }

  if (direction === 'credit' && /TRANSFER/i.test(description)) {
    const category = categories.find((c) => c.name === 'Bank Transfers');
    if (category) return { categoryId: category.id, confidence: 0.6 };
  }

  const other = categories.find((c) => c.name === 'Other');
  return { categoryId: other?.id ?? null, confidence: 0.35 };
}

// Called cross-origin from the browser (the hosted web app), so every
// response — including the preflight — needs CORS headers or the browser
// blocks it before it ever reaches this function.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = req.headers.get('Authorization');

  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Scoped as the calling user (their JWT is forwarded), so every query
  // below runs under the same RLS policies as the app itself.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  let statementId: string | undefined;

  try {
    const body: ParseRequest = await req.json();
    statementId = body.statementId;
    if (!statementId) throw new Error('statementId is required');

    const { data: statement, error: statementError } = await supabase
      .from('bank_recon_statements')
      .select('*')
      .eq('id', statementId)
      .single();
    if (statementError || !statement) throw new Error('Statement not found');

    const { data: categories, error: categoriesError } = await supabase
      .from('bank_recon_categories')
      .select('id, name, user_id');
    if (categoriesError) throw categoriesError;

    const { data: merchantMap, error: mapError } = await supabase
      .from('bank_recon_merchant_category_map')
      .select('merchant_pattern, category_id');
    if (mapError) throw mapError;

    const periodEnd = statement.period_end ? new Date(statement.period_end) : new Date();
    const mockTxns = generateMockTransactions(statementId, periodEnd);

    const openingBalance = Math.round((500 + (seedFromString(statementId) % 2000)) * 100) / 100;
    let runningBalance = openingBalance;

    const rows = mockTxns.map((txn) => {
      const { categoryId, confidence } = classify(txn.description, txn.direction, categories ?? [], merchantMap ?? []);
      const signedAmount = txn.direction === 'credit' ? txn.amount : -txn.amount;
      runningBalance += signedAmount;
      return {
        user_id: statement.user_id,
        statement_id: statementId,
        account_id: statement.account_id,
        pocket_id: null,
        date: txn.date,
        description: txn.description,
        amount: txn.amount,
        direction: txn.direction,
        category_id: categoryId,
        classification_confidence: confidence,
        classification_status: 'auto' as const,
        is_internal_transfer: false,
      };
    });

    const closingBalance = Math.round(runningBalance * 100) / 100;
    const transactionsSum = Math.round((closingBalance - openingBalance) * 100) / 100;

    const { error: insertTxnsError } = await supabase.from('bank_recon_transactions').insert(rows);
    if (insertTxnsError) throw insertTxnsError;

    const { error: balanceError } = await supabase.from('bank_recon_statement_balances').upsert(
      {
        user_id: statement.user_id,
        statement_id: statementId,
        pocket_id: null,
        opening_balance: openingBalance,
        closing_balance: closingBalance,
        transactions_sum: transactionsSum,
        is_reconciled: true, // by construction, since the mock derives closing from the generated rows
      },
      { onConflict: 'statement_id,pocket_id' },
    );
    if (balanceError) throw balanceError;

    const dates = mockTxns.map((t) => t.date).sort();

    const { error: updateError } = await supabase
      .from('bank_recon_statements')
      .update({
        parse_status: 'parsed',
        period_start: statement.period_start ?? dates[0],
        period_end: statement.period_end ?? dates[dates.length - 1],
        raw_extracted: { mock: true, generatedAt: new Date().toISOString(), transactionCount: rows.length },
        parse_error: null,
      })
      .eq('id', statementId);
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, transactionCount: rows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (statementId) {
      await supabase
        .from('bank_recon_statements')
        .update({ parse_status: 'failed', parse_error: message })
        .eq('id', statementId);
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
