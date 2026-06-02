import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 5;

/**
 * Verify an App Lock PIN attempt. Rate-limited at 5 wrong attempts →
 * 5-minute lockout. On the 5th failure the route returns 423 (Locked)
 * with `lockedUntil` so the client UI can also nudge the user to
 * Sign Out / re-auth via Clerk.
 *
 * Body: { pin: string }
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { pin } = await req.json();
    if (typeof pin !== "string") {
      return NextResponse.json({ error: "PIN is required" }, { status: 400 });
    }

    const fresh = await db.user.findUnique({
      where: { id: user.id },
      select: {
        pinHash: true,
        pinFailedAttempts: true,
        pinLockedUntil: true,
      },
    });
    if (!fresh?.pinHash) {
      return NextResponse.json({ error: "No PIN set" }, { status: 404 });
    }

    if (fresh.pinLockedUntil && fresh.pinLockedUntil > new Date()) {
      return NextResponse.json(
        {
          error: "Too many attempts. Try again later or sign out.",
          lockedUntil: fresh.pinLockedUntil.toISOString(),
        },
        { status: 423 }
      );
    }

    const ok = await bcrypt.compare(pin, fresh.pinHash);
    if (!ok) {
      const attempts = fresh.pinFailedAttempts + 1;
      const locked = attempts >= MAX_ATTEMPTS;
      await db.user.update({
        where: { id: user.id },
        data: {
          pinFailedAttempts: attempts,
          pinLockedUntil: locked
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
            : null,
        },
      });
      return NextResponse.json(
        {
          error: locked
            ? `Locked for ${LOCKOUT_MINUTES} minutes after ${MAX_ATTEMPTS} failed attempts. Sign out to use a different account.`
            : `Incorrect PIN. ${MAX_ATTEMPTS - attempts} attempts left.`,
          attemptsLeft: Math.max(0, MAX_ATTEMPTS - attempts),
          locked,
        },
        { status: locked ? 423 : 401 }
      );
    }

    // Success — reset counters.
    await db.user.update({
      where: { id: user.id },
      data: { pinFailedAttempts: 0, pinLockedUntil: null },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PIN verify error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
