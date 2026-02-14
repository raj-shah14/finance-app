import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mockInsightsData, mockSharingPreferences } from "@/lib/mock-data";

// Fetch financial sharing prefs from the sharing API
async function getFinancialSharingPrefs(baseUrl: string): Promise<{ shareIncome: boolean; shareNetSavings: boolean }> {
  try {
    const res = await fetch(`${baseUrl}/api/sharing`);
    if (res.ok) {
      const data = await res.json();
      return { shareIncome: data.shareIncome ?? false, shareNetSavings: data.shareNetSavings ?? false };
    }
  } catch {}
  return { shareIncome: false, shareNetSavings: false };
}

export async function GET(req: Request) {
  try {
    if (process.env.USE_MOCK_DATA === "true") {
      const url = new URL(req.url);
      const viewMode = url.searchParams.get("viewMode") || "household";

      // Fetch financial sharing prefs
      const origin = url.origin;
      const financialPrefs = viewMode === "household"
        ? await getFinancialSharingPrefs(origin)
        : { shareIncome: true, shareNetSavings: true };

      if (viewMode === "household") {
        const sharedCategoryIds = new Set(
          mockSharingPreferences
            .filter((p) => p.sharedWithHousehold)
            .map((p) => p.categoryId)
        );

        const filteredAllCategories = mockInsightsData.allCategories.filter(
          (c) => sharedCategoryIds.has(c.categoryId)
        );
        const filteredTopCategories = mockInsightsData.topCategories.filter(
          (c) => sharedCategoryIds.has(c.categoryId)
        );
        const totalSpending = filteredAllCategories.reduce(
          (sum, c) => sum + c.amount,
          0
        );

        const filteredBudgetInsights = mockInsightsData.budgetInsights.filter(
          (b) => {
            const cat = mockSharingPreferences.find((p) => p.categoryName === b.categoryName);
            return !cat || cat.sharedWithHousehold;
          }
        );

        return NextResponse.json({
          ...mockInsightsData,
          allCategories: filteredAllCategories,
          topCategories: filteredTopCategories,
          budgetInsights: filteredBudgetInsights,
          totalSpending,
          totalIncome: financialPrefs.shareIncome ? mockInsightsData.totalIncome : null,
          netSavings: financialPrefs.shareNetSavings
            ? mockInsightsData.totalIncome - totalSpending
            : null,
          shareIncome: financialPrefs.shareIncome,
          shareNetSavings: financialPrefs.shareNetSavings,
        });
      }

      return NextResponse.json({
        ...mockInsightsData,
        shareIncome: true,
        shareNetSavings: true,
      });
    }
    const user = await requireUser();
    if (!user.householdId) {
      return NextResponse.json({ insights: null });
    }

    const url = new URL(req.url);
    const month = parseInt(url.searchParams.get("month") || String(new Date().getMonth() + 1));
    const year = parseInt(url.searchParams.get("year") || String(new Date().getFullYear()));
    const filterUserId = url.searchParams.get("userId");
    const viewMode = url.searchParams.get("viewMode") || "household";

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    const prevStartDate = new Date(year, month - 2, 1);
    const prevEndDate = new Date(year, month - 1, 0, 23, 59, 59);

    const baseWhere: any = {
      householdId: user.householdId,
      amount: { gt: 0 },
    };
    if (filterUserId) baseWhere.userId = filterUserId;

    if (viewMode === "household") {
      const sharedPrefs = await db.sharingPreference.findMany({
        where: { sharedWithHousehold: false },
      });
      const excludedCategoryIds = sharedPrefs.map((p) => p.categoryId);
      if (excludedCategoryIds.length > 0) {
        baseWhere.categoryId = { notIn: excludedCategoryIds };
      }
    }

    // Current month spending by category
    const currentSpending = await db.transaction.groupBy({
      by: ["categoryId"],
      where: { ...baseWhere, date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
      _count: true,
    });

    // Previous month spending by category
    const prevSpending = await db.transaction.groupBy({
      by: ["categoryId"],
      where: { ...baseWhere, date: { gte: prevStartDate, lte: prevEndDate } },
      _sum: { amount: true },
    });

    // Get categories
    const categories = await db.category.findMany({ orderBy: { sortOrder: "asc" } });
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

    const prevMap = Object.fromEntries(
      prevSpending.map((s) => [s.categoryId, s._sum.amount || 0])
    );

    // Build category insights
    const categoryInsights = currentSpending
      .filter((s) => s.categoryId)
      .map((s) => {
        const cat = catMap[s.categoryId!];
        const current = s._sum.amount || 0;
        const previous = prevMap[s.categoryId!] || 0;
        const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;

        return {
          categoryId: s.categoryId,
          categoryName: cat?.name || "Unknown",
          emoji: cat?.emoji || "❓",
          color: cat?.color || "#9ca3af",
          amount: current,
          previousAmount: previous,
          changePercent: Math.round(change),
          transactionCount: s._count,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    // Total spending
    const totalCurrent = categoryInsights.reduce((sum, c) => sum + c.amount, 0);
    const totalPrevious = Object.values(prevMap).reduce((sum: number, v: any) => sum + v, 0);
    const totalChange = totalPrevious > 0 ? ((totalCurrent - totalPrevious) / totalPrevious) * 100 : 0;

    // Income (negative amounts)
    const incomeResult = await db.transaction.aggregate({
      where: {
        ...baseWhere,
        amount: { lt: 0 },
        date: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    });
    const totalIncome = Math.abs(incomeResult._sum.amount || 0);

    // Budgets
    const budgets = await db.budget.findMany({
      where: { householdId: user.householdId, month, year },
      include: { category: true },
    });

    const budgetInsights = budgets.map((b) => {
      const spent = currentSpending.find((s) => s.categoryId === b.categoryId)?._sum.amount || 0;
      const percentage = b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0;
      return {
        categoryName: b.category.name,
        emoji: b.category.emoji,
        limit: b.monthlyLimit,
        spent,
        percentage: Math.round(percentage),
        status: percentage >= 100 ? "over" : percentage >= 75 ? "warning" : "good",
      };
    });

    // Daily spending for chart
    const dailySpending = await db.transaction.groupBy({
      by: ["date"],
      where: { ...baseWhere, date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
      orderBy: { date: "asc" },
    });

    // Per-person spending
    const perPersonSpending = await db.transaction.groupBy({
      by: ["userId"],
      where: { ...baseWhere, date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
    });

    const users = await db.user.findMany({
      where: { householdId: user.householdId },
      select: { id: true, firstName: true, lastName: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    const perPerson = perPersonSpending.map((p) => ({
      userId: p.userId,
      name: `${userMap[p.userId]?.firstName || ""} ${userMap[p.userId]?.lastName || ""}`.trim() || "Unknown",
      amount: p._sum.amount || 0,
    }));

    return NextResponse.json({
      month,
      year,
      totalSpending: totalCurrent,
      totalIncome,
      netSavings: totalIncome - totalCurrent,
      totalChangePercent: Math.round(totalChange),
      topCategories: categoryInsights.slice(0, 5),
      allCategories: categoryInsights,
      budgetInsights,
      dailySpending: dailySpending.map((d) => ({
        date: d.date,
        amount: d._sum.amount || 0,
      })),
      perPerson,
      highlights: {
        wellDone: budgetInsights.filter((b) => b.status === "good"),
        watchOut: budgetInsights.filter((b) => b.status === "over"),
      },
    });
  } catch (error) {
    console.error("Error fetching insights:", error);
    return NextResponse.json({ error: "Failed to fetch insights" }, { status: 500 });
  }
}
