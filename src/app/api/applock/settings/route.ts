import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Return the current user's App Lock state. Used by:
 *   - <AppLock /> overlay to decide whether to render
 *   - Settings UI to drive the toggle / re-enroll / change PIN buttons
 */
export async function GET() {
  try {
    const user = await requireUser();
    const fresh = await db.user.findUnique({
      where: { id: user.id },
      select: {
        appLockEnabled: true,
        appLockIdleMinutes: true,
        pinHash: true,
      },
    });
    const credCount = await db.biometricCredential.count({
      where: { userId: user.id },
    });
    return NextResponse.json({
      enabled: fresh?.appLockEnabled ?? false,
      idleMinutes: fresh?.appLockIdleMinutes ?? 15,
      hasPin: Boolean(fresh?.pinHash),
      credentialCount: credCount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

/**
 * Update appLockEnabled / appLockIdleMinutes. Refuses to enable lock
 * when no credentials AND no PIN are configured (would lock the user
 * out instantly).
 */
export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const data: { appLockEnabled?: boolean; appLockIdleMinutes?: number } = {};

    if (typeof body.enabled === "boolean") {
      if (body.enabled) {
        const fresh = await db.user.findUnique({
          where: { id: user.id },
          select: { pinHash: true },
        });
        const credCount = await db.biometricCredential.count({
          where: { userId: user.id },
        });
        if (!fresh?.pinHash && credCount === 0) {
          return NextResponse.json(
            {
              error:
                "Set a PIN or enroll Face ID first — otherwise you'd be locked out.",
            },
            { status: 400 }
          );
        }
      }
      data.appLockEnabled = body.enabled;
    }
    if (typeof body.idleMinutes === "number" && body.idleMinutes > 0) {
      data.appLockIdleMinutes = Math.min(body.idleMinutes, 24 * 60);
    }

    await db.user.update({ where: { id: user.id }, data });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
