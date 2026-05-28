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
      try {
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
      } catch (regErr) {
        // SnapTrade returns 400 when the userId already exists on their side
        // (e.g. our local row was deleted but the SnapTrade record persisted).
        // Auto-recover by deleting the orphaned SnapTrade user and registering
        // fresh.
        const status = (regErr as { status?: number }).status;
        const body =
          (regErr as { responseBody?: unknown }).responseBody ?? null;
        console.warn(
          "SnapTrade register failed, attempting recovery:",
          status,
          body
        );
        if (status === 400) {
          try {
            await snapTradeClient.authentication.deleteSnapTradeUser({
              userId: user.id,
            });
          } catch (delErr) {
            console.warn("SnapTrade delete-user during recovery failed:", delErr);
          }
          const reg2 = await snapTradeClient.authentication.registerSnapTradeUser(
            { userId: user.id }
          );
          if (!reg2.data.userSecret) {
            return NextResponse.json(
              { error: "SnapTrade did not return a userSecret after recovery" },
              { status: 500 }
            );
          }
          userSecret = reg2.data.userSecret;
        } else {
          throw regErr;
        }
      }
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
      // Where SnapTrade redirects the popup when the user clicks "Done".
      // Without this, the Done button can hang silently. We point at a
      // tiny callback page that just closes the popup; the parent window
      // already polls window.closed to trigger the sync.
      customRedirect:
        process.env.NEXT_PUBLIC_APP_URL
          ? `${process.env.NEXT_PUBLIC_APP_URL}/snaptrade-callback`
          : undefined,
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
    const body = (error as { responseBody?: unknown }).responseBody;
    const message =
      (typeof body === "object" && body !== null && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : null) ||
      (error instanceof Error ? error.message : "Failed to start SnapTrade flow");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
