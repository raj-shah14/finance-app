import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mockAccountsData } from "@/lib/mock-data";

export async function GET() {
  try {
    if (process.env.USE_MOCK_DATA === "true") {
      return NextResponse.json(mockAccountsData);
    }
    const user = await requireUser();
    if (!user.householdId) {
      return NextResponse.json({ accounts: [] });
    }

    const accounts = await db.account.findMany({
      where: { householdId: user.householdId },
      include: {
        plaidItem: { select: { institutionName: true, lastSyncedAt: true } },
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    if (process.env.USE_MOCK_DATA === "true") {
      return NextResponse.json({ success: true });
    }
    const user = await requireUser();
    const { accountId } = await req.json();

    await db.account.delete({
      where: { id: accountId, userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
