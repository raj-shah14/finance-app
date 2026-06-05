import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mockTransactionsData, mockSharingPreferences } from "@/lib/mock-data";
import { monthBoundsUTC } from "@/lib/utils";

export async function GET(req: Request) {
  try {
    if (process.env.USE_MOCK_DATA === "true") {
      const url = new URL(req.url);
      const viewMode = url.searchParams.get("viewMode") || "household";

      if (viewMode === "household") {
        const sharedCategoryIds = new Set(
          mockSharingPreferences
            .filter((p) => p.sharedWithHousehold)
            .map((p) => p.categoryId)
        );

        const filteredTransactions = mockTransactionsData.transactions.filter(
          (t) => t.categoryId === null || sharedCategoryIds.has(t.categoryId)
        );

        return NextResponse.json({
          ...mockTransactionsData,
          transactions: filteredTransactions,
          total: filteredTransactions.length,
        });
      }

      return NextResponse.json(mockTransactionsData);
    }
    const user = await requireUser();
    if (!user.householdId) {
      return NextResponse.json({ transactions: [] });
    }

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const categoryId = url.searchParams.get("categoryId");
    const categoryIdsParam = url.searchParams.get("categoryIds");
    const categoryIds = categoryIdsParam
      ? categoryIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
      : categoryId
        ? [categoryId]
        : [];
    const accountId = url.searchParams.get("accountId");
    const userIdFilter = url.searchParams.get("userId");
    const search = url.searchParams.get("search");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const viewMode = url.searchParams.get("viewMode") || "household";

    // ---- Visibility (privacy fix 2026-06-04) ----
    // A user can see:
    //   1. All of their OWN transactions (always).
    //   2. In "household" mode: other members' transactions, but only
    //      in categories the OTHER member has explicitly opted into
    //      sharing (SharingPreference.sharedWithHousehold = true for
    //      that member + category). Default (no row) = private.
    // In "personal" mode: only the current user's own transactions.
    const visibilityOr: Array<Record<string, unknown>> = [{ userId: user.id }];
    if (viewMode === "household") {
      const otherMembers = await db.user.findMany({
        where: { householdId: user.householdId, NOT: { id: user.id } },
        select: { id: true },
      });
      const otherIds = otherMembers.map((m) => m.id);
      if (otherIds.length > 0) {
        const sharedPrefs = await db.sharingPreference.findMany({
          where: {
            userId: { in: otherIds },
            sharedWithHousehold: true,
          },
          select: { userId: true, categoryId: true },
        });
        const byUser: Record<string, string[]> = {};
        for (const p of sharedPrefs) {
          (byUser[p.userId] ??= []).push(p.categoryId);
        }
        for (const [memberId, catIds] of Object.entries(byUser)) {
          if (catIds.length > 0) {
            visibilityOr.push({ userId: memberId, categoryId: { in: catIds } });
          }
        }
      }
    }

    const filterAnd: Array<Record<string, unknown>> = [
      { householdId: user.householdId },
      { OR: visibilityOr },
    ];

    if (categoryIds.length > 0) filterAnd.push({ categoryId: { in: categoryIds } });
    if (accountId) filterAnd.push({ accountId });
    if (userIdFilter) filterAnd.push({ userId: userIdFilter });
    if (search) {
      filterAnd.push({
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { merchantName: { contains: search, mode: "insensitive" } },
        ],
      });
    }
    if (startDate || endDate) {
      const dateRange: Record<string, Date> = {};
      if (startDate) dateRange.gte = new Date(startDate);
      if (endDate) dateRange.lte = new Date(endDate);
      filterAnd.push({ date: dateRange });
    } else {
      // Plaid stores dates at UTC midnight; build the default "current month"
      // range in UTC so we don't pull next month's first day into this month
      // (or drop this month's first day) when running west of UTC.
      const now = new Date();
      const { start, end } = monthBoundsUTC(now.getUTCFullYear(), now.getUTCMonth() + 1);
      filterAnd.push({ date: { gte: start, lte: end } });
    }

    const where: Record<string, unknown> = { AND: filterAnd };

    // Categories excluded from summary totals (transfers — not real spending or income).
    // Salary stays in so it counts toward Received.
    const SUMMARY_EXCLUDED = ["CC Bill", "CC Payment", "CC Payments"];
    const summaryExcludedCats = await db.category.findMany({
      where: { name: { in: SUMMARY_EXCLUDED } },
      select: { id: true },
    });
    const summaryExcludedIds = summaryExcludedCats.map((c) => c.id);
    const summaryWhere: Record<string, unknown> =
      summaryExcludedIds.length > 0
        ? {
            AND: [
              ...filterAnd,
              { categoryId: { notIn: summaryExcludedIds } },
            ],
          }
        : where;

    const [transactions, total, sums] = await Promise.all([
      db.transaction.findMany({
        where,
        include: {
          category: true,
          account: { select: { name: true, mask: true, type: true } },
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.transaction.count({ where }),
      // Filter-wide totals: split spent (amount > 0) vs received (amount < 0),
      // excluding CC Bill / CC Payments (transfers).
      Promise.all([
        db.transaction.aggregate({
          where: { ...summaryWhere, amount: { gt: 0 } },
          _sum: { amount: true },
        }),
        db.transaction.aggregate({
          where: { ...summaryWhere, amount: { lt: 0 } },
          _sum: { amount: true },
        }),
      ]),
    ]);

    const spent = Number(sums[0]._sum.amount ?? 0);
    const received = -Number(sums[1]._sum.amount ?? 0);

    return NextResponse.json({
      transactions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      summary: { spent, received, net: received - spent },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    if (process.env.USE_MOCK_DATA === "true") {
      return NextResponse.json({ success: true });
    }
    const user = await requireUser();
    const body = await req.json();
    const transactionId = body.transactionId || body.id;
    const { categoryId } = body;

    if (!transactionId) {
      return NextResponse.json({ error: "Transaction ID is required" }, { status: 400 });
    }

    // Privacy: only allow editing your own transactions. A household
    // member must not be able to recategorize the partner's data.
    const existing = await db.transaction.findFirst({
      where: { id: transactionId, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const transaction = await db.transaction.update({
      where: { id: transactionId },
      data: { categoryId },
      include: { category: true },
    });

    // Save merchant→category rule for future auto-categorization
    const merchantKey = existing.merchantName || existing.name;
    if (categoryId && merchantKey && user.householdId) {
      await db.merchantCategoryRule.upsert({
        where: {
          merchantName_householdId: {
            merchantName: merchantKey.toLowerCase(),
            householdId: user.householdId,
          },
        },
        update: { categoryId },
        create: {
          merchantName: merchantKey.toLowerCase(),
          categoryId,
          householdId: user.householdId,
        },
      });
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Error updating transaction:", error);
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
  }
}
