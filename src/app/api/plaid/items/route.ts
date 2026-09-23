import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { decryptForUser } from "@/lib/crypto-envelope";

/**
 * Lists every Plaid connection (Item) for the current user, including
 * ones with zero remaining accounts.
 *
 * /api/accounts only surfaces institutions by walking each account's
 * plaidItem relation, so an Item whose accounts were all deleted (but
 * the Item itself never was — see /api/plaid/disconnect) is invisible
 * there. Settings needs this list too, so an orphaned Item can actually
 * be found and removed instead of silently blocking a future re-link of
 * that institution forever.
 */
export async function GET() {
  try {
    if (process.env.USE_MOCK_DATA === "true") {
      return NextResponse.json({ items: [] });
    }
    const user = await requireUser();

    const items = await db.plaidItem.findMany({
      where: { userId: user.id },
      include: { _count: { select: { accounts: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      items: await Promise.all(
        items.map(async (item) => ({
          id: item.id,
          institutionName: item.institutionName
            ? await decryptForUser(user.id, item.institutionName)
            : null,
          lastSyncedAt: item.lastSyncedAt,
          accountCount: item._count.accounts,
        }))
      ),
    });
  } catch (error) {
    console.error("Error fetching Plaid items:", error);
    return NextResponse.json({ error: "Failed to fetch Plaid items" }, { status: 500 });
  }
}
