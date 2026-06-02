import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Remove a push subscription. Called from the client when the user
 * toggles notifications off (which also calls subscription.unsubscribe()
 * in the browser to revoke the endpoint).
 *
 * Body: { endpoint: string }
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { endpoint } = await req.json();
    if (!endpoint || typeof endpoint !== "string") {
      return NextResponse.json({ error: "endpoint is required" }, { status: 400 });
    }

    await db.pushSubscription.deleteMany({
      where: { endpoint, userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Push unsubscribe error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to unsubscribe";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
