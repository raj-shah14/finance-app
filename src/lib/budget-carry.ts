import { db } from "@/lib/db";

/**
 * Carry-forward semantics for budgets: a budget set in month X is
 * implicitly the budget for month X+1, X+2, ... until the user
 * explicitly edits or deletes it.
 *
 * Implementation: when a caller asks for budgets for (householdId,
 * month, year) and none exist, we look back month-by-month (up to 24
 * months) for the most recent month that has any budget rows for
 * this household, then copy those rows into the requested month. This
 * makes carry-forward "real" rows the user can independently edit or
 * delete without affecting prior months.
 *
 * Deletion semantics: deleting a budget for category C in month X
 * means C is *not* carried forward from X. But months later than X
 * that have already been materialized retain their own rows; if the
 * user wants to fully remove C going forward, they need to delete
 * those copies too. This matches how recurring transactions behave in
 * common finance apps.
 */
export async function ensureBudgetsForMonth(
  householdId: string,
  month: number,
  year: number
): Promise<void> {
  const existing = await db.budget.count({
    where: { householdId, month, year },
  });
  if (existing > 0) return;

  // Walk back up to 24 months looking for the most recent budgeted month.
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
      where: { householdId, month: m, year: y },
      select: {
        categoryId: true,
        monthlyLimit: true,
        userId: true,
      },
    });
    if (source.length > 0) {
      // Copy rows into the requested month. Use createMany + skipDuplicates
      // so concurrent requests don't crash on the unique constraint.
      await db.budget.createMany({
        data: source.map((b) => ({
          householdId,
          categoryId: b.categoryId,
          userId: b.userId,
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
