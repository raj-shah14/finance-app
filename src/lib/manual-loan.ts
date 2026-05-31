import { db } from "@/lib/db";

/**
 * Standard amortization engine for manual loans (mortgages, auto, etc.).
 *
 * Architecture: the loan balance is *derived* from immutable loan terms
 * (principal, note rate, term, start date) — NOT from subtracting raw
 * bank transaction amounts. This is critical because:
 *   • Bank withdrawals usually include taxes, insurance, HOA, escrow
 *     that DO NOT reduce principal.
 *   • Lender escrow rebalancing changes the withdrawal amount over time
 *     without changing the underlying loan.
 *   • Buydowns subsidize the cash payment but the loan still amortizes
 *     at the note rate.
 *
 * So we compute the scheduled balance at `today` using closed-form
 * amortization, then add any *extra principal* the user has paid
 * (excess of bank payments over scheduled P&I + escrow + HOA), which
 * accelerates the payoff.
 *
 * Closed-form remaining balance at month m (after m payments made):
 *   B(m) = P · [(1+r)^N − (1+r)^m] / [(1+r)^N − 1]
 * where P = principal, r = monthly rate, N = term in months.
 *
 * Scheduled monthly P&I (standard amortization formula):
 *   M = P · r · (1+r)^N / ((1+r)^N − 1)
 */

export type AmortizationInputs = {
  originalPrincipal: number;
  /** Annual percentage rate as a percent (e.g. 6.375 for 6.375%). */
  interestRate: number;
  termMonths: number;
  /** Optional override; otherwise derived from principal + rate + term. */
  monthlyPayment?: number | null;
};

/** Standard scheduled monthly P&I payment. */
export function scheduledMonthlyPayment(
  principal: number,
  aprPercent: number,
  termMonths: number
): number {
  if (termMonths <= 0) return 0;
  if (aprPercent === 0) return principal / termMonths;
  const r = aprPercent / 100 / 12;
  const factor = Math.pow(1 + r, termMonths);
  return (principal * r * factor) / (factor - 1);
}

/** Closed-form remaining balance after `monthsElapsed` scheduled payments. */
export function scheduledBalance(
  inputs: AmortizationInputs,
  monthsElapsed: number
): number {
  const { originalPrincipal, interestRate, termMonths } = inputs;
  if (monthsElapsed <= 0) return originalPrincipal;
  const m = Math.min(monthsElapsed, termMonths);
  if (interestRate === 0) {
    return originalPrincipal * (1 - m / termMonths);
  }
  const r = interestRate / 100 / 12;
  const factor = Math.pow(1 + r, termMonths);
  const remaining =
    (originalPrincipal * (factor - Math.pow(1 + r, m))) / (factor - 1);
  return Math.max(0, remaining);
}

/**
 * Roll a known balance forward by `monthsForward` scheduled payments.
 * Used when the loan has a `currentBalanceOverride` anchoring the
 * amortization to a lender-reported balance at a known date, so we
 * don't depend on perfectly correct start-date / origination params.
 */
export function balanceForward(
  startBalance: number,
  aprPercent: number,
  monthlyPayment: number,
  monthsForward: number
): number {
  if (monthsForward <= 0 || startBalance <= 0) {
    return Math.max(0, startBalance);
  }
  const r = aprPercent / 100 / 12;
  let balance = startBalance;
  for (let i = 0; i < monthsForward; i++) {
    if (balance <= 0) break;
    const interest = r > 0 ? balance * r : 0;
    const principal = Math.min(
      balance,
      Math.max(0, monthlyPayment - interest)
    );
    balance -= principal;
  }
  return Math.max(0, balance);
}

/** Number of whole months between two dates (calendar months elapsed). */
export function monthsBetween(start: Date, end: Date): number {
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());
  return Math.max(0, months);
}

/** Compute the principal/interest split for a single scheduled payment. */
export function monthlySplit(
  balanceBeforePayment: number,
  aprPercent: number,
  scheduledPayment: number
): { interest: number; principal: number; newBalance: number } {
  if (balanceBeforePayment <= 0) {
    return { interest: 0, principal: 0, newBalance: 0 };
  }
  const r = aprPercent / 100 / 12;
  const interest = balanceBeforePayment * r;
  const principal = Math.min(
    balanceBeforePayment,
    Math.max(0, scheduledPayment - interest)
  );
  return { interest, principal, newBalance: balanceBeforePayment - principal };
}

/**
 * Compute the current outstanding balance of a manual loan as of
 * `asOf` (defaults to now). Uses scheduled amortization plus any
 * extra principal detected from merchant-pattern payments.
 *
 * Extra-principal detection: for each matched transaction, compute
 * `excess = amount - (scheduledMonthlyPayment + escrowMonthly +
 * hoaMonthly)`. If positive, that excess is treated as extra principal
 * and reduces the balance further than the schedule says.
 */
export async function computeManualLoanBalance(opts: {
  /** Account row id — used to fetch related LoanExtraPayment rows. */
  accountId?: string;
  originalPrincipal: number;
  interestRate: number | null;
  termMonths: number | null;
  monthlyPayment: number | null;
  escrowMonthly: number | null;
  hoaMonthly: number | null;
  startDate: Date | null;
  /** Lender-reported balance at `currentBalanceAsOf`. When set, this
   *  becomes the amortization anchor — we roll forward from it instead
   *  of computing from origination. */
  currentBalanceOverride?: number | null;
  currentBalanceAsOf?: Date | null;
  merchantPatterns: string[];
  householdId: string;
  asOf?: Date;
}): Promise<number> {
  const {
    originalPrincipal,
    interestRate,
    termMonths,
    monthlyPayment,
    escrowMonthly,
    hoaMonthly,
    startDate,
    currentBalanceOverride,
    currentBalanceAsOf,
    merchantPatterns,
    householdId,
    asOf = new Date(),
  } = opts;

  // If we don't have enough to amortize, fall back to original principal.
  if (
    originalPrincipal == null ||
    originalPrincipal <= 0 ||
    interestRate == null ||
    termMonths == null ||
    termMonths <= 0
  ) {
    return currentBalanceOverride ?? originalPrincipal ?? 0;
  }

  const scheduledPmt =
    monthlyPayment ??
    scheduledMonthlyPayment(originalPrincipal, interestRate, termMonths);

  // Anchor: prefer lender-reported override; otherwise amortize from
  // origination using startDate.
  let balance: number;
  let anchorDate: Date;
  if (typeof currentBalanceOverride === "number") {
    anchorDate = currentBalanceAsOf ?? asOf;
    const monthsForward = monthsBetween(anchorDate, asOf);
    balance = balanceForward(
      currentBalanceOverride,
      interestRate,
      scheduledPmt,
      monthsForward
    );
  } else {
    anchorDate = startDate ?? new Date();
    const monthsElapsed = monthsBetween(anchorDate, asOf);
    balance = scheduledBalance(
      { originalPrincipal, interestRate, termMonths },
      monthsElapsed
    );
  }

  // Subtract extra principal from matching merchant-pattern payments
  // *posted after the anchor date* (payments before the anchor are
  // already baked into the override balance).
  //
  // Dedup against manually-recorded LoanExtraPayment rows: if a user
  // logs a lump sum and the same payment also lands in the bank feed
  // matching a merchant pattern, we'd double-count. Skip pattern
  // excess when there's a recorded extra payment of similar size
  // (±$5 OR within 1% of the txn amount) within ±3 days.
  let recordedExtras: { amount: number; date: Date }[] = [];
  if (opts.accountId) {
    recordedExtras = (
      await db.loanExtraPayment.findMany({
        where: {
          accountId: opts.accountId,
          date: { gt: anchorDate, lte: asOf },
        },
        select: { amount: true, date: true },
      })
    ).map((r) => ({ amount: Math.abs(r.amount), date: r.date }));
  }
  if (merchantPatterns && merchantPatterns.length > 0) {
    const orConditions = merchantPatterns.flatMap((p) => [
      { merchantName: { contains: p, mode: "insensitive" as const } },
      { name: { contains: p, mode: "insensitive" as const } },
    ]);
    const payments = await db.transaction.findMany({
      where: {
        householdId,
        date: { gt: anchorDate, lte: asOf },
        OR: orConditions,
      },
      select: { amount: true, date: true },
      orderBy: { date: "asc" },
    });

    const recurringNonPrincipal =
      (escrowMonthly ?? 0) + (hoaMonthly ?? 0);
    const expectedTotal = scheduledPmt + recurringNonPrincipal;
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

    for (const p of payments) {
      if (balance <= 0) break;
      const amount = Math.abs(p.amount);
      const excess = amount - expectedTotal;
      if (excess <= 0) continue;

      // Skip if a manually-recorded extra payment matches this bank
      // transaction within ±3 days and the amounts are roughly equal
      // (within $5 or 1%). Prevents double-counting when a user logs
      // a lump sum that also shows up as a bank transaction.
      const isDuplicate = recordedExtras.some((ex) => {
        const timeDelta = Math.abs(ex.date.getTime() - p.date.getTime());
        if (timeDelta > THREE_DAYS_MS) return false;
        const amountDelta = Math.abs(ex.amount - amount);
        return amountDelta <= 5 || amountDelta / Math.max(1, amount) <= 0.01;
      });
      if (isDuplicate) continue;

      balance = Math.max(0, balance - excess);
    }
  }

  // Apply user-recorded one-time extra principal payments. These are
  // always 100% to principal (no schedule subtraction). Applied after
  // dedup pass above to ensure consistent accounting regardless of order.
  for (const e of recordedExtras) {
    if (balance <= 0) break;
    balance = Math.max(0, balance - e.amount);
  }

  return Math.round(balance * 100) / 100;
}

/**
 * Recompute a single manual loan's currentBalance and persist it. Safe
 * to call after sync; no-op for non-loan or non-manual accounts.
 */
export async function refreshManualLoanBalance(
  accountId: string
): Promise<number | null> {
  const account = await db.account.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      type: true,
      provider: true,
      purchasePrice: true,
      interestRate: true,
      termMonths: true,
      monthlyPayment: true,
      escrowMonthly: true,
      hoaMonthly: true,
      purchaseDate: true,
      currentBalanceOverride: true,
      currentBalanceAsOf: true,
      merchantPatterns: true,
      householdId: true,
    },
  });
  if (!account || account.provider !== "manual" || account.type !== "loan") {
    return null;
  }
  if (account.purchasePrice == null) return null;

  const newBalance = await computeManualLoanBalance({
    accountId: account.id,
    originalPrincipal: account.purchasePrice,
    interestRate: account.interestRate,
    termMonths: account.termMonths,
    monthlyPayment: account.monthlyPayment,
    escrowMonthly: account.escrowMonthly,
    hoaMonthly: account.hoaMonthly,
    startDate: account.purchaseDate,
    currentBalanceOverride: account.currentBalanceOverride,
    currentBalanceAsOf: account.currentBalanceAsOf,
    merchantPatterns: account.merchantPatterns,
    householdId: account.householdId,
  });
  await db.account.update({
    where: { id: accountId },
    data: { currentBalance: newBalance },
  });
  return newBalance;
}

