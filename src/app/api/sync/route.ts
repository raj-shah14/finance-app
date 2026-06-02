import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Unified sync endpoint — refreshes balances + transactions from every
 * connected provider (Plaid for banks, SnapTrade for brokerages) in
 * parallel. Used by all "Refresh" buttons in the UI.
 *
 * Each provider sync is best-effort: a failure in one does not block the
 * other. The response surfaces per-provider status so the caller can
 * report partial success.
 */
async function callInternal(req: Request, path: string) {
  const url = new URL(path, req.url);
  return fetch(url.toString(), {
    method: "POST",
    headers: {
      cookie: req.headers.get("cookie") || "",
      authorization: req.headers.get("authorization") || "",
    },
  });
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();

    // Only call each provider if the user actually has connections, to
    // avoid spurious "not configured" errors when, e.g., SnapTrade env
    // vars are missing for users who never linked a brokerage.
    const [plaidCount, snapTradeCount] = await Promise.all([
      db.plaidItem.count({ where: { userId: user.id } }),
      // Count any SnapTradeItem for the user, not just those with an
      // authorizationId — the SnapTrade sync route itself is what
      // back-fills the authorizationId after listBrokerageAuthorizations.
      // Skipping rows where authorizationId is null would prevent the
      // very first sync from ever running.
      db.snapTradeItem.count({ where: { userId: user.id } }),
    ]);

    const tasks: Array<Promise<{ provider: string; ok: boolean; data: unknown }>> =
      [];

    if (plaidCount > 0) {
      tasks.push(
        callInternal(req, "/api/plaid/sync")
          .then(async (r) => ({
            provider: "plaid",
            ok: r.ok,
            data: await r.json().catch(() => ({})),
          }))
          .catch((err) => ({
            provider: "plaid",
            ok: false,
            data: { error: String(err) },
          }))
      );
    }

    if (snapTradeCount > 0) {
      tasks.push(
        callInternal(req, "/api/snaptrade/sync")
          .then(async (r) => ({
            provider: "snaptrade",
            ok: r.ok,
            data: await r.json().catch(() => ({})),
          }))
          .catch((err) => ({
            provider: "snaptrade",
            ok: false,
            data: { error: String(err) },
          }))
      );
    }

    const results = await Promise.all(tasks);

    // After provider syncs land new transactions, propagate those
    // changes through everything that derives from transactions:
    //   1. Manual loan balances → amortize forward with new payments
    //   2. Goal snapshots → write any missing previous-period rows so
    //      trend sparklines are current immediately, not only after the
    //      6-hour cron tick
    //
    // Live-computed views (insights, budgets, goal current progress)
    // don't need explicit refresh — they re-aggregate on every GET.
    //
    // Carry-forward budgets materialize on first read of a new month
    // (handled by ensureBudgetsForMonth in /api/budgets and /api/insights),
    // so they also need no action here.
    const manualLoans = await db.account.findMany({
      where: { userId: user.id, type: "loan", provider: "manual" },
      select: { id: true },
    });
    let manualLoansRefreshed = 0;
    if (manualLoans.length > 0) {
      const { refreshManualLoanBalance } = await import("@/lib/manual-loan");
      await Promise.all(
        manualLoans.map(async (l) => {
          try {
            await refreshManualLoanBalance(l.id);
            manualLoansRefreshed += 1;
          } catch (err) {
            console.error("Manual loan refresh failed:", l.id, err);
          }
        })
      );
    }

    // Snapshot any recurring goals in this household whose previous
    // period isn't yet captured. Same logic as the cron — idempotent
    // via the (goalId, periodStart) unique constraint.
    let snapshotsWritten = 0;
    if (user.householdId) {
      const recurringGoals = await db.goal.findMany({
        where: {
          householdId: user.householdId,
          cadence: { in: ["monthly", "quarterly", "yearly"] },
        },
        include: {
          linkedAccount: {
            select: { id: true, type: true, currentBalance: true },
          },
        },
      });
      const { computeGoalAchieved, previousPeriodRange } = await import(
        "@/lib/goal-progress"
      );
      for (const g of recurringGoals) {
        const prev = previousPeriodRange(g.cadence);
        if (!prev) continue;
        const existing = await db.goalSnapshot.findUnique({
          where: {
            goalId_periodStart: { goalId: g.id, periodStart: prev.start },
          },
        });
        if (existing) continue;
        try {
          const achieved = await computeGoalAchieved(
            {
              householdId: g.householdId,
              kind: g.kind,
              cadence: g.cadence,
              targetAmount: g.targetAmount,
              currentAmount: g.currentAmount,
              merchantPatterns: g.merchantPatterns,
              linkedAccountId: g.linkedAccountId,
              linkedAccount: g.linkedAccount,
            },
            { from: prev.start, to: prev.end }
          );
          await db.goalSnapshot.create({
            data: {
              goalId: g.id,
              periodStart: prev.start,
              periodEnd: new Date(prev.end.getTime() - 1),
              achievedAmount: achieved,
              targetAmount: g.targetAmount,
            },
          });
          snapshotsWritten += 1;
        } catch (err) {
          console.error("Goal snapshot failed:", g.id, err);
        }
      }
    }

    return NextResponse.json({
      success: results.every((r) => r.ok),
      results,
      manualLoansRefreshed,
      goalSnapshotsWritten: snapshotsWritten,
    });
  } catch (error) {
    console.error("Unified sync error:", error);
    const message = error instanceof Error ? error.message : "Failed to sync";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
