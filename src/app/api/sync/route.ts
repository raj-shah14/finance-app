import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Unified sync endpoint — refreshes balances + transactions from every
 * connected provider (Plaid for banks, SnapTrade for brokerages) in
 * parallel. Used by all "Refresh" buttons in the UI.
 *
 * Each provider sync is best-effort: a failure in one does not block the
 * other. The response surfaces per-provider status so the caller can
 * report partial success.
 */
async function callInternal(req: Request, path: string) {
  const url = new URL(path, req.url);
  return fetch(url.toString(), {
    method: "POST",
    headers: {
      cookie: req.headers.get("cookie") || "",
      authorization: req.headers.get("authorization") || "",
    },
  });
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();

    // Only call each provider if the user actually has connections, to
    // avoid spurious "not configured" errors when, e.g., SnapTrade env
    // vars are missing for users who never linked a brokerage.
    const [plaidCount, snapTradeCount] = await Promise.all([
      db.plaidItem.count({ where: { userId: user.id } }),
      // Count any SnapTradeItem for the user, not just those with an
      // authorizationId — the SnapTrade sync route itself is what
      // back-fills the authorizationId after listBrokerageAuthorizations.
      // Skipping rows where authorizationId is null would prevent the
      // very first sync from ever running.
      db.snapTradeItem.count({ where: { userId: user.id } }),
    ]);

    const tasks: Array<Promise<{ provider: string; ok: boolean; data: unknown }>> =
      [];

    if (plaidCount > 0) {
      tasks.push(
        callInternal(req, "/api/plaid/sync")
          .then(async (r) => ({
            provider: "plaid",
            ok: r.ok,
            data: await r.json().catch(() => ({})),
          }))
          .catch((err) => ({
            provider: "plaid",
            ok: false,
            data: { error: String(err) },
          }))
      );
    }

    if (snapTradeCount > 0) {
      tasks.push(
        callInternal(req, "/api/snaptrade/sync")
          .then(async (r) => ({
            provider: "snaptrade",
            ok: r.ok,
            data: await r.json().catch(() => ({})),
          }))
          .catch((err) => ({
            provider: "snaptrade",
            ok: false,
            data: { error: String(err) },
          }))
      );
    }

    const results = await Promise.all(tasks);
    return NextResponse.json({
      success: results.every((r) => r.ok),
      results,
    });
  } catch (error) {
    console.error("Unified sync error:", error);
    const message = error instanceof Error ? error.message : "Failed to sync";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
