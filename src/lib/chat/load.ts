import { db } from "@/lib/db";
import { decryptAccount, decryptTransaction } from "@/lib/entity-crypto";
import type { ChatAccount, ChatTxn } from "./queries";

const HISTORY_MONTHS = 24;

/** The signed-in user's OWN transactions only — never other household members'. */
export async function loadUserTransactions(userId: string): Promise<ChatTxn[]> {
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - HISTORY_MONTHS);
  const rows = await db.transaction.findMany({
    where: { userId, date: { gte: since } },
    include: {
      category: { select: { name: true } },
      account: { select: { name: true, mask: true, type: true } },
    },
    orderBy: { date: "desc" },
  });
  return Promise.all(
    rows.map(async (r) => {
      const tx = await decryptTransaction(userId, r);
      const acct = await decryptAccount(userId, r.account);
      return {
        date: r.date.toISOString().slice(0, 10),
        amount: r.amount,
        name: String(tx.name ?? ""),
        merchant: (tx.merchantName as string | null) ?? null,
        categoryName: r.category?.name ?? null,
        plaidCategory: r.plaidCategory,
        accountType: acct.type,
        accountName: String(acct.name ?? ""),
        accountMask: (acct.mask as string | null) ?? null,
        pending: r.pending,
      };
    })
  );
}

export async function loadUserAccounts(userId: string): Promise<ChatAccount[]> {
  const rows = await db.account.findMany({ where: { userId } });
  const out = await Promise.all(rows.map((r) => decryptAccount(userId, r)));
  return out.map((a) => ({
    name: String(a.name ?? ""),
    mask: (a.mask as string | null) ?? null,
    type: a.type,
    subtype: a.subtype ?? null,
    balance: a.currentBalance ?? null,
  }));
}
