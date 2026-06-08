import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mockInsightsData } from "@/lib/mock-data";
import { monthBoundsUTC } from "@/lib/utils";
import { EXCLUDED_FROM_SPENDING } from "@/lib/categories";
import { ensureBudgetsForMonth } from "@/lib/budget-carry";
import { decryptForUser } from "@/lib/crypto-envelope";

export async function GET(req: Request) {
  try {
    if (process.env.USE_MOCK_DATA === "true") {
      // Insights are strictly personal — return the unfiltered mock dataset.
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

    // Plaid stores transaction dates at UTC midnight (e.g. "2026-04-01" →
    // 2026-04-01T00:00:00Z). Build month boundaries in UTC so the query
    // doesn't pull the next month's first-day transactions into the current
    // month when the server runs west of UTC.
    const { start: startDate, end: endDate } = monthBoundsUTC(year, month);
    const { start: prevStartDate, end: prevEndDate } = monthBoundsUTC(year, month - 1);

    // Insights are STRICTLY personal — never include household partner
    // data (privacy fix 2026-06-04). Cross-member visibility only exists
    // on the Transactions tab via per-category sharing.
    type WhereClause = Record<string, unknown>;
    const baseWhere = (extra: WhereClause = {}): WhereClause => ({
      userId: user.id,
      ...extra,
    });

    // Current month spending by category (net amount including payments/credits)
    const currentSpending = await db.transaction.groupBy({
      by: ["categoryId"],
      where: baseWhere({ date: { gte: startDate, lte: endDate } }),
      _sum: { amount: true },
      _count: true,
    });

    // Previous month spending by category
    const prevSpending = await db.transaction.groupBy({
      by: ["categoryId"],
      where: baseWhere({ date: { gte: prevStartDate, lte: prevEndDate } }),
      _sum: { amount: true },
    });

    // Get categories
    const categories = await db.category.findMany({ orderBy: { sortOrder: "asc" } });
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

    const prevMap = Object.fromEntries(
      prevSpending.map((s) => [s.categoryId, s._sum.amount || 0])
    );

    // Income categories: Salary, Income, and Savings & Investments
    // (contributions to savings/investments are tracked as "paying
    // yourself first" inflow). Restricted to deposits only (amount < 0)
    // so the checking-side outflow of an internal transfer doesn't
    // double-count against the destination-account deposit.
    const INCOME_CATEGORIES = ["Salary", "Income", "Savings & Investments"];
    const incomeCatIds = new Set(
      categories.filter((c) => INCOME_CATEGORIES.includes(c.name)).map((c) => c.id)
    );

    // Categories excluded from expense totals: transfers + income.
    const EXPENSE_EXCLUSIONS = new Set([
      ...EXCLUDED_FROM_SPENDING,
      ...INCOME_CATEGORIES,
    ]);

    // Build category insights — keep uncategorized rows so we don't silently
    // drop unclassified expenses from the totals.
    const categoryInsights = currentSpending
      .map((s) => {
        const cat = s.categoryId ? catMap[s.categoryId] : null;
        const catName = cat?.name || "Uncategorized";
        const current = s._sum.amount || 0;
        const previous = (s.categoryId ? prevMap[s.categoryId] : 0) || 0;
        const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;

        return {
          categoryId: s.categoryId ?? "uncategorized",
          categoryName: catName,
          emoji: cat?.emoji || "❓",
          color: cat?.color || "#9ca3af",
          amount: current,
          previousAmount: previous,
          changePercent: Math.round(change),
          transactionCount: s._count,
          excludeFromSpending: EXPENSE_EXCLUSIONS.has(catName),
        };
      })
      .sort((a, b) => b.amount - a.amount);

    // Spending categories only (excludes Salary, Income, CC Bill, CC Payments)
    const spendingCategories = categoryInsights.filter(
      (c) => !c.excludeFromSpending
    );

    // Total spending — net of refunds within each category (a $20 refund in
    // Groceries correctly reduces the Groceries total).
    const totalCurrent = spendingCategories.reduce((sum, c) => sum + c.amount, 0);
    const totalPrevious = spendingCategories.reduce((sum, c) => sum + c.previousAmount, 0);
    const totalChange = totalPrevious > 0 ? ((totalCurrent - totalPrevious) / totalPrevious) * 100 : 0;

    // Total income — restricted to income categories. Excludes refunds,
    // reversals, and CC payments that happen to be negative amounts.
    // The visibility predicate already enforces per-category sharing,
    // so income categories the partner hasn't shared are automatically
    // excluded for the partner's data.
    const allowedIncomeCatIds = Array.from(incomeCatIds);

    let totalIncome = 0;
    if (allowedIncomeCatIds.length > 0) {
      const incomeResult = await db.transaction.aggregate({
        where: baseWhere({
          categoryId: { in: allowedIncomeCatIds },
          amount: { lt: 0 },
          date: { gte: startDate, lte: endDate },
        }),
        _sum: { amount: true },
      });
      // Plaid stores money-in as negative; abs() for display.
      totalIncome = Math.abs(incomeResult._sum.amount || 0);
    }

    // Budgets — per-user only (privacy fix). Carry forward from the
    // most recent prior month if this user has no rows yet.
    await ensureBudgetsForMonth(user.householdId, user.id, month, year);
    const budgets = await db.budget.findMany({
      where: { userId: user.id, month, year },
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

    // IDs of categories excluded from spending charts
    const excludedSpendingCatIds = categories
      .filter((c) => EXPENSE_EXCLUSIONS.has(c.name))
      .map((c) => c.id);

    // Daily spending for chart — expenses only (amount > 0), excluding
    // transfers and income so the chart matches the headline expense total.
    const dailySpending = await db.transaction.groupBy({
      by: ["date"],
      where: baseWhere({
        amount: { gt: 0 },
        date: { gte: startDate, lte: endDate },
        ...(excludedSpendingCatIds.length > 0
          ? { categoryId: { notIn: excludedSpendingCatIds } }
          : {}),
      }),
      _sum: { amount: true },
      orderBy: { date: "asc" },
    });

    // Per-person spending is meaningless on a personal view — return
    // an empty array so downstream callers don't break.
    const perPerson: Array<{ userId: string; name: string; amount: number }> = [];

    // Credit-card spend — only THIS user's own credit accounts. Partner's
    // credit cards are private and never aggregated here.
    const creditAccounts = await db.account.findMany({
      where: { userId: user.id, type: "credit" },
      select: { id: true },
    });
    let creditCardSpend = 0;
    let prevCreditCardSpend = 0;
    if (creditAccounts.length > 0) {
      const ccAccountIds = creditAccounts.map((a) => a.id);
      const ccBaseExtras: Record<string, unknown> = {
        accountId: { in: ccAccountIds },
        amount: { gt: 0 },
      };
      if (excludedSpendingCatIds.length > 0) {
        ccBaseExtras.categoryId = { notIn: excludedSpendingCatIds };
      }
      const [curr, prev] = await Promise.all([
        db.transaction.aggregate({
          where: baseWhere({ ...ccBaseExtras, date: { gte: startDate, lte: endDate } }),
          _sum: { amount: true },
        }),
        db.transaction.aggregate({
          where: baseWhere({ ...ccBaseExtras, date: { gte: prevStartDate, lte: prevEndDate } }),
          _sum: { amount: true },
        }),
      ]);
      creditCardSpend = curr._sum.amount || 0;
      prevCreditCardSpend = prev._sum.amount || 0;
    }

    // Loan payments — sum of transactions matching any merchantPattern
    // configured on THIS user's manual-loan accounts. Loans are private
    // per-user, so partner's loans / payments do not appear here.
    const manualLoans = await db.account.findMany({
      where: {
        userId: user.id,
        type: "loan",
        provider: "manual",
      },
      select: { merchantPatterns: true },
    });
    let loanSpend = 0;
    let prevLoanSpend = 0;
    const allPatterns = manualLoans
      .flatMap((l) => l.merchantPatterns)
      .filter((p) => p && p.length > 0);
    if (allPatterns.length > 0) {
      // merchantName/name are now AES-GCM ciphertext, so DB-side `contains`
      // would never match. Fetch this user's expense rows in each period
      // and pattern-match after decrypting in JS.
      const lowerPatterns = allPatterns.map((p) => p.toLowerCase());
      const matchSum = async (range: { gte: Date; lte: Date }) => {
        const rows = await db.transaction.findMany({
          where: baseWhere({ amount: { gt: 0 }, date: range }),
          select: { name: true, merchantName: true, amount: true },
        });
        let sum = 0;
        for (const r of rows) {
          const name = (await decryptForUser(user.id, r.name)) ?? "";
          const merchant = (await decryptForUser(user.id, r.merchantName)) ?? "";
          const haystack = (name + " " + merchant).toLowerCase();
          if (lowerPatterns.some((p) => haystack.includes(p))) {
            sum += r.amount;
          }
        }
        return sum;
      };
      loanSpend = await matchSum({ gte: startDate, lte: endDate });
      prevLoanSpend = await matchSum({ gte: prevStartDate, lte: prevEndDate });
    }

    return NextResponse.json({
      month,
      year,
      totalSpending: totalCurrent,
      totalIncome,
      netSavings: totalIncome - totalCurrent,
      totalChangePercent: Math.round(totalChange),
      topCategories: spendingCategories.slice(0, 5),
      allCategories: spendingCategories,
      budgetInsights,
      creditCardSpend,
      prevCreditCardSpend,
      loanSpend,
      prevLoanSpend,
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
