import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mockAccountsData } from "@/lib/mock-data";
import { decryptAccount } from "@/lib/entity-crypto";
import { decryptForUser, encryptForUser } from "@/lib/crypto-envelope";

export async function GET() {
  try {
    if (process.env.USE_MOCK_DATA === "true") {
      return NextResponse.json(mockAccountsData);
    }
    const user = await requireUser();
    if (!user.householdId) {
      return NextResponse.json({ accounts: [] });
    }

    // Accounts are private per-user. Household members never see each
    // other's accounts/balances — they only see opted-in transactions
    // via /api/transactions.
    const accounts = await db.account.findMany({
      where: { userId: user.id },
      include: {
        plaidItem: { select: { id: true, institutionName: true, lastSyncedAt: true } },
        snapTradeItem: { select: { brokerageName: true, lastSyncedAt: true } },
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      accounts: await Promise.all(
        accounts.map(async (a) => {
          const decrypted = await decryptAccount(user.id, a);
          if (a.plaidItem?.institutionName) {
            decrypted.plaidItem = {
              ...a.plaidItem,
              institutionName: await decryptForUser(user.id, a.plaidItem.institutionName),
            };
          }
          return decrypted;
        })
      ),
    });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
}

/**
 * Rename an account. Works for every provider (Plaid, SnapTrade, manual) —
 * the display name is purely cosmetic and has no bearing on sync.
 * Body: { accountId: string, name: string }
 */
export async function PATCH(req: Request) {
  try {
    if (process.env.USE_MOCK_DATA === "true") {
      return NextResponse.json({ success: true });
    }
    const user = await requireUser();
    const { accountId, name } = await req.json();
    if (!accountId || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "accountId and a non-empty name are required" },
        { status: 400 }
      );
    }

    const account = await db.account.findFirst({
      where: { id: accountId, userId: user.id },
      select: { id: true },
    });
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const trimmed = name.trim();
    await db.account.update({
      where: { id: accountId },
      data: { name: (await encryptForUser(user.id, trimmed)) ?? trimmed },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error renaming account:", error);
    return NextResponse.json({ error: "Failed to rename account" }, { status: 500 });
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
