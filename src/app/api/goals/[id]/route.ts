import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { encryptForUser } from "@/lib/crypto-envelope";
import { decryptGoal } from "@/lib/entity-crypto";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    if (!user.householdId) {
      return NextResponse.json({ error: "No household" }, { status: 400 });
    }
    const { id } = await params;

    const existing = await db.goal.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const allowed: Record<string, unknown> = {};
    for (const k of [
      "name",
      "kind",
      "cadence",
      "targetAmount",
      "currentAmount",
      "linkedAccountId",
      "merchantPatterns",
      "color",
      "sortOrder",
    ]) {
      if (k in body) allowed[k] = body[k];
    }
    if (typeof allowed.name === "string") {
      allowed.name = await encryptForUser(user.id, allowed.name);
    }
    // A goal must only ever link to an account this user owns — otherwise
    // a household member could point a goal at someone else's accountId
    // and have /api/goals decrypt and return that account's balance/name.
    if ("linkedAccountId" in allowed) {
      if (allowed.linkedAccountId) {
        const owned = await db.account.findFirst({
          where: { id: allowed.linkedAccountId as string, userId: user.id },
          select: { id: true },
        });
        if (!owned) {
          return NextResponse.json({ error: "Account not found" }, { status: 404 });
        }
      } else {
        allowed.linkedAccountId = null;
      }
    }

    const goal = await db.goal.update({
      where: { id },
      data: allowed,
    });
    return NextResponse.json(await decryptGoal(user.id, goal));
  } catch (error) {
    console.error("Error updating goal:", error);
    return NextResponse.json({ error: "Failed to update goal" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    if (!user.householdId) {
      return NextResponse.json({ error: "No household" }, { status: 400 });
    }
    const { id } = await params;

    const existing = await db.goal.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.goal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting goal:", error);
    return NextResponse.json({ error: "Failed to delete goal" }, { status: 500 });
  }
}
