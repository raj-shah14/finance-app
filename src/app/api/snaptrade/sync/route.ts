import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { encryptForUser } from "@/lib/crypto-envelope";
import { snapTradeClient, snapTradeConfigured } from "@/lib/snaptrade";

/**
 * Pulls the user's current SnapTrade connections + accounts and upserts
 * them into our `SnapTradeItem` + `Account` tables.
 *
 * Account-balance-only sync (no holdings, no trade history yet) — matches
 * how we use Plaid investment accounts. Each SnapTrade account becomes
 * one row in `Account` with `provider = "snaptrade"`, `type = "investment"`.
 */
export async function POST() {
  try {
    if (!snapTradeConfigured()) {
      return NextResponse.json(
        { error: "SnapTrade is not configured." },
        { status: 503 }
      );
    }
    const user = await requireUser();
    if (!user.householdId) {
      return NextResponse.json({ error: "No household" }, { status: 400 });
    }

    const baseItem = await db.snapTradeItem.findFirst({
      where: { userId: user.id },
    });
    if (!baseItem) {
      return NextResponse.json(
        { error: "User is not registered with SnapTrade. Click Connect first." },
        { status: 404 }
      );
    }
    const userSecret = decrypt(baseItem.userSecretEncrypted);

    // 1. Fetch all brokerage authorizations (= connections) for the user.
    const authsRes = await snapTradeClient.connections.listBrokerageAuthorizations(
      { userId: user.id, userSecret }
    );
    const authorizations = authsRes.data ?? [];

    // 2. For each authorization, ensure a SnapTradeItem row exists.
    for (const auth of authorizations) {
      if (!auth.id) continue;
      const existing = await db.snapTradeItem.findUnique({
        where: { authorizationId: auth.id },
      });
      if (!existing) {
        // Reuse baseItem if it has no authorizationId yet (first connection
        // for this user), otherwise create a new SnapTradeItem for the
        // additional brokerage connection.
        if (!baseItem.authorizationId) {
          await db.snapTradeItem.update({
            where: { id: baseItem.id },
            data: {
              authorizationId: auth.id,
              brokerageName: auth.brokerage?.name ?? null,
              brokerageSlug: auth.brokerage?.slug ?? null,
            },
          });
        } else {
          await db.snapTradeItem.create({
            data: {
              snapTradeUserId: user.id,
              userSecretEncrypted: baseItem.userSecretEncrypted,
              authorizationId: auth.id,
              brokerageName: auth.brokerage?.name ?? null,
              brokerageSlug: auth.brokerage?.slug ?? null,
              userId: user.id,
            },
          });
        }
      }
    }

    // 3. Pull accounts and upsert into Account table.
    const accountsRes = await snapTradeClient.accountInformation.listUserAccounts(
      { userId: user.id, userSecret }
    );
    const accounts = accountsRes.data ?? [];

    let upserted = 0;
    for (const acct of accounts) {
      if (!acct.id) continue;

      // Find the matching SnapTradeItem by authorization ID.
      const authId =
        (acct as { brokerage_authorization?: string }).brokerage_authorization ??
        null;
      const item = authId
        ? await db.snapTradeItem.findUnique({
            where: { authorizationId: authId },
          })
        : baseItem;
      if (!item) continue;

      const balance =
        (acct as { balance?: { total?: { amount?: number } } }).balance?.total
          ?.amount ?? null;
      const currency =
        (acct as { balance?: { total?: { currency?: string } } }).balance?.total
          ?.currency ?? "USD";

      const subtype =
        ((acct as { meta?: { type?: string } }).meta?.type ?? "brokerage")
          .toLowerCase();

      // SnapTrade account.id is a UUID — reuse `plaidAccountId` column as
      // the unique external ID since Account.plaidAccountId is @unique
      // across both providers. Prefix with "st_" to avoid collisions.
      const externalId = `st_${acct.id}`;

      const nameRaw = acct.name ?? item.brokerageName ?? "Brokerage";
      const encName = (await encryptForUser(user.id, nameRaw)) ?? nameRaw;
      const encOfficial = item.brokerageName
        ? await encryptForUser(user.id, item.brokerageName)
        : null;
      const maskRaw = (acct as { number?: string }).number?.slice(-4) ?? null;
      const encMask = maskRaw ? await encryptForUser(user.id, maskRaw) : null;

      await db.account.upsert({
        where: { plaidAccountId: externalId },
        update: {
          name: encName,
          currentBalance: balance,
          isoCurrencyCode: currency,
          subtype,
        },
        create: {
          plaidAccountId: externalId,
          provider: "snaptrade",
          name: encName,
          officialName: encOfficial,
          type: "investment",
          subtype,
          mask: encMask,
          currentBalance: balance,
          availableBalance: balance,
          isoCurrencyCode: currency,
          snapTradeItemId: item.id,
          userId: user.id,
          householdId: user.householdId,
        },
      });
      upserted += 1;
    }

    await db.snapTradeItem.updateMany({
      where: { userId: user.id },
      data: { lastSyncedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      connections: authorizations.length,
      accounts: upserted,
    });
  } catch (error) {
    console.error("SnapTrade sync error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to sync SnapTrade";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
