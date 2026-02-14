import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { plaidClient } from "@/lib/plaid";

// Plaid sends webhooks when transactions are updated
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { webhook_type, webhook_code, item_id } = body;

    if (webhook_type === "TRANSACTIONS") {
      if (webhook_code === "SYNC_UPDATES_AVAILABLE") {
        // Find the PlaidItem and trigger a sync
        const plaidItem = await db.plaidItem.findUnique({
          where: { plaidItemId: item_id },
          include: { accounts: true, user: true },
        });

        if (!plaidItem) {
          return NextResponse.json({ error: "Item not found" }, { status: 404 });
        }

        const accessToken = decrypt(plaidItem.accessTokenEncrypted);
        let cursor = plaidItem.cursor;
        let hasMore = true;

        const mappings = await db.categoryMapping.findMany();
        const categoryMap = Object.fromEntries(
          mappings.map((m) => [m.plaidDetailed, m.categoryId])
        );

        while (hasMore) {
          const response = await plaidClient.transactionsSync({
            access_token: accessToken,
            cursor: cursor || undefined,
          });

          const { added, modified, removed, has_more, next_cursor } = response.data;

          for (const txn of added) {
            const accountRecord = plaidItem.accounts.find(
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
                userId: plaidItem.userId,
                householdId: plaidItem.user.householdId!,
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

          for (const txn of removed) {
            if (txn.transaction_id) {
              await db.transaction.deleteMany({
                where: { plaidTransactionId: txn.transaction_id },
              });
            }
          }

          cursor = next_cursor;
          hasMore = has_more;
        }

        await db.plaidItem.update({
          where: { id: plaidItem.id },
          data: { cursor, lastSyncedAt: new Date() },
        });
      }

      if (webhook_code === "ITEM_ERROR") {
        console.error(`Plaid item error for item_id: ${item_id}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
