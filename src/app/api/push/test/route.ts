import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sendPushToUser, pushConfigured } from "@/lib/push";

/**
 * Send a test push to the current user — useful from the Settings
 * page to verify the full subscribe → send → display loop after
 * permission is granted.
 */
export async function POST() {
  try {
    if (!pushConfigured()) {
      return NextResponse.json(
        { error: "VAPID keys are not configured on the server" },
        { status: 503 }
      );
    }
    const user = await requireUser();
    const result = await sendPushToUser(user.id, {
      title: "Test notification 👋",
      body: "If you see this, push is working end-to-end.",
      url: "/settings",
      tag: "test",
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Push test error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to send test push";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
