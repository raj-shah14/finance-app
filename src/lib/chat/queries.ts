/**
 * Read-only query layer behind the finance chat assistant.
 *
 * Pure functions over an already-loaded list of the user's own transactions,
 * so every figure the model quotes comes from the shared definition in
 * `@/lib/spending` (never from the model doing arithmetic) and the rules can
 * be unit-tested without a database.
 */
import {
  classifyTransaction,
  monthKey,
  spendingBy,
  summarize,
  totalCardPayments,
  totalCardPurchases,
  SPENDING_DEFINITION,
  type ClassifiableTransaction,
} from "@/lib/spending";

export interface ChatTxn extends ClassifiableTransaction {
  /** YYYY-MM-DD (Plaid calendar date). */
  date: string;
  name: string;
  merchant: string | null;
  accountName: string;
  accountMask: string | null;
  pending: boolean;
}

export interface ChatAccount {
  name: string;
  mask: string | null;
  type: string;
  subtype: string | null;
  balance: number | null;
}

const MAX_GROUPS = 40;
const MAX_ROWS = 50;

const round = (n: number) => Math.round(n * 100) / 100;
const lc = (s: string | null | undefined) => (s ?? "").toLowerCase();

export interface Filters {
  start_date?: string;
  end_date?: string;
  category?: string;
  account?: string;
  account_type?: string;
  search?: string;
}

function accountMatches(t: ChatTxn, needle: string): boolean {
  const n = lc(needle);
  return lc(t.accountName).includes(n) || (t.accountMask ?? "") === needle;
}

export function filterTransactions(txns: ChatTxn[], f: Filters): ChatTxn[] {
  return txns.filter((t) => {
    if (f.start_date && t.date < f.start_date) return false;
    if (f.end_date && t.date > f.end_date) return false;
    if (f.category && lc(t.categoryName) !== lc(f.category)) return false;
    if (f.account && !accountMatches(t, f.account)) return false;
    if (f.account_type && lc(t.accountType) !== lc(f.account_type)) return false;
    if (f.search) {
      const n = lc(f.search);
      if (!lc(t.name).includes(n) && !lc(t.merchant).includes(n)) return false;
    }
    return true;
  });
}

export type GroupBy = "category" | "month" | "merchant" | "account" | "day";

const KEY_OF: Record<GroupBy, (t: ChatTxn) => string> = {
  category: (t) => t.categoryName ?? "Uncategorized",
  month: (t) => monthKey(t.date),
  merchant: (t) => t.merchant || t.name,
  account: (t) => (t.accountMask ? `${t.accountName} ••${t.accountMask}` : t.accountName),
  day: (t) => t.date,
};

/** How much history exists at all, so "nothing found" can be told apart from "no data that far back". */
export function dataCoverage(txns: ChatTxn[]) {
  let first: string | null = null;
  let last: string | null = null;
  for (const t of txns) {
    if (first === null || t.date < first) first = t.date;
    if (last === null || t.date > last) last = t.date;
  }
  return { first_transaction_date: first, last_transaction_date: last, total_transactions: txns.length };
}

export interface SpendingSummaryInput extends Filters {
  group_by?: GroupBy;
}

export function spendingSummary(txns: ChatTxn[], input: SpendingSummaryInput) {
  const rows = filterTransactions(txns, input);
  const s = summarize(rows);
  const groupBy = input.group_by ?? "category";
  const sortByKey = groupBy === "month" || groupBy === "day";
  const groups = [...spendingBy(rows, KEY_OF[groupBy]).entries()]
    .map(([key, b]) => ({ key, amount: round(b.amount), count: b.count }))
    .sort((a, b) => (sortByKey ? a.key.localeCompare(b.key) : b.amount - a.amount));

  return {
    filters: { ...input, group_by: groupBy },
    data_coverage: dataCoverage(txns),
    note: rows.length === 0 ? "No transactions matched these filters. This may mean no activity, or no data for that period - check data_coverage." : undefined,
    total_spending: round(s.spending),
    total_income: round(s.income),
    refunds_netted_in: round(s.refunds),
    // Card figures are over the same rows, so combine with account_type or
    // account filters to ask about specific cards.
    card_purchases: round(totalCardPurchases(rows)),
    card_payments_made: round(totalCardPayments(rows)),
    transaction_count: rows.length,
    uncategorized_purchases: { count: s.uncategorizedCount, amount: round(s.uncategorizedAmount) },
    groups: groups.slice(0, MAX_GROUPS),
    groups_omitted: Math.max(0, groups.length - MAX_GROUPS),
    definition: SPENDING_DEFINITION,
  };
}

export interface ListTransactionsInput extends Filters {
  min_amount?: number;
  max_amount?: number;
  sort?: "date" | "amount";
  limit?: number;
}

export function listTransactions(txns: ChatTxn[], input: ListTransactionsInput) {
  let rows = filterTransactions(txns, input);
  // Amount bounds apply to the absolute size, whichever direction it moved.
  if (input.min_amount !== undefined) rows = rows.filter((t) => Math.abs(t.amount) >= input.min_amount!);
  if (input.max_amount !== undefined) rows = rows.filter((t) => Math.abs(t.amount) <= input.max_amount!);
  rows = [...rows].sort((a, b) =>
    input.sort === "amount" ? Math.abs(b.amount) - Math.abs(a.amount) : b.date.localeCompare(a.date)
  );
  const limit = Math.min(Math.max(input.limit ?? 20, 1), MAX_ROWS);
  return {
    data_coverage: dataCoverage(txns),
    matched: rows.length,
    returned: Math.min(rows.length, limit),
    transactions: rows.slice(0, limit).map((t) => ({
      date: t.date,
      description: t.merchant || t.name,
      // Positive = money out, negative = money in.
      amount: round(t.amount),
      category: t.categoryName ?? "Uncategorized",
      account: KEY_OF.account(t),
      counted_as: classifyTransaction(t).kind,
      pending: t.pending,
    })),
  };
}

export function listAccounts(accounts: ChatAccount[]) {
  return {
    accounts: accounts.map((a) => ({
      name: a.mask ? `${a.name} ••${a.mask}` : a.name,
      type: a.type,
      subtype: a.subtype,
      balance: a.balance === null ? null : round(a.balance),
    })),
  };
}
