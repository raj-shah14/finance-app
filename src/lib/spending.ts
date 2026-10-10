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
 *  - Credit card payments are transfers however they got that way: a
 *    CC Bill-style category, a Transfers category, or — for transactions that
 *    were never categorized — Plaid's own "credit card payment" code. The
 *    last one matters because rows synced before that code was mapped sit
 *    uncategorized, and an uncategorized outflow would otherwise count as
 *    spending (double-counting the purchases the payment settles).
 *  - The paying side of a card payment is found by pairing, not by category:
 *    an uncategorized outflow from a non-card account that matches a
 *    card-side payment (same amount to the cent, within a few days) is that
 *    payment's source, so it is a transfer too. See markPairedCardPayments.
 *  - Uncategorized *inflows* are NOT netted. A negative amount with no
 *    category is far more likely a paycheck or transfer in than a refund,
 *    and netting it would wipe out spending. They're excluded and flagged.
 *
 * Dates are calendar dates at UTC midnight (how Plaid stores them), so all
 * month bucketing here is by UTC calendar month.
 */
import { TRANSFER_CATEGORIES, INCOME_CATEGORIES, CC_BILL_CATEGORIES } from "@/lib/categories";

export type TxKind = "spending" | "income" | "transfer" | "excluded";

/** What a category *is*. Wins over name matching when present. */
export type CategoryKind = "spending" | "income" | "transfer";

/** Plaid's raw detailed category for paying off a credit card. */
export const PLAID_CARD_PAYMENT_CODE = "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT";

export interface ClassifiableTransaction {
  /** Plaid sign: > 0 money out, < 0 money in. */
  amount: number;
  categoryName?: string | null;
  /** Raw Plaid detailed category (Transaction.plaidCategory), if known. */
  plaidCategory?: string | null;
  /** Type of the account the transaction is on ("credit", "depository"…). */
  accountType?: string | null;
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
  if (!name) return t.plaidCategory === PLAID_CARD_PAYMENT_CODE ? "transfer" : null;
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

/**
 * A payment toward a credit card, counted on the CARD side: a deposit
 * (amount < 0) on a credit account that is a transfer — a CC Bill-style
 * category, or Plaid's card-payment code. This is the figure for "how much
 * did I pay toward my cards"; it is NOT spending.
 *
 * Why the card side and not the checking side: with every card linked, each
 * payment lands on the card no matter which bank it came from (including
 * accounts that aren't linked at all), and Plaid tags it reliably. The
 * checking-side outflow only exists for linked bank accounts and tends to
 * need a manual category — merchant rules key on the full descriptor, which
 * for ACH payments embeds a changing ID, so they rarely match next month.
 * See isCardPaymentSource for that side, kept for reconciliation.
 */
export function isCardPayment(t: ClassifiableTransaction): boolean {
  if (t.accountType !== "credit" || t.amount >= 0) return false;
  // Must also be a transfer, so a row the user recategorized as spending
  // (or a plain merchant refund) is never counted as a payment.
  if (classifyTransaction(t).kind !== "transfer") return false;
  return (
    t.plaidCategory === PLAID_CARD_PAYMENT_CODE ||
    (t.categoryName != null && CC_BILL_CATEGORIES.includes(t.categoryName))
  );
}

/** Amount paid (always >= 0) if this is a card-side payment, else 0. */
export function cardPaymentAmount(t: ClassifiableTransaction): number {
  return isCardPayment(t) ? -t.amount : 0;
}

/**
 * The paying side of a card payment: money out of a non-card account that
 * looks like a card payment. Not counted anywhere (it mirrors the card-side
 * deposit); exists so the two sides can be reconciled to spot payments made
 * from an account that isn't linked, or checking rows missing a category.
 */
export function isCardPaymentSource(t: ClassifiableTransaction): boolean {
  if (t.amount <= 0 || t.accountType === "credit") return false;
  if (classifyTransaction(t).kind !== "transfer") return false;
  return (
    t.plaidCategory === PLAID_CARD_PAYMENT_CODE ||
    (t.categoryName != null && CC_BILL_CATEGORIES.includes(t.categoryName))
  );
}

/**
 * Spending made ON a credit card — purchases net of the card's refunds.
 * With every card linked this is the real card spend; compare it with
 * card payments (which lag it) rather than adding the two.
 */
export function cardPurchaseAmount(t: ClassifiableTransaction): number {
  return t.accountType === "credit" ? spendingAmount(t) : 0;
}

export function totalCardPayments(txns: ClassifiableTransaction[]): number {
  return txns.reduce((sum, t) => sum + cardPaymentAmount(t), 0);
}

export function totalCardPurchases(txns: ClassifiableTransaction[]): number {
  return txns.reduce((sum, t) => sum + cardPurchaseAmount(t), 0);
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

export interface PairableTransaction extends ClassifiableTransaction {
  id: string;
  date: string | Date;
}

const DAY_MS = 86_400_000;

/** UTC calendar day number of a transaction date (Plaid dates are UTC midnight). */
function dayNumber(date: string | Date): number {
  const iso = typeof date === "string" ? date : date.toISOString();
  return Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY_MS);
}

const cents = (amount: number) => Math.round(Math.abs(amount) * 100);

/**
 * Match each card-side payment to the uncategorized outflow from a non-card
 * account that paid it. Returns payment id -> source id.
 *
 * Conservative on purpose, since a wrong match hides real spending:
 *  - only uncategorized outflows are candidates — a row the user categorized
 *    (say Groceries) is never reinterpreted, and one already recognizable as
 *    a transfer needs no pairing;
 *  - amounts must match to the cent;
 *  - the dates must be within `windowDays` (card payments post a day or few
 *    after the debit, or before it);
 *  - one-to-one: each source pays at most one payment, and the closest date
 *    wins when several are equal.
 */
export function matchCardPayments<T extends PairableTransaction>(
  txns: T[],
  windowDays = 5
): Map<string, string> {
  const candidates = new Map<number, { id: string; day: number }[]>();
  for (const t of txns) {
    if (t.amount <= 0 || t.accountType === "credit") continue;
    const { kind, uncategorized } = classifyTransaction(t);
    if (!(kind === "spending" && uncategorized)) continue;
    const key = cents(t.amount);
    const list = candidates.get(key) ?? [];
    list.push({ id: t.id, day: dayNumber(t.date) });
    candidates.set(key, list);
  }

  const payments = txns
    .filter(isCardPayment)
    .map((t) => ({ id: t.id, day: dayNumber(t.date), key: cents(t.amount) }))
    .sort((a, b) => a.day - b.day);

  const matches = new Map<string, string>();
  for (const p of payments) {
    const list = candidates.get(p.key);
    if (!list) continue;
    let best = -1;
    let bestGap = Infinity;
    list.forEach((c, i) => {
      const gap = Math.abs(c.day - p.day);
      if (gap <= windowDays && gap < bestGap) {
        best = i;
        bestGap = gap;
      }
    });
    if (best >= 0) {
      matches.set(p.id, list[best].id);
      list.splice(best, 1);
    }
  }
  return matches;
}

/**
 * Returns the transactions with each paired payment source flagged as a
 * transfer, so every total in this module (spending, summarize, spendingBy)
 * leaves it out. Run it over the full set before aggregating — pairing needs
 * both sides present. Inputs are not mutated.
 */
export function markPairedCardPayments<T extends PairableTransaction>(
  txns: T[],
  windowDays = 5
): T[] {
  const sources = new Set(matchCardPayments(txns, windowDays).values());
  if (sources.size === 0) return txns;
  return txns.map((t) => (sources.has(t.id) ? { ...t, categoryKind: "transfer" as const } : t));
}

/** Plain-language statement of the rules, for UI footnotes and chat answers. */
export const SPENDING_DEFINITION =
  "Spending is money out minus refunds, excluding transfers (such as credit card payments, which would double-count the purchases they settle), income, and money moved into savings or investments. Uncategorized purchases are included; uncategorized deposits are left out.";
