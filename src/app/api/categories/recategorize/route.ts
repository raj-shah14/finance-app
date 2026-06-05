import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * One-shot backfill: re-apply CategoryMapping to every transaction in
 * the user's household based on its stored Plaid `plaidCategory` /
 * MerchantCategoryRule. Useful after seeding new CategoryMapping rows
 * (e.g. adding Plaid TRANSFER_* → Transfers) so historical transactions
 * pick up the new categorization.
 *
 * Only updates transactions where the recomputed categoryId is
 * different from the current categoryId — so it's idempotent and cheap
 * to call multiple times.
 *
 * User-edited categorizations are preserved via MerchantCategoryRule
 * which takes priority. So if you manually set a transaction's category,
 * it stays.
 */
export async function POST() {
  try {
    const user = await requireUser();
    if (!user.householdId) {
      return NextResponse.json({ error: "No household" }, { status: 400 });
    }

    const [mappings, rules, transactions] = await Promise.all([
      db.categoryMapping.findMany(),
      db.merchantCategoryRule.findMany({
        where: { householdId: user.householdId },
      }),
      db.transaction.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          name: true,
          merchantName: true,
          plaidCategory: true,
          categoryId: true,
        },
      }),
    ]);

    const categoryMap = Object.fromEntries(
      mappings.map((m) => [m.plaidDetailed, m.categoryId])
    );
    const merchantRuleMap = Object.fromEntries(
      rules.map((r) => [r.merchantName, r.categoryId])
    );

    let updated = 0;
    for (const t of transactions) {
      const merchantKey = (t.merchantName || t.name).toLowerCase();
      const newCategoryId =
        merchantRuleMap[merchantKey] ||
        (t.plaidCategory ? categoryMap[t.plaidCategory] : null) ||
        null;
      if (newCategoryId !== t.categoryId) {
        await db.transaction.update({
          where: { id: t.id },
          data: { categoryId: newCategoryId },
        });
        updated += 1;
      }
    }

    return NextResponse.json({
      success: true,
      examined: transactions.length,
      updated,
    });
  } catch (error) {
    console.error("Recategorize error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to recategorize";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
