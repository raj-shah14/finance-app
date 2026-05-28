import { db } from "@/lib/db";

/**
 * Recompute the current outstanding balance of a manual loan account
 * by applying every matching payment transaction through a standard
 * monthly amortization formula:
 *
 *   interest = balance × (APR / 12)
 *   principal = payment - interest
 *   newBalance = max(0, balance - principal)
 *
 * Payments are processed in chronological order so each subsequent
 * payment's interest is computed against the correctly reduced balance.
 *
 * If the loan has no interestRate set, the entire payment counts as
 * principal (i.e., balance shrinks by the full payment amount). This is
 * a fine fallback for users who don't care to track interest precisely.
 *
 * Inputs:
 *   - originalPrincipal: starting loan amount when opened
 *   - interestRate: APR as a percentage (e.g. 6.5 for 6.5%); null/0 = no
 *     interest split (full-payment-to-principal)
 *   - merchantPatterns: case-insensitive substrings matched against
 *     Transaction.merchantName and Transaction.name
 *   - householdId: scope of transactions to consider
 */
export async function computeManualLoanBalance(opts: {
  originalPrincipal: number;
  interestRate: number | null;
  merchantPatterns: string[];
  householdId: string;
}): Promise<number> {
  const { originalPrincipal, interestRate, merchantPatterns, householdId } = opts;

  if (!merchantPatterns || merchantPatterns.length === 0) {
    return originalPrincipal;
  }

  const orConditions = merchantPatterns.flatMap((p) => [
    { merchantName: { contains: p, mode: "insensitive" as const } },
    { name: { contains: p, mode: "insensitive" as const } },
  ]);

  const payments = await db.transaction.findMany({
    where: { householdId, OR: orConditions },
    select: { amount: true, date: true },
    orderBy: { date: "asc" },
  });

  if (payments.length === 0) return originalPrincipal;

  // Plaid amount sign: positive = money leaving the account (= expense
  // / payment). Take absolute value so we treat both signs uniformly.
  const monthlyRate =
    interestRate && interestRate > 0 ? interestRate / 100 / 12 : 0;

  let balance = originalPrincipal;
  for (const p of payments) {
    if (balance <= 0) break;
    const payment = Math.abs(p.amount);
    if (payment <= 0) continue;

    const interestForPeriod = monthlyRate > 0 ? balance * monthlyRate : 0;
    const principalForPeriod = Math.min(
      balance,
      Math.max(0, payment - interestForPeriod)
    );
    balance = Math.max(0, balance - principalForPeriod);
  }

  return Math.round(balance * 100) / 100;
}

/**
 * Recompute a single manual loan's currentBalance from its merchant
 * patterns and persist the result.
 */
export async function refreshManualLoanBalance(accountId: string): Promise<number | null> {
  const account = await db.account.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      type: true,
      provider: true,
      purchasePrice: true,
      interestRate: true,
      merchantPatterns: true,
      householdId: true,
    },
  });
  if (!account || account.provider !== "manual" || account.type !== "loan") {
    return null;
  }
  if (account.purchasePrice == null) return null;

  const newBalance = await computeManualLoanBalance({
    originalPrincipal: account.purchasePrice,
    interestRate: account.interestRate,
    merchantPatterns: account.merchantPatterns,
    householdId: account.householdId,
  });
  await db.account.update({
    where: { id: accountId },
    data: { currentBalance: newBalance },
  });
  return newBalance;
}
