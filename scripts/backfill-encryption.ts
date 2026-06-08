/**
 * One-shot backfill: encrypt all sensitive fields for all existing users.
 *
 * Idempotent — rows whose target field already starts with `enc:v1:` are
 * skipped. Safe to re-run.
 *
 * Usage (after deploying the dual-read codebase to prod):
 *   AZURE_KEY_VAULT_URL=... AZURE_KEY_VAULT_KEY_NAME=... npx tsx scripts/backfill-encryption.ts
 *
 * For local dev with DEV_KEK_BASE64 instead of Key Vault, just set that env
 * var (do NOT set AZURE_KEY_VAULT_URL).
 */
import { db } from "../src/lib/db";
import { encryptForUser, isEncrypted, ensureUserDek } from "../src/lib/crypto-envelope";

const ACCOUNT_FIELDS = ["name", "officialName", "mask", "institutionName", "notes"] as const;
const TRANSACTION_FIELDS = ["name", "merchantName", "notes"] as const;
const GOAL_FIELDS = ["name", "description"] as const;

async function backfillUserAccounts(userId: string) {
  const rows = await db.account.findMany({ where: { userId } });
  let updated = 0;
  for (const r of rows) {
    const data: Record<string, string | null> = {};
    let changed = false;
    for (const f of ACCOUNT_FIELDS) {
      const v = (r as unknown as Record<string, string | null>)[f];
      if (typeof v === "string" && v.length > 0 && !isEncrypted(v)) {
        data[f] = await encryptForUser(userId, v);
        changed = true;
      }
    }
    if (changed) {
      await db.account.update({ where: { id: r.id }, data });
      updated += 1;
    }
  }
  return updated;
}

async function backfillUserTransactions(userId: string) {
  const rows = await db.transaction.findMany({
    where: { userId },
    select: { id: true, name: true, merchantName: true, notes: true },
  });
  let updated = 0;
  for (const r of rows) {
    const data: Record<string, string | null> = {};
    let changed = false;
    for (const f of TRANSACTION_FIELDS) {
      const v = (r as unknown as Record<string, string | null>)[f];
      if (typeof v === "string" && v.length > 0 && !isEncrypted(v)) {
        data[f] = await encryptForUser(userId, v);
        changed = true;
      }
    }
    if (changed) {
      await db.transaction.update({ where: { id: r.id }, data });
      updated += 1;
    }
  }
  return updated;
}

async function backfillUserGoals(userId: string) {
  const rows = await db.goal.findMany({ where: { userId } });
  let updated = 0;
  for (const r of rows) {
    const data: Record<string, string | null> = {};
    let changed = false;
    for (const f of GOAL_FIELDS) {
      const v = (r as unknown as Record<string, string | null>)[f];
      if (typeof v === "string" && v.length > 0 && !isEncrypted(v)) {
        data[f] = await encryptForUser(userId, v);
        changed = true;
      }
    }
    if (changed) {
      await db.goal.update({ where: { id: r.id }, data });
      updated += 1;
    }
  }
  return updated;
}

async function backfillUserPlaidInstitutionNames(userId: string) {
  const items = await db.plaidItem.findMany({ where: { userId } });
  let updated = 0;
  for (const it of items) {
    if (typeof it.institutionName === "string" && it.institutionName.length > 0 && !isEncrypted(it.institutionName)) {
      const enc = await encryptForUser(userId, it.institutionName);
      await db.plaidItem.update({ where: { id: it.id }, data: { institutionName: enc } });
      updated += 1;
    }
  }
  return updated;
}

async function main() {
  const users = await db.user.findMany({ select: { id: true, email: true } });
  console.log(`Backfilling encryption for ${users.length} user(s)...`);
  const stats = { users: 0, accounts: 0, transactions: 0, goals: 0, plaidItems: 0 };
  for (const u of users) {
    process.stdout.write(`  ${u.email}... `);
    await ensureUserDek(u.id);
    const a = await backfillUserAccounts(u.id);
    const t = await backfillUserTransactions(u.id);
    const g = await backfillUserGoals(u.id);
    const p = await backfillUserPlaidInstitutionNames(u.id);
    stats.users += 1;
    stats.accounts += a;
    stats.transactions += t;
    stats.goals += g;
    stats.plaidItems += p;
    console.log(`accounts=${a} txns=${t} goals=${g} plaidItems=${p}`);
  }
  console.log("\nDone:", stats);
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
