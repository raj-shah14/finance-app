import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

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
    if (!existing || existing.householdId !== user.householdId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const allowed: Record<string, unknown> = {};
    for (const k of ["name", "kind", "targetAmount", "currentAmount", "linkedAccountId", "color", "sortOrder"]) {
      if (k in body) allowed[k] = body[k];
    }

    const goal = await db.goal.update({
      where: { id },
      data: allowed,
    });
    return NextResponse.json(goal);
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
    if (!existing || existing.householdId !== user.householdId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.goal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting goal:", error);
    return NextResponse.json({ error: "Failed to delete goal" }, { status: 500 });
  }
}
