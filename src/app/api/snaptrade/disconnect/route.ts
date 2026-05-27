import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { snapTradeClient, snapTradeConfigured } from "@/lib/snaptrade";

/**
 * Disconnects a single SnapTrade brokerage authorization and removes the
 * associated SnapTradeItem + cascading Account rows.
 *
 * Body: { snapTradeItemId: string }
 */
export async function POST(req: Request) {
  try {
    if (!snapTradeConfigured()) {
      return NextResponse.json(
        { error: "SnapTrade is not configured." },
        { status: 503 }
      );
    }
    const user = await requireUser();
    const { snapTradeItemId } = await req.json();
    if (!snapTradeItemId) {
      return NextResponse.json(
        { error: "snapTradeItemId is required" },
        { status: 400 }
      );
    }

    const item = await db.snapTradeItem.findFirst({
      where: { id: snapTradeItemId, userId: user.id },
    });
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (item.authorizationId) {
      try {
        await snapTradeClient.connections.removeBrokerageAuthorization({
          authorizationId: item.authorizationId,
          userId: user.id,
          userSecret: decrypt(item.userSecretEncrypted),
        });
      } catch (err) {
        // Log but don't fail — we still want to remove our local copy.
        console.warn("SnapTrade remove authorization failed:", err);
      }
    }

    await db.snapTradeItem.delete({ where: { id: item.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("SnapTrade disconnect error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to disconnect";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
