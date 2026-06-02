import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Persist a Web Push subscription registered by the installed PWA.
 *
 * Body: a serialized PushSubscription { endpoint, keys: { p256dh, auth } }
 * plus optional userAgent (helps identify which device the row is for
 * when the user wants to revoke from a specific device later).
 *
 * Endpoint is unique — re-subscribing from the same browser upserts
 * (refreshes keys + userAgent + updatedAt).
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { endpoint, keys, userAgent } = body ?? {};

    if (
      !endpoint ||
      typeof endpoint !== "string" ||
      !keys ||
      typeof keys.p256dh !== "string" ||
      typeof keys.auth !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid push subscription payload" },
        { status: 400 }
      );
    }

    const sub = await db.pushSubscription.upsert({
      where: { endpoint },
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: typeof userAgent === "string" ? userAgent : null,
        userId: user.id,
      },
      create: {
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: typeof userAgent === "string" ? userAgent : null,
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true, id: sub.id });
  } catch (error) {
    console.error("Push subscribe error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to subscribe";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
