import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mockBillsData } from "@/lib/mock-data";
import { decryptForUser } from "@/lib/crypto-envelope";
import { decryptTransaction } from "@/lib/entity-crypto";
import { encryptBillInput, decryptBillsByOwner } from "@/lib/entity-crypto";

const ALLOWED_CADENCE_MONTHS = new Set([1, 3, 6, 12]);

/**
 * Bills/subscriptions, tracked by flagging an existing transaction rather
 * than entered from scratch.
 *
 * GET returns every bill for the household, each carrying its raw
 * `amount`/`cadenceMonths` plus a derived `monthlyEquivalent`
 * (amount / cadenceMonths) so quarterly/semiannual/annual bills can be
 * rolled into a single "total monthly bills" figure.
 *
 * POST body: { transactionId, cadenceMonths, nextDueDate?, notes? }.
 * name/amount/category are copied from the source transaction at creation
 * time — editing the bill afterward doesn't reach back into that
 * transaction, so later transactions for the same merchant are unaffected.
 */
export async function GET() {
  try {
    if (process.env.USE_MOCK_DATA === "true") {
      return NextResponse.json({
        bills: mockBillsData.bills.map((b) => ({
          ...b,
          monthlyEquivalent: b.amount / b.cadenceMonths,
        })),
      });
    }
    const user = await requireUser();
    if (!user.householdId) {
      return NextResponse.json({ bills: [] });
    }

    const bills = await db.bill.findMany({
      where: { householdId: user.householdId },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });

    const decrypted = await decryptBillsByOwner(bills);

    return NextResponse.json({
      bills: decrypted.map((b) => ({
        ...b,
        monthlyEquivalent: b.amount / b.cadenceMonths,
      })),
    });
  } catch (error) {
    console.error("Error fetching bills:", error);
    return NextResponse.json({ error: "Failed to fetch bills" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (process.env.USE_MOCK_DATA === "true") {
      return NextResponse.json({ success: true });
    }
    const user = await requireUser();
    if (!user.householdId) {
      return NextResponse.json({ error: "No household" }, { status: 400 });
    }

    const body = await req.json();
    const { transactionId, cadenceMonths, nextDueDate, notes } = body;

    if (!transactionId || typeof transactionId !== "string") {
      return NextResponse.json({ error: "transactionId is required" }, { status: 400 });
    }
    const cadence = Number(cadenceMonths);
    if (!ALLOWED_CADENCE_MONTHS.has(cadence)) {
      return NextResponse.json(
        { error: "cadenceMonths must be one of 1, 3, 6, 12" },
        { status: 400 }
      );
    }

    // Privacy: only allow tracking a bill from your own transaction.
    const source = await db.transaction.findFirst({
      where: { id: transactionId, userId: user.id },
    });
    if (!source) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    const decryptedSource = await decryptTransaction(user.id, source);
    const name =
      (await decryptForUser(user.id, source.merchantName || source.name)) ??
      decryptedSource.merchantName ??
      decryptedSource.name;

    const created = await db.bill.create({
      data: await encryptBillInput(user.id, {
        name,
        amount: source.amount,
        cadenceMonths: cadence,
        categoryId: source.categoryId,
        nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
        sourceTransactionId: source.id,
        notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
        userId: user.id,
        householdId: user.householdId,
      }),
      include: { category: true },
    });

    const decrypted = await decryptBillsByOwner([created]);
    return NextResponse.json({
      ...decrypted[0],
      monthlyEquivalent: created.amount / created.cadenceMonths,
    });
  } catch (error) {
    console.error("Error creating bill:", error);
    return NextResponse.json({ error: "Failed to create bill" }, { status: 500 });
  }
}
