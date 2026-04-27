import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mockBudgetsData } from "@/lib/mock-data";
import { monthBoundsUTC } from "@/lib/utils";

export async function GET(req: Request) {
  try {
    if (process.env.USE_MOCK_DATA === "true") {
      return NextResponse.json(mockBudgetsData);
    }
    const user = await requireUser();
    if (!user.householdId) {
      return NextResponse.json({ budgets: [] });
    }

    const url = new URL(req.url);
    const month = parseInt(url.searchParams.get("month") || String(new Date().getMonth() + 1));
    const year = parseInt(url.searchParams.get("year") || String(new Date().getFullYear()));

    const budgets = await db.budget.findMany({
      where: { householdId: user.householdId, month, year },
      include: { category: true },
      orderBy: { category: { sortOrder: "asc" } },
    });

    // Plaid stores transaction dates at UTC midnight; build month bounds in
    // UTC so we don't pull next month's first day into this month (or drop
    // this month's first day) when the server runs west of UTC.
    const { start: startDate, end: endDate } = monthBoundsUTC(year, month);

    const spending = await db.transaction.groupBy({
      by: ["categoryId"],
      where: {
        householdId: user.householdId,
        date: { gte: startDate, lte: endDate },
        amount: { gt: 0 }, // expenses only
      },
      _sum: { amount: true },
    });

    const spendingMap = Object.fromEntries(
      spending.map((s) => [s.categoryId, s._sum.amount || 0])
    );

    const budgetsWithSpending = budgets.map((b) => ({
      ...b,
      spent: spendingMap[b.categoryId] || 0,
      percentage: b.monthlyLimit > 0
        ? Math.round(((spendingMap[b.categoryId] || 0) / b.monthlyLimit) * 100)
        : 0,
    }));

    return NextResponse.json({ budgets: budgetsWithSpending, month, year });
  } catch (error) {
    console.error("Error fetching budgets:", error);
    return NextResponse.json({ error: "Failed to fetch budgets" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (process.env.USE_MOCK_DATA === "true") {
      return NextResponse.json({ success: true });
    }
    const user = await requireUser();
    if (!user.householdId) {
      return NextResponse.json({ error: "No household" }, { status: 400 });
    }

    const { categoryId, monthlyLimit, month, year } = await req.json();

    const budget = await db.budget.upsert({
      where: {
        categoryId_householdId_month_year: {
          categoryId,
          householdId: user.householdId,
          month,
          year,
        },
      },
      update: { monthlyLimit },
      create: {
        categoryId,
        householdId: user.householdId,
        monthlyLimit,
        month,
        year,
      },
      include: { category: true },
    });

    return NextResponse.json(budget);
  } catch (error) {
    console.error("Error saving budget:", error);
    return NextResponse.json({ error: "Failed to save budget" }, { status: 500 });
  }
}
