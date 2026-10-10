/**
 * The one definition of "what counts as spending" (and income).
 *
 * Every number the app shows for spending — Dashboard, Insights, Expenses,
 * Budgets, Transactions summary, and the chat assistant's tools — should come
 * from here, so the same month can never read differently on two pages.
 * Pure functions only (no DB, no React), which is what makes the rules cheap
 * to test and safe to share between server routes and client components.
 *
 * Sign convention (Plaid): amount > 0 is money out, amount < 0 is money in.
 *
 * Rules:
 *  - A transaction in a TRANSFER category (card payments, account transfers)
 *    is never spending or income — counting it would double-count the
 *    purchases a card payment settles.
 *  - A transaction in an INCOME category is income when it's a deposit
 *    (amount < 0). The outflow side (amount > 0, e.g. money moved into
 *    savings) is neither spending nor income.
 *  - Everything else is spending, and it NETS: a refund (amount < 0 in a
 *    spending category) reduces spending rather than being dropped, because
 *    a refund really does reduce what you spent.
 *  - Uncategorized outflows count as spending (hiding them would silently
 *    understate it); they're flagged so callers can say how many there are.
 *  - Uncategorized *inflows* are NOT netted. A negative amount with no
 *    category is far more likely a paycheck or transfer in than a refund,
 *    and netting it would wipe out spending. They're excluded and flagged.
 *
 * Dates are calendar dates at UTC midnight (how Plaid stores them), so all
 * month bucketing here is by UTC calendar month.
 */
import { TRANSFER_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories";

export type TxKind = "spending" | "income" | "transfer" | "excluded";

/** What a category *is*. Wins over name matching when present. */
export type CategoryKind = "spending" | "income" | "transfer";

export interface ClassifiableTransaction {
  /** Plaid sign: > 0 money out, < 0 money in. */
  amount: number;
  categoryName?: string | null;
  /** Explicit kind of the category, when known (beats matching by name). */
  categoryKind?: CategoryKind | null;
}

export interface Classification {
  kind: TxKind;
  /** No category assigned. */
  uncategorized: boolean;
}

function categoryKindOf(t: ClassifiableTransaction): CategoryKind | null {
  if (t.categoryKind) return t.categoryKind;
  const name = t.categoryName;
  if (!name) return null;
  if (TRANSFER_CATEGORIES.includes(name)) return "transfer";
  if (INCOME_CATEGORIES.includes(name)) return "income";
  return "spending";
}

export function classifyTransaction(t: ClassifiableTransaction): Classification {
  const kind = categoryKindOf(t);
  const uncategorized = kind === null;

  if (kind === "transfer") return { kind: "transfer", uncategorized };
  if (kind === "income") {
    return { kind: t.amount < 0 ? "income" : "excluded", uncategorized };
  }
  if (uncategorized && t.amount < 0) {
    return { kind: "excluded", uncategorized };
  }
  return { kind: "spending", uncategorized };
}

/**
 * Signed contribution to spending: positive for a purchase, negative for a
 * refund, 0 if the transaction isn't spending.
 */
export function spendingAmount(t: ClassifiableTransaction): number {
  return classifyTransaction(t).kind === "spending" ? t.amount : 0;
}

/** Money in that counts as income (always >= 0), 0 otherwise. */
export function incomeAmount(t: ClassifiableTransaction): number {
  return classifyTransaction(t).kind === "income" ? -t.amount : 0;
}

export function totalSpending(txns: ClassifiableTransaction[]): number {
  return txns.reduce((sum, t) => sum + spendingAmount(t), 0);
}

export function totalIncome(txns: ClassifiableTransaction[]): number {
  return txns.reduce((sum, t) => sum + incomeAmount(t), 0);
}

/** "YYYY-MM" of the UTC calendar month a transaction date falls in. */
export function monthKey(date: string | Date): string {
  return (typeof date === "string" ? date : date.toISOString()).slice(0, 7);
}

export interface Bucket {
  amount: number;
  count: number;
}

/**
 * Net spending grouped by any key (category, month, account, merchant…).
 * Only spending transactions contribute; a refund lowers its bucket.
 */
export function spendingBy<T extends ClassifiableTransaction>(
  txns: T[],
  keyOf: (t: T) => string
): Map<string, Bucket> {
  const out = new Map<string, Bucket>();
  for (const t of txns) {
    if (classifyTransaction(t).kind !== "spending") continue;
    const key = keyOf(t);
    const bucket = out.get(key) ?? { amount: 0, count: 0 };
    bucket.amount += t.amount;
    bucket.count += 1;
    out.set(key, bucket);
  }
  return out;
}

export interface SpendingSummary {
  /** Net spending (purchases minus refunds). */
  spending: number;
  /** Deposits in income categories. */
  income: number;
  /** Sum of refunds netted into `spending` (a positive number). */
  refunds: number;
  /** Count / amount of uncategorized outflows included in `spending`. */
  uncategorizedCount: number;
  uncategorizedAmount: number;
  /** Uncategorized inflows left out of both spending and income. */
  uncategorizedInflowCount: number;
  uncategorizedInflowAmount: number;
  transferCount: number;
}

export function summarize(txns: ClassifiableTransaction[]): SpendingSummary {
  const s: SpendingSummary = {
    spending: 0,
    income: 0,
    refunds: 0,
    uncategorizedCount: 0,
    uncategorizedAmount: 0,
    uncategorizedInflowCount: 0,
    uncategorizedInflowAmount: 0,
    transferCount: 0,
  };
  for (const t of txns) {
    const { kind, uncategorized } = classifyTransaction(t);
    if (kind === "spending") {
      s.spending += t.amount;
      if (t.amount < 0) s.refunds += -t.amount;
      if (uncategorized) {
        s.uncategorizedCount += 1;
        s.uncategorizedAmount += t.amount;
      }
    } else if (kind === "income") {
      s.income += -t.amount;
    } else if (kind === "transfer") {
      s.transferCount += 1;
    } else if (uncategorized) {
      s.uncategorizedInflowCount += 1;
      s.uncategorizedInflowAmount += -t.amount;
    }
  }
  return s;
}

/** Plain-language statement of the rules, for UI footnotes and chat answers. */
export const SPENDING_DEFINITION =
  "Spending is money out minus refunds, excluding transfers (such as credit card payments, which would double-count the purchases they settle), income, and money moved into savings or investments. Uncategorized purchases are included; uncategorized deposits are left out.";
