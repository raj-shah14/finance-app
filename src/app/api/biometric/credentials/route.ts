import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * List the current user's registered biometric credentials. Used by
 * the Settings UI to render an "Enrolled devices" list with delete
 * buttons.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const credentials = await db.biometricCredential.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        deviceLabel: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });
    return NextResponse.json({ credentials });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

/**
 * Delete a specific credential by row id. If the last credential is
 * removed AND no PIN is set, App Lock is automatically disabled to
 * avoid locking the user out.
 *
 * Body: { id: string }
 */
export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const cred = await db.biometricCredential.findFirst({
      where: { id, userId: user.id },
    });
    if (!cred) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await db.biometricCredential.delete({ where: { id } });

    const remaining = await db.biometricCredential.count({
      where: { userId: user.id },
    });
    const fresh = await db.user.findUnique({
      where: { id: user.id },
      select: { pinHash: true },
    });
    if (remaining === 0 && !fresh?.pinHash) {
      await db.user.update({
        where: { id: user.id },
        data: { appLockEnabled: false },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
