import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { plaidClient } from "@/lib/plaid";

/**
 * Disconnects a single Plaid Item and removes it (and its cascading
 * Account/Transaction/Snapshot rows) from our database.
 *
 * Deleting the PlaidItem row — rather than deleting its Account rows one
 * by one — matters: exchange-token's duplicate-institution guard checks
 * for an existing PlaidItem by institutionId, so an orphaned PlaidItem
 * left behind after only removing its accounts permanently blocks
 * re-linking that same institution with a fresh Item, even though the
 * accounts it "owned" are long gone from the UI.
 *
 * Body: { plaidItemId: string }
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { plaidItemId } = await req.json();
    if (!plaidItemId) {
      return NextResponse.json({ error: "plaidItemId is required" }, { status: 400 });
    }

    const item = await db.plaidItem.findFirst({
      where: { id: plaidItemId, userId: user.id },
    });
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    try {
      await plaidClient.itemRemove({
        access_token: decrypt(item.accessTokenEncrypted),
      });
    } catch (err) {
      // Log but don't fail — we still want to remove our local copy even
      // if Plaid's side is already broken/expired.
      console.warn("Plaid itemRemove failed:", err);
    }

    // Cascades to Account (onDelete: Cascade), and from there to
    // Transaction/AccountSnapshot (their own onDelete: Cascade from
    // Account). A Bill tracked from one of those transactions keeps its
    // own copy of name/amount/category, so it survives with a dangling
    // sourceTransactionId rather than being deleted.
    await db.plaidItem.delete({ where: { id: item.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Plaid disconnect error:", error);
    const message = error instanceof Error ? error.message : "Failed to disconnect";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
