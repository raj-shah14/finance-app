import { db } from "@/lib/db";

/**
 * Carry-forward semantics for budgets: a budget set in month X is
 * implicitly the budget for month X+1, X+2, ... until the user
 * explicitly edits or deletes it.
 *
 * Per-user: each member of a household maintains their own private
 * budgets. We only carry forward THIS user's most recent prior month —
 * never another member's rows.
 */
export async function ensureBudgetsForMonth(
  householdId: string,
  userId: string,
  month: number,
  year: number
): Promise<void> {
  const existing = await db.budget.count({
    where: { userId, month, year },
  });
  if (existing > 0) return;

  // Walk back up to 24 months looking for the most recent budgeted month
  // belonging to THIS user.
  let m = month;
  let y = year;
  for (let i = 0; i < 24; i++) {
    if (m === 1) {
      m = 12;
      y -= 1;
    } else {
      m -= 1;
    }
    const source = await db.budget.findMany({
      where: { userId, month: m, year: y },
      select: {
        categoryId: true,
        monthlyLimit: true,
      },
    });
    if (source.length > 0) {
      await db.budget.createMany({
        data: source.map((b) => ({
          householdId,
          userId,
          categoryId: b.categoryId,
          monthlyLimit: b.monthlyLimit,
          month,
          year,
        })),
        skipDuplicates: true,
      });
      return;
    }
  }
}
