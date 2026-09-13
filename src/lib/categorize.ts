import type { Category } from './types'

const RULES: Array<[Category, RegExp]> = [
  ['Income', /salary|payroll|deposit from employer|interest earned|dividend/i],
  ['Groceries', /grocery|supermarket|walmart|kroger|whole foods|trader joe|safeway|aldi/i],
  ['Dining', /restaurant|cafe|coffee|starbucks|mcdonald|doordash|uber eats|grubhub|pizza/i],
  ['Transport', /uber|lyft|gas station|shell|chevron|exxon|parking|transit|metro|fuel/i],
  ['Utilities', /electric|water bill|gas bill|utility|internet|comcast|at&t|verizon|power company/i],
  ['Rent/Mortgage', /rent payment|mortgage|landlord|property management/i],
  ['Shopping', /amazon|target|best buy|ebay|mall|store purchase/i],
  ['Health', /pharmacy|clinic|hospital|doctor|cvs|walgreens|dental|medical/i],
  ['Entertainment', /netflix|spotify|movie|cinema|theatre|hulu|disney\+|game/i],
  ['Subscriptions', /subscription|membership|monthly fee|recurring/i],
  ['Transfers', /transfer to|transfer from|zelle|venmo|paypal transfer|wire transfer/i],
  ['Fees/Charges', /overdraft|service fee|atm fee|maintenance fee|late fee|interest charge/i],
]

export function categorize(description: string, amount: number): Category {
  for (const [category, pattern] of RULES) {
    if (pattern.test(description)) return category
  }
  if (amount > 0) return 'Income'
  return 'Other'
}
