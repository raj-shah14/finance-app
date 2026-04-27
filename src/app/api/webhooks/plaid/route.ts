import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { plaidClient } from "@/lib/plaid";

import crypto from "crypto";

async function verifyPlaidWebhook(req: Request, body: string): Promise<boolean> {
  try {
    const signedJwt = req.headers.get("plaid-verification");
    if (!signedJwt) return false;

    const response = await plaidClient.webhookVerificationKeyGet({
      key_id: JSON.parse(
        Buffer.from(signedJwt.split(".")[0], "base64url").toString()
      ).kid,
    });

    const key = crypto.createPublicKey({
      key: response.data.key as any,
      format: "jwk",
    });

    const [headerB64, payloadB64, signatureB64] = signedJwt.split(".");
    const data = `${headerB64}.${payloadB64}`;
    const signature = Buffer.from(signatureB64, "base64url");
    const verified = crypto.createVerify("SHA256").update(data).verify(key, signature);
    if (!verified) return false;

    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    const bodyHash = crypto.createHash("sha256").update(body).digest("hex");
    if (payload.request_body_sha256 !== bodyHash) return false;

    // Check token is not expired (5 min tolerance)
    const now = Math.floor(Date.now() / 1000);
    if (payload.iat && now - payload.iat > 300) return false;

    return true;
  } catch (error) {
    console.error("Webhook verification failed:", error);
    return false;
  }
}

// Plaid sends webhooks when transactions are updated
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    const isVerified = await verifyPlaidWebhook(req, rawBody);
    if (!isVerified) {
      console.error("Plaid webhook verification failed");
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
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

        const merchantRules = await db.merchantCategoryRule.findMany({
          where: { householdId: plaidItem.user.householdId! },
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
            const accountRecord = plaidItem.accounts.find(
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
