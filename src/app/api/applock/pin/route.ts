import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Set or change the App Lock PIN. Requires a 4–10 digit numeric PIN.
 * Stored as bcrypt hash. Setting a PIN also enables App Lock.
 *
 * Body: { newPin: string, currentPin?: string }
 *   - currentPin is required when changing an existing PIN.
 *   - When the user has no PIN yet, currentPin is ignored.
 */
function validPin(p: unknown): p is string {
  return typeof p === "string" && /^\d{4,10}$/.test(p);
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { newPin, currentPin } = await req.json();

    if (!validPin(newPin)) {
      return NextResponse.json(
        { error: "PIN must be 4–10 digits" },
        { status: 400 }
      );
    }

    const fresh = await db.user.findUnique({
      where: { id: user.id },
      select: { pinHash: true },
    });
    if (fresh?.pinHash) {
      if (!validPin(currentPin)) {
        return NextResponse.json(
          { error: "Current PIN is required to change PIN" },
          { status: 400 }
        );
      }
      const ok = await bcrypt.compare(currentPin, fresh.pinHash);
      if (!ok) {
        return NextResponse.json(
          { error: "Current PIN is incorrect" },
          { status: 401 }
        );
      }
    }

    const hash = await bcrypt.hash(newPin, 12);
    await db.user.update({
      where: { id: user.id },
      data: {
        pinHash: hash,
        appLockEnabled: true,
        pinFailedAttempts: 0,
        pinLockedUntil: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PIN set error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

/**
 * Remove the PIN. Disables App Lock if no biometric credentials remain.
 */
export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const { currentPin } = await req.json();
    const fresh = await db.user.findUnique({
      where: { id: user.id },
      select: { pinHash: true },
    });
    if (fresh?.pinHash) {
      if (!validPin(currentPin)) {
        return NextResponse.json(
          { error: "Current PIN is required" },
          { status: 400 }
        );
      }
      const ok = await bcrypt.compare(currentPin, fresh.pinHash);
      if (!ok) {
        return NextResponse.json(
          { error: "Current PIN is incorrect" },
          { status: 401 }
        );
      }
    }
    const credCount = await db.biometricCredential.count({
      where: { userId: user.id },
    });
    await db.user.update({
      where: { id: user.id },
      data: {
        pinHash: null,
        pinFailedAttempts: 0,
        pinLockedUntil: null,
        appLockEnabled: credCount > 0,
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
