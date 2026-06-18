import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { refreshManualLoanBalance } from "@/lib/manual-loan";
import { encryptForUser } from "@/lib/crypto-envelope";
import { decryptForUser } from "@/lib/crypto-envelope";

/**
 * Record a one-time extra principal payment on a manual loan. The
 * amortization engine subtracts this directly from the balance (100%
 * to principal — no interest split, no schedule subtraction).
 *
 * Use for lump sums that don't match a merchant pattern (e.g. lender's
 * principal-only portal, wire, or manual one-time payment).
 *
 * Body: { accountId: string, amount: number, date?: string (ISO), notes?: string }
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { accountId, amount, date, notes } = await req.json();

    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 });
    }
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "amount must be a positive number" },
        { status: 400 }
      );
    }

    const account = await db.account.findFirst({
      where: { id: accountId, userId: user.id, provider: "manual", type: "loan" },
    });
    if (!account) {
      return NextResponse.json({ error: "Manual loan not found" }, { status: 404 });
    }

    const payment = await db.loanExtraPayment.create({
      data: {
        accountId,
        amount,
        date: date ? new Date(date) : new Date(),
        notes: notes || null,
      },
    });

    // Create a matching Transaction so extra payments appear in expenses,
    // insights, and spending totals. Uses the "Housing" category if it
    // exists; falls back to uncategorized.
    const housingCat = await db.category.findFirst({
      where: { name: "Housing" },
      select: { id: true },
    });

    const accountName = account.name
      ? await decryptForUser(user.id, account.name)
      : "Loan";
    const txnName = `Extra principal payment – ${accountName}`;

    await db.transaction.create({
      data: {
        accountId,
        userId: user.id,
        householdId: user.householdId!,
        categoryId: housingCat?.id ?? null,
        amount, // positive = expense
        date: date ? new Date(date) : new Date(),
        name: (await encryptForUser(user.id, txnName)) ?? txnName,
        merchantName: null,
        notes: notes ? await encryptForUser(user.id, notes) : null,
        pending: false,
      },
    });

    // Recompute the loan balance immediately so the UI reflects it.
    await refreshManualLoanBalance(accountId);

    return NextResponse.json(payment);
  } catch (error) {
    console.error("Error recording extra payment:", error);
    const message =
      error instanceof Error ? error.message : "Failed to record extra payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Delete an extra principal payment.
 * Body: { paymentId: string }
 */
export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const { paymentId } = await req.json();
    if (!paymentId) {
      return NextResponse.json({ error: "paymentId is required" }, { status: 400 });
    }

    const payment = await db.loanExtraPayment.findUnique({
      where: { id: paymentId },
      include: { account: { select: { id: true, userId: true } } },
    });
    if (!payment || payment.account.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.loanExtraPayment.delete({ where: { id: paymentId } });

    // Remove the corresponding expense Transaction. We match by
    // account + exact amount + exact date (set at creation time).
    await db.transaction.deleteMany({
      where: {
        accountId: payment.account.id,
        amount: payment.amount,
        date: payment.date,
        plaidTransactionId: null, // only manual (not bank-synced)
      },
    });

    await refreshManualLoanBalance(payment.account.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting extra payment:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete" },
      { status: 500 }
    );
  }
}
