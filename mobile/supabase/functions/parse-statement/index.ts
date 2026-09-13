// Bank statement parser.
//
// Extracts real text from the uploaded PDF (via unpdf/pdf.js), then turns it
// into transaction line items — via Gemini when GEMINI_API_KEY is configured
// (it reads the raw text, writes a short summary, and extracts every line
// item, which handles the huge variety of real bank layouts far better than
// hand-written patterns), falling back to a regex-based parser otherwise or
// if the AI call fails. Either path feeds the same classification and
// balance-reconciliation logic below, so line items are always cross-checked
// against the statement's own opening/closing balance regardless of how they
// were extracted.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { extractText, getDocumentProxy } from 'npm:unpdf@1.8.1';

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

interface ParsedRow {
  date: string; // ISO date
  description: string;
  amount: number; // positive magnitude
  direction: 'debit' | 'credit';
  balance?: number;
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
  [/SALARY|PAYROLL/i, 'Bank Transfers'],
];

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

  if (direction === 'credit' && /TRANSFER|SALARY|PAYROLL|DEPOSIT|REFUND/i.test(description)) {
    const category = categories.find((c) => c.name === 'Bank Transfers');
    if (category) return { categoryId: category.id, confidence: 0.6 };
  }

  const other = categories.find((c) => c.name === 'Other');
  return { categoryId: other?.id ?? null, confidence: 0.35 };
}

// --- PDF text -> transaction rows -------------------------------------

const DATE_TOKEN =
  String.raw`(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|[A-Za-z]{3,9}\.?\s+\d{1,2}(?:,?\s+\d{2,4})?|\d{1,2}\s+[A-Za-z]{3,9}\.?(?:\s+\d{2,4})?)`;
const AMOUNT_TOKEN = String.raw`[-(]?[€$£]?\d[\d,]*\.\d{2}\)?`;
const LINE_PATTERN = new RegExp(`^(${DATE_TOKEN})\\s+(.+?)\\s+(${AMOUNT_TOKEN})(?:\\s+(${AMOUNT_TOKEN}))?$`);

const NON_TRANSACTION_LINE =
  /^(page\s+\d|statement of|sort code|account number|iban|bic|balance\s+(brought|carried)|opening balance|closing balance|previous balance|new balance|total|subtotal)/i;

function toNumber(raw: string): number {
  const trimmed = raw.trim();
  const negative = /^\(.*\)$/.test(trimmed) || trimmed.startsWith('-');
  const cleaned = trimmed.replace(/[^0-9.]/g, '');
  const value = parseFloat(cleaned);
  return negative ? -Math.abs(value) : value;
}

function parseDateToISO(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return toISO(m[1], m[2], m[3]);

  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    let [, a, b, y] = m;
    if (y.length === 2) y = (Number(y) > 50 ? '19' : '20') + y;
    const first = Number(a);
    const second = Number(b);
    if (first > 12 && second <= 12) return toISO(y, b, a); // DD/MM/YYYY
    if (second > 12 && first <= 12) return toISO(y, a, b); // MM/DD/YYYY
    return toISO(y, a, b); // ambiguous: assume DD/MM/YYYY (bank default outside the US)
  }

  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    return toISO(String(d.getUTCFullYear()), String(d.getUTCMonth() + 1), String(d.getUTCDate()));
  }

  return null;
}

function toISO(y: string, m: string, d: string): string {
  return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

interface ParsedStatement {
  rows: ParsedRow[];
  detectedOpening: number | null;
  detectedClosing: number | null;
}

function parseStatementText(text: string): ParsedStatement {
  const openingMatch = text.match(
    /(?:opening balance|balance brought forward|previous balance)\D{0,10}([-(]?[€$£]?[\d,]+\.\d{2}\)?)/i,
  );
  const closingMatch = text.match(
    /(?:closing balance|balance carried forward|new balance)\D{0,10}([-(]?[€$£]?[\d,]+\.\d{2}\)?)/i,
  );

  const detectedOpening = openingMatch ? toNumber(openingMatch[1]) : null;
  const detectedClosing = closingMatch ? toNumber(closingMatch[1]) : null;

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0 && l.length < 300);

  const rows: ParsedRow[] = [];
  let runningBalance: number | null = detectedOpening;

  for (const line of lines) {
    const match = line.match(LINE_PATTERN);
    if (!match) continue;

    const [, dateRaw, descRaw, amountRaw, balanceRaw] = match;
    const description = descRaw.trim();
    if (description.length < 2 || NON_TRANSACTION_LINE.test(description)) continue;

    const iso = parseDateToISO(dateRaw);
    if (!iso) continue;

    const balance = balanceRaw ? toNumber(balanceRaw) : undefined;
    let amount: number;
    let direction: 'debit' | 'credit';

    if (balance != null && runningBalance != null) {
      // Derive the transaction from the balance delta — self-correcting
      // regardless of the statement's own sign convention for the amount column.
      const delta = Math.round((balance - runningBalance) * 100) / 100;
      if (delta === 0) continue;
      amount = Math.abs(delta);
      direction = delta >= 0 ? 'credit' : 'debit';
      runningBalance = balance;
    } else {
      const raw = toNumber(amountRaw);
      if (raw === 0) continue;
      direction = raw < 0 ? 'debit' : 'credit';
      amount = Math.abs(raw);
      if (balance != null) runningBalance = balance;
    }

    rows.push({ date: iso, description, amount, direction, balance });
  }

  return { rows, detectedOpening, detectedClosing };
}

// --- AI extraction (Gemini) ----------------------------------------------

interface AiExtraction {
  summary: string;
  rows: ParsedRow[];
  detectedOpening: number | null;
  detectedClosing: number | null;
}

const GEMINI_MODEL = 'gemini-flash-latest'; // Google's rolling alias for its current free-tier Flash model.

// Uses Gemini to read the statement text directly and extract line items —
// far more tolerant of real-world bank layouts than the regex parser below.
// Returns null (never throws) whenever AI extraction isn't usable, so the
// caller can fall back to the regex parser without special-casing failures.
async function extractWithAI(text: string): Promise<AiExtraction | null> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return null;

  // Caps cost/latency on outlier statements; a normal monthly statement's
  // text is a small fraction of this.
  const truncated = text.length > 60000 ? text.slice(0, 60000) : text;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text:
                  'You extract structured data from raw bank statement text (pulled from a PDF, so spacing and line breaks may be imperfect). ' +
                  'Identify every transaction line item, in the order they appear, plus the opening and closing balance if shown. ' +
                  'Dates must be ISO 8601 (YYYY-MM-DD). Amounts must be positive numbers (magnitude only), with direction given separately. ' +
                  'Skip headers, footers, page numbers, and any non-transaction lines. ' +
                  'Write a short 1-3 sentence plain-English summary of the statement (period covered, number of transactions, notable activity).',
              },
            ],
          },
          contents: [{ role: 'user', parts: [{ text: truncated }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'object',
              properties: {
                summary: { type: 'string' },
                opening_balance: { type: 'number' },
                closing_balance: { type: 'number' },
                transactions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      date: { type: 'string', description: 'ISO 8601, YYYY-MM-DD' },
                      description: { type: 'string' },
                      amount: { type: 'number', description: 'positive magnitude' },
                      direction: { type: 'string', enum: ['debit', 'credit'] },
                      balance: { type: 'number', description: 'running balance after this line, if shown' },
                    },
                    required: ['date', 'description', 'amount', 'direction'],
                  },
                },
              },
              required: ['summary', 'transactions'],
            },
          },
        }),
      },
    );

    if (!response.ok) {
      console.error('Gemini API error', response.status, await response.text());
      return null;
    }

    const data = await response.json();

    if (data.promptFeedback?.blockReason) {
      console.error('Gemini blocked the request', data.promptFeedback.blockReason);
      return null;
    }

    const candidate = data.candidates?.[0];
    if (!candidate) return null;

    // A generation cut off by the token cap carries incomplete/invalid JSON —
    // safer to fall back to the regex parser than risk silently missing
    // line items.
    if (candidate.finishReason === 'MAX_TOKENS') {
      console.error('Gemini response truncated at MAX_TOKENS; falling back to regex parser');
      return null;
    }

    const jsonText = candidate.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('');
    if (!jsonText) return null;

    const input = JSON.parse(jsonText) as {
      summary?: string;
      opening_balance?: number;
      closing_balance?: number;
      transactions?: Array<{
        date: string;
        description: string;
        amount: number;
        direction: string;
        balance?: number;
      }>;
    };

    const rows: ParsedRow[] = [];
    for (const t of input.transactions ?? []) {
      const iso = parseDateToISO(t.date);
      const description = (t.description ?? '').trim();
      const amount = Number(t.amount);
      if (!iso || !description || !Number.isFinite(amount) || amount <= 0) continue;
      if (t.direction !== 'debit' && t.direction !== 'credit') continue;
      rows.push({
        date: iso,
        description,
        amount: Math.abs(amount),
        direction: t.direction,
        balance: Number.isFinite(t.balance) ? Number(t.balance) : undefined,
      });
    }
    if (rows.length === 0) return null;

    return {
      summary: input.summary?.trim() || '',
      rows,
      detectedOpening: Number.isFinite(input.opening_balance) ? Number(input.opening_balance) : null,
      detectedClosing: Number.isFinite(input.closing_balance) ? Number(input.closing_balance) : null,
    };
  } catch (err) {
    console.error('AI extraction failed', err);
    return null;
  }
}

// --- HTTP handler -------------------------------------------------------

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

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('bank-statements')
      .download(statement.file_path);
    if (downloadError || !fileData) throw new Error('Could not download the uploaded PDF');

    const arrayBuffer = await fileData.arrayBuffer();
    const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
    const { text: rawText } = await extractText(pdf, { mergePages: true });
    const text = Array.isArray(rawText) ? rawText.join('\n') : rawText;

    const aiResult = await extractWithAI(text);
    const { rows, detectedOpening, detectedClosing } = aiResult ?? parseStatementText(text);
    const aiSummary = aiResult?.summary || null;
    const parsedVia = aiResult ? 'ai' : 'regex';

    if (rows.length === 0) {
      await supabase
        .from('bank_recon_statements')
        .update({
          parse_status: 'failed',
          parse_error:
            'Could not find recognizable transaction lines in this PDF. It may be a scanned image without a text layer, or use a layout this parser doesn’t recognize yet.',
          raw_extracted: { textPreview: text.slice(0, 5000) },
        })
        .eq('id', statementId);
      return new Response(JSON.stringify({ success: false, transactionCount: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: categories, error: categoriesError } = await supabase
      .from('bank_recon_categories')
      .select('id, name, user_id');
    if (categoriesError) throw categoriesError;

    const { data: merchantMap, error: mapError } = await supabase
      .from('bank_recon_merchant_category_map')
      .select('merchant_pattern, category_id');
    if (mapError) throw mapError;

    const transactionRows = rows.map((row) => {
      const { categoryId, confidence } = classify(row.description, row.direction, categories ?? [], merchantMap ?? []);
      return {
        user_id: statement.user_id,
        statement_id: statementId,
        account_id: statement.account_id,
        pocket_id: null,
        date: row.date,
        description: row.description,
        amount: row.amount,
        direction: row.direction,
        category_id: categoryId,
        classification_confidence: confidence,
        classification_status: 'auto' as const,
        is_internal_transfer: false,
      };
    });

    const transactionsSum =
      Math.round(rows.reduce((s, r) => s + (r.direction === 'credit' ? r.amount : -r.amount), 0) * 100) / 100;

    let openingBalance = detectedOpening;
    let closingBalance = detectedClosing;
    let isReconciled: boolean | null;

    if (openingBalance != null && closingBalance != null) {
      isReconciled = Math.abs(openingBalance + transactionsSum - closingBalance) < 0.01;
    } else if (openingBalance != null) {
      closingBalance = Math.round((openingBalance + transactionsSum) * 100) / 100;
      isReconciled = null; // closing balance derived, not read from the statement — unverified
    } else if (closingBalance != null) {
      openingBalance = Math.round((closingBalance - transactionsSum) * 100) / 100;
      isReconciled = null;
    } else {
      openingBalance = 0;
      closingBalance = transactionsSum;
      isReconciled = null;
    }

    const { error: insertTxnsError } = await supabase.from('bank_recon_transactions').insert(transactionRows);
    if (insertTxnsError) throw insertTxnsError;

    const { error: balanceError } = await supabase.from('bank_recon_statement_balances').upsert(
      {
        user_id: statement.user_id,
        statement_id: statementId,
        pocket_id: null,
        opening_balance: openingBalance,
        closing_balance: closingBalance,
        transactions_sum: transactionsSum,
        is_reconciled: isReconciled,
      },
      { onConflict: 'statement_id,pocket_id' },
    );
    if (balanceError) throw balanceError;

    const dates = rows.map((r) => r.date).sort();

    const { error: updateError } = await supabase
      .from('bank_recon_statements')
      .update({
        parse_status: 'parsed',
        period_start: statement.period_start ?? dates[0],
        period_end: statement.period_end ?? dates[dates.length - 1],
        ai_summary: aiSummary,
        raw_extracted: {
          transactionCount: transactionRows.length,
          openingDetected: detectedOpening != null,
          closingDetected: detectedClosing != null,
          parsedVia,
        },
        parse_error: null,
      })
      .eq('id', statementId);
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, transactionCount: transactionRows.length }), {
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
