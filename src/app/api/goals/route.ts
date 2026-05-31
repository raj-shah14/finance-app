import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeGoalAchieved, periodStart } from "@/lib/goal-progress";

export async function GET() {
  try {
    const user = await requireUser();
    if (!user.householdId) {
      return NextResponse.json({ goals: [] });
    }

    const goals = await db.goal.findMany({
      where: { householdId: user.householdId },
      include: {
        linkedAccount: {
          select: {
            id: true,
            name: true,
            type: true,
            subtype: true,
            mask: true,
            currentBalance: true,
            plaidItem: { select: { institutionName: true } },
          },
        },
        snapshots: {
          orderBy: { periodStart: "desc" },
          take: 12,
          select: {
            periodStart: true,
            periodEnd: true,
            achievedAmount: true,
            targetAmount: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    const goalsWithProgress = await Promise.all(
      goals.map(async (g) => {
        const isRecurring = g.cadence && g.cadence !== "one_time";
        const from = isRecurring ? periodStart(g.cadence) : null;
        const current = await computeGoalAchieved(
          {
            householdId: g.householdId,
            kind: g.kind,
            cadence: g.cadence,
            targetAmount: g.targetAmount,
            currentAmount: g.currentAmount,
            merchantPatterns: g.merchantPatterns,
            linkedAccountId: g.linkedAccountId,
            linkedAccount: g.linkedAccount,
          },
          { from, to: null }
        );
        const percentage =
          g.targetAmount > 0
            ? Math.min(100, Math.round((current / g.targetAmount) * 100))
            : 0;
        // Reverse the snapshots so they read oldest → newest for charting.
        const trend = [...g.snapshots].reverse();
        return { ...g, currentAmount: current, percentage, trend };
      })
    );

    return NextResponse.json({ goals: goalsWithProgress });
  } catch (error) {
    console.error("Error fetching goals:", error);
    return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user.householdId) {
      return NextResponse.json({ error: "No household" }, { status: 400 });
    }

    const body = await req.json();
    const {
      name,
      kind = "savings",
      cadence = "one_time",
      targetAmount,
      currentAmount,
      linkedAccountId,
      merchantPatterns,
      color,
      sortOrder,
    } = body;

    if (!name || typeof targetAmount !== "number" || targetAmount <= 0) {
      return NextResponse.json(
        { error: "Name and a positive targetAmount are required" },
        { status: 400 }
      );
    }
    if (kind !== "savings" && kind !== "payoff" && kind !== "custom") {
      return NextResponse.json(
        { error: "kind must be 'savings', 'payoff', or 'custom'" },
        { status: 400 }
      );
    }
    const ALLOWED_CADENCES = ["one_time", "monthly", "quarterly", "yearly"];
    if (!ALLOWED_CADENCES.includes(cadence)) {
      return NextResponse.json(
        { error: `cadence must be one of: ${ALLOWED_CADENCES.join(", ")}` },
        { status: 400 }
      );
    }

    const goal = await db.goal.create({
      data: {
        householdId: user.householdId,
        userId: null,
        name,
        kind,
        cadence,
        targetAmount,
        currentAmount: typeof currentAmount === "number" ? currentAmount : null,
        linkedAccountId: linkedAccountId || null,
        merchantPatterns: Array.isArray(merchantPatterns)
          ? merchantPatterns.map((p: unknown) => String(p).trim()).filter(Boolean)
          : [],
        color: color || null,
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      },
    });

    return NextResponse.json(goal);
  } catch (error) {
    console.error("Error creating goal:", error);
    const message = error instanceof Error ? error.message : "Failed to create goal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
