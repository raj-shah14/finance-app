import { db } from "@/lib/db";

/**
 * Returns the first instant of the current period for the given cadence.
 *   - monthly   → 1st day of the current month
 *   - quarterly → 1st day of the current calendar quarter
 *   - yearly    → Jan 1 of the current year
 *   - one_time  → null (no period gate; cumulative)
 */
export function periodStart(cadence: string, asOf: Date = new Date()): Date | null {
  const y = asOf.getFullYear();
  const m = asOf.getMonth();
  switch (cadence) {
    case "monthly":
      return new Date(y, m, 1);
    case "quarterly":
      return new Date(y, Math.floor(m / 3) * 3, 1);
    case "yearly":
      return new Date(y, 0, 1);
    default:
      return null;
  }
}

/**
 * Returns the *previous* period's [start, end) for a given cadence and
 * a reference date inside the current period. Used by the snapshot job
 * to capture what was achieved in the period that just ended.
 */
export function previousPeriodRange(
  cadence: string,
  asOf: Date = new Date()
): { start: Date; end: Date } | null {
  const curr = periodStart(cadence, asOf);
  if (!curr) return null;
  let start: Date;
  switch (cadence) {
    case "monthly":
      start = new Date(curr.getFullYear(), curr.getMonth() - 1, 1);
      break;
    case "quarterly":
      start = new Date(curr.getFullYear(), curr.getMonth() - 3, 1);
      break;
    case "yearly":
      start = new Date(curr.getFullYear() - 1, 0, 1);
      break;
    default:
      return null;
  }
  return { start, end: curr };
}

/**
 * Sum the absolute amounts of a single user's transactions matching any
 * of `merchantPatterns` (case-insensitive substring on merchantName or
 * name) within `[from, to)`. Used by recurring goals.
 *
 * Goals are private per-user (privacy fix 2026-06-04), so progress must
 * only look at the goal owner's transactions — never the partner's.
 */
async function sumMatchingTransactions(
  userId: string,
  patterns: string[],
  from: Date | null,
  to: Date | null
): Promise<number> {
  if (!patterns || patterns.length === 0) return 0;
  const orConditions = patterns.flatMap((p) => [
    { merchantName: { contains: p, mode: "insensitive" as const } },
    { name: { contains: p, mode: "insensitive" as const } },
  ]);
  const where: Record<string, unknown> = { userId, OR: orConditions };
  if (from || to) {
    const dateRange: Record<string, Date> = {};
    if (from) dateRange.gte = from;
    if (to) dateRange.lt = to;
    where.date = dateRange;
  }
  const result = await db.transaction.aggregate({
    where: where as Parameters<typeof db.transaction.aggregate>[0]["where"],
    _sum: { amount: true },
  });
  return Math.abs(result._sum.amount ?? 0);
}

/**
 * Net deposits to an account within [from, to). For depository /
 * investment accounts in Plaid's convention, amount > 0 is a
 * withdrawal and amount < 0 is a deposit. So net deposits = -sum.
 */
async function netDepositsToAccount(
  accountId: string,
  from: Date | null,
  to: Date | null
): Promise<number> {
  const where: Record<string, unknown> = { accountId };
  if (from || to) {
    const dateRange: Record<string, Date> = {};
    if (from) dateRange.gte = from;
    if (to) dateRange.lt = to;
    where.date = dateRange;
  }
  const result = await db.transaction.aggregate({
    where: where as Parameters<typeof db.transaction.aggregate>[0]["where"],
    _sum: { amount: true },
  });
  // Negative sum = net deposits; positive sum = net withdrawals.
  return Math.max(0, -(result._sum.amount ?? 0));
}

/**
 * Compute a goal's achieved amount within an arbitrary window.
 *
 * For one-time (cumulative) goals: window should be (null, asOf) so
 * we include all-time progress. For recurring goals: window is the
 * period of interest (current or any historical period).
 *
 * Priority (matches the live /api/goals logic so live progress and
 * snapshots stay consistent):
 *   1. Linked loan/credit + payoff (one_time only) → principal paid
 *   2. Linked depository/investment + one_time → current balance
 *   3. Linked depository/investment + recurring → net deposits in window
 *   4. merchantPatterns → sum of matching txns in window
 *   5. Stored currentAmount → manual value
 */
export async function computeGoalAchieved(
  goal: {
    householdId: string;
    userId: string;
    kind: string;
    cadence: string;
    targetAmount: number;
    currentAmount: number | null;
    merchantPatterns: string[];
    linkedAccountId: string | null;
    linkedAccount: { id: string; type: string; currentBalance: number | null } | null;
  },
  window: { from: Date | null; to: Date | null }
): Promise<number> {
  const isRecurring = goal.cadence && goal.cadence !== "one_time";

  if (goal.linkedAccount) {
    const acct = goal.linkedAccount;
    const isLiability = acct.type === "loan" || acct.type === "credit";
    if (!isRecurring) {
      // One-time goals use balance snapshots.
      if (goal.kind === "payoff" && isLiability) {
        return Math.max(0, goal.targetAmount - (acct.currentBalance ?? 0));
      }
      if (!isLiability) {
        return Math.max(0, acct.currentBalance ?? 0);
      }
    } else if (!isLiability) {
      // Recurring + savings account → net deposits in window.
      return netDepositsToAccount(acct.id, window.from, window.to);
    }
    // Fall through for unusual combos.
  }

  if (goal.merchantPatterns && goal.merchantPatterns.length > 0) {
    return sumMatchingTransactions(
      goal.userId,
      goal.merchantPatterns,
      window.from,
      window.to
    );
  }

  return goal.currentAmount ?? 0;
}
