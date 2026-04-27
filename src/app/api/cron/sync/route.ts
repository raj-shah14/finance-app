import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { plaidClient } from "@/lib/plaid";

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

    return NextResponse.json({
      success: true,
      itemsSynced: plaidItems.length,
      transactionsProcessed: totalSynced,
    });
  } catch (error) {
    console.error("Cron sync error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
