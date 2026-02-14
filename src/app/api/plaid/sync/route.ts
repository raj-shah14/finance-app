import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { RemovedTransaction } from "plaid";

export async function POST() {
  try {
    if (process.env.USE_MOCK_DATA === "true") {
      return NextResponse.json({ success: true, added: 0, modified: 0, removed: 0 });
    }
    const user = await requireUser();
    if (!user.householdId) {
      return NextResponse.json({ error: "No household" }, { status: 400 });
    }

    const plaidItems = await db.plaidItem.findMany({
      where: { userId: user.id },
      include: { accounts: true },
    });

    let totalAdded = 0;
    let totalModified = 0;
    let totalRemoved = 0;

    for (const item of plaidItems) {
      const accessToken = decrypt(item.accessTokenEncrypted);
      let cursor = item.cursor;
      let hasMore = true;

      while (hasMore) {
        const response = await plaidClient.transactionsSync({
          access_token: accessToken,
          cursor: cursor || undefined,
        });

        const { added, modified, removed, has_more, next_cursor } = response.data;

        const mappings = await db.categoryMapping.findMany();
        const categoryMap = Object.fromEntries(
          mappings.map((m) => [m.plaidDetailed, m.categoryId])
        );

        for (const txn of added) {
          const accountRecord = item.accounts.find(
            (a) => a.plaidAccountId === txn.account_id
          );
          if (!accountRecord) continue;

          const plaidCategory = txn.personal_finance_category?.detailed || "";
          const categoryId = categoryMap[plaidCategory] || null;

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
              userId: user.id,
              householdId: user.householdId!,
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
          const categoryId = categoryMap[plaidCategory] || null;
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

        for (const txn of removed as RemovedTransaction[]) {
          if (txn.transaction_id) {
            await db.transaction.deleteMany({
              where: { plaidTransactionId: txn.transaction_id },
            });
          }
        }

        totalAdded += added.length;
        totalModified += modified.length;
        totalRemoved += removed.length;
        cursor = next_cursor;
        hasMore = has_more;
      }

      await db.plaidItem.update({
        where: { id: item.id },
        data: { cursor, lastSyncedAt: new Date() },
      });

      const balancesResponse = await plaidClient.accountsGet({
        access_token: decrypt(item.accessTokenEncrypted),
      });
      for (const acct of balancesResponse.data.accounts) {
        await db.account.updateMany({
          where: { plaidAccountId: acct.account_id },
          data: {
            currentBalance: acct.balances.current,
            availableBalance: acct.balances.available,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      added: totalAdded,
      modified: totalModified,
      removed: totalRemoved,
    });
  } catch (error) {
    console.error("Error syncing transactions:", error);
    return NextResponse.json({ error: "Failed to sync" }, { status: 500 });
  }
}
