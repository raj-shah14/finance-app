import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Compute a goal's "current amount" (= progress towards target).
 *
 * Priority:
 *   1. **Linked loan/credit account on a payoff goal** — principal paid down
 *      so far = max(0, targetAmount - account.currentBalance). This is the
 *      correct measure for mortgages / auto loans: 100% of the ring is the
 *      original loan, the filled arc is what's been paid off. We prefer this
 *      over merchant patterns because pattern sums include interest, escrow,
 *      and fees, not just principal reduction.
 *   2. **Linked depository/investment account** — account.currentBalance is
 *      the amount saved toward a savings goal.
 *   3. **`merchantPatterns`** — sum of |amount| of all household transactions
 *      whose merchantName or name matches any pattern (case-insensitive
 *      substring). Used when no linked account exists.
 *   4. **Stored `currentAmount`** — manual value the user entered.
 */
async function computeCurrent(
  goal: {
    householdId: string;
    kind: string;
    targetAmount: number;
    currentAmount: number | null;
    merchantPatterns: string[];
    linkedAccount: { type: string; currentBalance: number | null } | null;
  }
): Promise<number> {
  if (goal.linkedAccount) {
    const balance = goal.linkedAccount.currentBalance ?? 0;
    const isLiability =
      goal.linkedAccount.type === "loan" || goal.linkedAccount.type === "credit";
    if (goal.kind === "payoff" && isLiability) {
      return Math.max(0, goal.targetAmount - balance);
    }
    if (!isLiability) {
      return Math.max(0, balance);
    }
    // Fall through to patterns/stored for unusual combos (e.g. payoff goal
    // mistakenly linked to a depository account).
  }

  if (goal.merchantPatterns && goal.merchantPatterns.length > 0) {
    const orConditions = goal.merchantPatterns.flatMap((p) => [
      { merchantName: { contains: p, mode: "insensitive" as const } },
      { name: { contains: p, mode: "insensitive" as const } },
    ]);
    const result = await db.transaction.aggregate({
      where: {
        householdId: goal.householdId,
        OR: orConditions,
      },
      _sum: { amount: true },
    });
    return Math.abs(result._sum.amount ?? 0);
  }

  return goal.currentAmount ?? 0;
}

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
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    const goalsWithProgress = await Promise.all(
      goals.map(async (g) => {
        const current = await computeCurrent(g);
        const percentage =
          g.targetAmount > 0
            ? Math.min(100, Math.round((current / g.targetAmount) * 100))
            : 0;
        return { ...g, currentAmount: current, percentage };
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

    const goal = await db.goal.create({
      data: {
        householdId: user.householdId,
        userId: null, // household-level goal by default
        name,
        kind,
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
