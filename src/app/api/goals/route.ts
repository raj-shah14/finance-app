import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Compute the start of the current period for a recurring goal.
 *   - "monthly": first day of the current month
 *   - "quarterly": first day of the current calendar quarter
 *   - "yearly": Jan 1 of the current year
 *   - "one_time" / other: returns null (no period gate)
 */
function periodStart(cadence: string, asOf: Date = new Date()): Date | null {
  const year = asOf.getFullYear();
  const month = asOf.getMonth();
  switch (cadence) {
    case "monthly":
      return new Date(year, month, 1);
    case "quarterly":
      return new Date(year, Math.floor(month / 3) * 3, 1);
    case "yearly":
      return new Date(year, 0, 1);
    default:
      return null;
  }
}

/**
 * Compute a goal's "current amount" (= progress towards target).
 *
 * For one-time (cumulative) goals: progress accumulates over the
 * lifetime of the goal — used for emergency funds, down payments,
 * total payoff progress, etc.
 *
 * For recurring goals (monthly / quarterly / yearly): progress is
 * scoped to the current period and resets at the start of the next
 * period — used for things like "Save $500/month" or "Contribute
 * $5,000 quarterly".
 *
 * Priority (within each cadence):
 *   1. Linked loan/credit account on a payoff goal → principal paid
 *      down (one-time only — recurring payoff doesn't make sense)
 *   2. Linked depository/investment account → currentBalance
 *      (one-time) or net deposits this period (recurring; not yet
 *      derivable from Plaid balances alone, so falls back to
 *      patterns when recurring)
 *   3. merchantPatterns → sum of matching transactions, optionally
 *      filtered to the current period
 *   4. Stored currentAmount → manual value
 */
async function computeCurrent(
  goal: {
    householdId: string;
    kind: string;
    cadence: string;
    targetAmount: number;
    currentAmount: number | null;
    merchantPatterns: string[];
    linkedAccount: { type: string; currentBalance: number | null } | null;
  }
): Promise<number> {
  const isRecurring = goal.cadence && goal.cadence !== "one_time";
  const fromDate = isRecurring ? periodStart(goal.cadence) : null;

  if (goal.linkedAccount && !isRecurring) {
    const balance = goal.linkedAccount.currentBalance ?? 0;
    const isLiability =
      goal.linkedAccount.type === "loan" || goal.linkedAccount.type === "credit";
    if (goal.kind === "payoff" && isLiability) {
      return Math.max(0, goal.targetAmount - balance);
    }
    if (!isLiability) {
      return Math.max(0, balance);
    }
    // Fall through to patterns/stored for unusual combos.
  }

  if (goal.merchantPatterns && goal.merchantPatterns.length > 0) {
    const orConditions = goal.merchantPatterns.flatMap((p) => [
      { merchantName: { contains: p, mode: "insensitive" as const } },
      { name: { contains: p, mode: "insensitive" as const } },
    ]);
    const where: Record<string, unknown> = {
      householdId: goal.householdId,
      OR: orConditions,
    };
    if (fromDate) {
      where.date = { gte: fromDate };
    }
    const result = await db.transaction.aggregate({
      where: where as Parameters<typeof db.transaction.aggregate>[0]["where"],
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
