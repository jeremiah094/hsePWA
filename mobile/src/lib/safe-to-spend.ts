// Pure, platform-agnostic "safe to spend" calculation. Used unchanged by
// both the mobile and web builds so the figure never diverges by platform.

export interface SafeToSpendAccountBalance {
  accountId: string;
  /** Whether this account's balance should count toward safe-to-spend (loan/savings accounts don't). */
  isSpendRelevant: boolean;
  currentBalance: number;
}

export interface SafeToSpendLoanCommitment {
  accountId: string;
  dueDayOfMonth: number;
  expectedAmount: number;
  lastPaidDate: string | null; // ISO date
}

export interface SafeToSpendInput {
  balances: SafeToSpendAccountBalance[];
  loanCommitments: SafeToSpendLoanCommitment[];
  /** Additional recurring bills the user has tagged, monthly amount each. */
  recurringBills?: { name: string; amount: number }[];
  /** Defaults to now; pass explicitly in tests for deterministic output. */
  today?: Date;
}

export interface SafeToSpendResult {
  totalBalance: number;
  upcomingLoanPayments: number;
  upcomingBills: number;
  safeToSpend: number;
}

/**
 * A loan payment is "upcoming" if its due day this month hasn't passed yet,
 * or has passed but hasn't been paid (lastPaidDate isn't within the current
 * period) — i.e. it's still owed against the current balance.
 */
function isLoanPaymentUpcoming(commitment: SafeToSpendLoanCommitment, today: Date): boolean {
  const dueThisMonth = new Date(today.getFullYear(), today.getMonth(), commitment.dueDayOfMonth);

  if (!commitment.lastPaidDate) return true;

  const lastPaid = new Date(commitment.lastPaidDate);
  const paidThisMonth =
    lastPaid.getFullYear() === today.getFullYear() && lastPaid.getMonth() === today.getMonth();

  if (paidThisMonth) return false;

  // Not paid this month: still upcoming/owed, whether the due date is ahead
  // of or behind today (an unpaid past-due amount still needs to come out).
  return true;
}

export function calculateSafeToSpend(input: SafeToSpendInput): SafeToSpendResult {
  const today = input.today ?? new Date();

  const totalBalance = input.balances
    .filter((b) => b.isSpendRelevant)
    .reduce((sum, b) => sum + b.currentBalance, 0);

  const upcomingLoanPayments = input.loanCommitments
    .filter((c) => isLoanPaymentUpcoming(c, today))
    .reduce((sum, c) => sum + c.expectedAmount, 0);

  const upcomingBills = (input.recurringBills ?? []).reduce((sum, b) => sum + b.amount, 0);

  const safeToSpend = totalBalance - upcomingLoanPayments - upcomingBills;

  return { totalBalance, upcomingLoanPayments, upcomingBills, safeToSpend };
}
