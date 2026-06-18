import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { encryptForUser, decryptForUser } from "@/lib/crypto-envelope";

/**
 * One-time backfill: create a Transaction for every existing
 * LoanExtraPayment that doesn't already have one.
 *
 * Hit this endpoint once from the browser (logged in as yourself).
 * Safe to re-run — skips payments that already have matching transactions.
 */
export async function POST() {
  try {
    const user = await requireUser();

    const payments = await db.loanExtraPayment.findMany({
      include: {
        account: {
          include: { user: { select: { id: true, householdId: true } } },
        },
      },
    });

    const housingCat = await db.category.findFirst({
      where: { name: "Housing" },
      select: { id: true },
    });

    let created = 0;
    let skipped = 0;

    for (const p of payments) {
      const userId = p.account.userId;
      const householdId = p.account.user.householdId;
      if (!householdId) { skipped += 1; continue; }

      const existing = await db.transaction.findFirst({
        where: {
          accountId: p.accountId,
          amount: p.amount,
          date: p.date,
          plaidTransactionId: null,
        },
      });
      if (existing) { skipped += 1; continue; }

      const accountName = p.account.name
        ? await decryptForUser(userId, p.account.name)
        : "Loan";
      const txnName = `Extra principal payment – ${accountName}`;

      await db.transaction.create({
        data: {
          accountId: p.accountId,
          userId,
          householdId,
          categoryId: housingCat?.id ?? null,
          amount: p.amount,
          date: p.date,
          name: (await encryptForUser(userId, txnName)) ?? txnName,
          merchantName: null,
          notes: p.notes ? await encryptForUser(userId, p.notes) : null,
          pending: false,
        },
      });
      created += 1;
    }

    return NextResponse.json({ success: true, created, skipped });
  } catch (error) {
    console.error("Backfill extra payment txns error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
