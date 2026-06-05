import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { plaidClient } from "@/lib/plaid";
import { snapTradeClient, snapTradeConfigured } from "@/lib/snaptrade";

// Vercel Cron or external cron hits this endpoint every 6 hours
// Protected by CRON_SECRET to prevent unauthorized access
export async function GET(req: Request) {
  if (process.env.USE_MOCK_DATA === "true") {
    return NextResponse.json({ success: true, message: "Mock mode — no sync needed" });
  }

  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const plaidItems = await db.plaidItem.findMany({
      include: { accounts: true, user: true },
    });

    let totalSynced = 0;

    for (const item of plaidItems) {
      try {
        const accessToken = decrypt(item.accessTokenEncrypted);
        let cursor = item.cursor;
        let hasMore = true;

        const mappings = await db.categoryMapping.findMany();
        const categoryMap = Object.fromEntries(
          mappings.map((m) => [m.plaidDetailed, m.categoryId])
        );

        const merchantRules = await db.merchantCategoryRule.findMany({
          where: { householdId: item.user.householdId! },
        });
        const merchantRuleMap = Object.fromEntries(
          merchantRules.map((r) => [r.merchantName, r.categoryId])
        );

        while (hasMore) {
          const response = await plaidClient.transactionsSync({
            access_token: accessToken,
            cursor: cursor || undefined,
          });

          const { added, modified, removed, has_more, next_cursor } = response.data;

          for (const txn of added) {
            const accountRecord = item.accounts.find(
              (a) => a.plaidAccountId === txn.account_id
            );
            if (!accountRecord) continue;

            const plaidCategory = txn.personal_finance_category?.detailed || "";
            const merchantKey = (txn.merchant_name || txn.name).toLowerCase();
            const categoryId = merchantRuleMap[merchantKey] || categoryMap[plaidCategory] || null;

            await db.transaction.upsert({
              where: { plaidTransactionId: txn.transaction_id },
              update: {
                amount: txn.amount,
                date: new Date(txn.date),
                name: txn.name,
                merchantName: txn.merchant_name || null,
                pending: txn.pending,
                plaidCategory,
                categoryId,
              },
              create: {
                plaidTransactionId: txn.transaction_id,
                accountId: accountRecord.id,
                userId: item.userId,
                householdId: item.user.householdId!,
                amount: txn.amount,
                date: new Date(txn.date),
                name: txn.name,
                merchantName: txn.merchant_name || null,
                pending: txn.pending,
                plaidCategory,
                categoryId,
              },
            });
          }

          for (const txn of modified) {
            const plaidCategory = txn.personal_finance_category?.detailed || "";
            const merchantKey = (txn.merchant_name || txn.name).toLowerCase();
            const categoryId = merchantRuleMap[merchantKey] || categoryMap[plaidCategory] || null;
            await db.transaction.updateMany({
              where: { plaidTransactionId: txn.transaction_id },
              data: {
                amount: txn.amount,
                date: new Date(txn.date),
                name: txn.name,
                merchantName: txn.merchant_name || null,
                pending: txn.pending,
                plaidCategory,
                categoryId,
              },
            });
          }

          for (const txn of removed) {
            if (txn.transaction_id) {
              await db.transaction.deleteMany({
                where: { plaidTransactionId: txn.transaction_id },
              });
            }
          }

          totalSynced += added.length + modified.length;
          cursor = next_cursor;
          hasMore = has_more;
        }

        await db.plaidItem.update({
          where: { id: item.id },
          data: { cursor, lastSyncedAt: new Date() },
        });

        // Update balances
        const balancesResponse = await plaidClient.accountsGet({ access_token: accessToken });
        for (const acct of balancesResponse.data.accounts) {
          await db.account.updateMany({
            where: { plaidAccountId: acct.account_id },
            data: {
              currentBalance: acct.balances.current,
              availableBalance: acct.balances.available,
            },
          });
        }
      } catch (err) {
        console.error(`Error syncing item ${item.id}:`, err);
      }
    }

    // ---- SnapTrade: refresh balances for every connected brokerage. ----
    // Balances-only — no holdings/trade history yet (matches how Plaid
    // investment accounts are synced).
    const snapTradeStats = { items: 0, accounts: 0, errors: 0 };
    if (snapTradeConfigured()) {
      const stItems = await db.snapTradeItem.findMany();
      for (const item of stItems) {
        try {
          const accountsRes =
            await snapTradeClient.accountInformation.listUserAccounts({
              userId: item.snapTradeUserId,
              userSecret: decrypt(item.userSecretEncrypted),
            });
          for (const acct of accountsRes.data ?? []) {
            if (!acct.id) continue;
            const balance =
              (acct as { balance?: { total?: { amount?: number } } }).balance
                ?.total?.amount ?? null;
            await db.account.updateMany({
              where: { plaidAccountId: `st_${acct.id}` },
              data: { currentBalance: balance, availableBalance: balance },
            });
            snapTradeStats.accounts += 1;
          }
          await db.snapTradeItem.update({
            where: { id: item.id },
            data: { lastSyncedAt: new Date() },
          });
          snapTradeStats.items += 1;
        } catch (err) {
          console.error(`Cron SnapTrade refresh failed for ${item.id}:`, err);
          snapTradeStats.errors += 1;
        }
      }
    }

    // Refresh every household's manual-loan balances now that new
    // transactions have landed. Cheap (one aggregate per loan) and
    // ensures /accounts always shows an up-to-date amortized balance.
    const { refreshManualLoanBalance } = await import("@/lib/manual-loan");
    const manualLoans = await db.account.findMany({
      where: { type: "loan", provider: "manual" },
      select: { id: true },
    });
    let manualLoansRefreshed = 0;
    for (const loan of manualLoans) {
      try {
        await refreshManualLoanBalance(loan.id);
        manualLoansRefreshed += 1;
      } catch (err) {
        console.error("Manual loan refresh failed:", loan.id, err);
      }
    }

    // Snapshot every recurring goal's previous period (if not already
    // snapshotted). Idempotent via @@unique([goalId, periodStart]).
    const { computeGoalAchieved, previousPeriodRange } = await import(
      "@/lib/goal-progress"
    );
    const recurringGoals = await db.goal.findMany({
      where: { cadence: { in: ["monthly", "quarterly", "yearly"] } },
      include: {
        linkedAccount: {
          select: { id: true, type: true, currentBalance: true },
        },
      },
    });
    let snapshotsWritten = 0;
    for (const g of recurringGoals) {
      const prev = previousPeriodRange(g.cadence);
      if (!prev) continue;
      const existing = await db.goalSnapshot.findUnique({
        where: { goalId_periodStart: { goalId: g.id, periodStart: prev.start } },
      });
      if (existing) continue;
      try {
        const achieved = await computeGoalAchieved(
          {
            householdId: g.householdId,
            userId: g.userId,
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

    return NextResponse.json({
      success: true,
      itemsSynced: plaidItems.length,
      transactionsProcessed: totalSynced,
      snapTrade: snapTradeStats,
      manualLoansRefreshed,
      goalSnapshotsWritten: snapshotsWritten,
    });
  } catch (error) {
    console.error("Cron sync error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
