import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";
import { snapTradeClient, snapTradeConfigured } from "@/lib/snaptrade";

/**
 * Generates a SnapTrade Connection Portal URL for the current user.
 *
 * Flow:
 *   1. If the user has never used SnapTrade before, register them and
 *      persist the returned userSecret (encrypted).
 *   2. Generate a one-time `redirectURI` via SnapTrade's login endpoint
 *      that opens the Connection Portal in a popup.
 *
 * The client opens the returned URL in a new window. After the user
 * finishes linking, they should hit `POST /api/snaptrade/sync` to ingest
 * the new connections and their accounts.
 */
export async function POST() {
  try {
    if (!snapTradeConfigured()) {
      return NextResponse.json(
        {
          error:
            "SnapTrade is not configured. Set SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY in .env.",
        },
        { status: 503 }
      );
    }
    const user = await requireUser();

    // Find or create the SnapTrade registration for this user. We use a
    // single SnapTradeItem row per user to hold their userSecret; the
    // authorizationId stays null until they complete a connection.
    let item = await db.snapTradeItem.findFirst({
      where: { userId: user.id },
    });

    let userSecret: string;
    if (!item) {
      const reg = await snapTradeClient.authentication.registerSnapTradeUser({
        userId: user.id,
      });
      if (!reg.data.userSecret) {
        return NextResponse.json(
          { error: "SnapTrade did not return a userSecret" },
          { status: 500 }
        );
      }
      userSecret = reg.data.userSecret;
      item = await db.snapTradeItem.create({
        data: {
          snapTradeUserId: user.id,
          userSecretEncrypted: encrypt(userSecret),
          userId: user.id,
        },
      });
    } else {
      userSecret = decrypt(item.userSecretEncrypted);
    }

    const loginRes = await snapTradeClient.authentication.loginSnapTradeUser({
      userId: user.id,
      userSecret,
    });

    // SnapTrade returns either { redirectURI } or { encryptedMessageToken }
    // depending on connection-type. The simple flow returns redirectURI.
    const redirectURI =
      (loginRes.data as { redirectURI?: string }).redirectURI ?? null;

    if (!redirectURI) {
      return NextResponse.json(
        { error: "SnapTrade did not return a redirect URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ redirectURI });
  } catch (error) {
    console.error("SnapTrade login-link error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to start SnapTrade flow";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
