/**
 * One-shot backfill: create a Transaction for every existing
 * LoanExtraPayment that doesn't already have one.
 *
 * Usage:
 *   npx tsx scripts/backfill-extra-payment-txns.ts
 */
import { db } from "../src/lib/db";
import { encryptForUser } from "../src/lib/crypto-envelope";
import { decryptForUser } from "../src/lib/crypto-envelope";

async function main() {
  const payments = await db.loanExtraPayment.findMany({
    include: {
      account: {
        include: { user: { select: { householdId: true } } },
      },
    },
  });

  const housingCat = await db.category.findFirst({
    where: { name: "Housing" },
    select: { id: true },
  });

  let created = 0;
  let skipped = 0;

  for (const p of payments) {
    // Skip if a matching transaction already exists
    const existing = await db.transaction.findFirst({
      where: {
        accountId: p.accountId,
        amount: p.amount,
        date: p.date,
        plaidTransactionId: null,
      },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    const userId = p.account.userId;
    const householdId = p.account.user.householdId;
    if (!householdId) {
      console.log(`  Skipping payment ${p.id} — account owner has no household`);
      skipped += 1;
      continue;
    }

    const accountName = p.account.name
      ? await decryptForUser(userId, p.account.name)
      : "Loan";
    const txnName = `Extra principal payment – ${accountName}`;

    await db.transaction.create({
      data: {
        accountId: p.accountId,
        userId,
        householdId,
        categoryId: housingCat?.id ?? null,
        amount: p.amount,
        date: p.date,
        name: (await encryptForUser(userId, txnName)) ?? txnName,
        merchantName: null,
        notes: p.notes ? await encryptForUser(userId, p.notes) : null,
        pending: false,
      },
    });
    console.log(`  Created txn for payment ${p.id} ($${p.amount} on ${p.date.toISOString().slice(0, 10)})`);
    created += 1;
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped (already existed or no household)`);
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
