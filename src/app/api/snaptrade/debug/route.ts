import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { snapTradeClient, snapTradeConfigured } from "@/lib/snaptrade";

/**
 * Diagnostic endpoint: returns the raw state of the SnapTrade integration
 * for the current user.
 *
 * - DB state: SnapTradeItem rows, Account rows with provider=snaptrade
 * - SnapTrade state: brokerage authorizations + accounts as returned by
 *   their API
 *
 * Useful when accounts don't appear after linking. Hit this in a browser
 * while signed in to see which side has the data.
 */
export async function GET() {
  try {
    if (!snapTradeConfigured()) {
      return NextResponse.json(
        { error: "SnapTrade is not configured." },
        { status: 503 }
      );
    }
    const user = await requireUser();

    const items = await db.snapTradeItem.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        snapTradeUserId: true,
        authorizationId: true,
        brokerageName: true,
        brokerageSlug: true,
        lastSyncedAt: true,
      },
    });

    const dbAccounts = await db.account.findMany({
      where: { userId: user.id, provider: "snaptrade" },
      select: {
        id: true,
        plaidAccountId: true,
        name: true,
        currentBalance: true,
        snapTradeItemId: true,
      },
    });

    const result: Record<string, unknown> = {
      userId: user.id,
      dbItems: items,
      dbAccounts,
    };

    const baseItem = await db.snapTradeItem.findFirst({
      where: { userId: user.id },
    });
    if (!baseItem) {
      result.snapTradeAuthorizations = null;
      result.snapTradeAccounts = null;
      result.note = "No SnapTradeItem row — connect flow never persisted.";
      return NextResponse.json(result);
    }

    const userSecret = decrypt(baseItem.userSecretEncrypted);
    try {
      const auths =
        await snapTradeClient.connections.listBrokerageAuthorizations({
          userId: user.id,
          userSecret,
        });
      result.snapTradeAuthorizations = auths.data;
    } catch (err) {
      result.snapTradeAuthorizationsError =
        (err as { responseBody?: unknown }).responseBody ?? String(err);
    }

    try {
      const accts =
        await snapTradeClient.accountInformation.listUserAccounts({
          userId: user.id,
          userSecret,
        });
      result.snapTradeAccounts = accts.data;
    } catch (err) {
      result.snapTradeAccountsError =
        (err as { responseBody?: unknown }).responseBody ?? String(err);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("SnapTrade debug error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
