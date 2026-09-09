import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { encryptForUser } from "@/lib/crypto-envelope";
import { decryptBillsByOwner } from "@/lib/entity-crypto";

const ALLOWED_CADENCE_MONTHS = new Set([1, 3, 6, 12]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (process.env.USE_MOCK_DATA === "true") {
      return NextResponse.json({ success: true });
    }
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json();
    const { cadenceMonths, nextDueDate, notes } = body;

    const existing = await db.bill.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    if (cadenceMonths !== undefined && !ALLOWED_CADENCE_MONTHS.has(Number(cadenceMonths))) {
      return NextResponse.json(
        { error: "cadenceMonths must be one of 1, 3, 6, 12" },
        { status: 400 }
      );
    }

    const updated = await db.bill.update({
      where: { id },
      data: {
        cadenceMonths: cadenceMonths !== undefined ? Number(cadenceMonths) : undefined,
        nextDueDate: nextDueDate !== undefined ? (nextDueDate ? new Date(nextDueDate) : null) : undefined,
        notes:
          notes !== undefined
            ? notes && notes.trim()
              ? await encryptForUser(user.id, notes.trim())
              : null
            : undefined,
      },
      include: { category: true },
    });

    const decrypted = await decryptBillsByOwner([updated]);
    return NextResponse.json({
      ...decrypted[0],
      monthlyEquivalent: updated.amount / updated.cadenceMonths,
    });
  } catch (error) {
    console.error("Error updating bill:", error);
    return NextResponse.json({ error: "Failed to update bill" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (process.env.USE_MOCK_DATA === "true") {
      return NextResponse.json({ success: true });
    }
    const user = await requireUser();
    const { id } = await params;

    const existing = await db.bill.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    await db.bill.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting bill:", error);
    return NextResponse.json({ error: "Failed to delete bill" }, { status: 500 });
  }
}
