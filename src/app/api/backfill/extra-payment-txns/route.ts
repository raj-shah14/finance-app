import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * One-time backfill: create a Transaction for every existing
 * LoanExtraPayment that doesn't already have one.
 *
 * Writes plaintext names (not encrypted) — the main encryption backfill
 * script will pick them up later. This avoids needing Key Vault perms.
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

      // Use plaintext name — encryption backfill will handle it later
      const accountName = p.account.name ?? "Loan";
      const txnName = `Extra principal payment – ${accountName}`;

      await db.transaction.create({
        data: {
          accountId: p.accountId,
          userId,
          householdId,
          categoryId: housingCat?.id ?? null,
          amount: p.amount,
          date: p.date,
          name: txnName,
          merchantName: null,
          notes: p.notes ?? null,
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
