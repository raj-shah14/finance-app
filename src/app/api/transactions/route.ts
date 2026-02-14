import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mockTransactionsData, mockSharingPreferences } from "@/lib/mock-data";

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
    const accountId = url.searchParams.get("accountId");
    const userId = url.searchParams.get("userId");
    const search = url.searchParams.get("search");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const viewMode = url.searchParams.get("viewMode") || "household";

    const where: any = { householdId: user.householdId };

    if (viewMode === "household") {
      const sharedPrefs = await db.sharingPreference.findMany({
        where: { sharedWithHousehold: false },
      });
      const excludedCategoryIds = sharedPrefs.map((p) => p.categoryId);
      if (excludedCategoryIds.length > 0) {
        where.categoryId = { notIn: excludedCategoryIds };
      }
    }

    if (categoryId) where.categoryId = categoryId;
    if (accountId) where.accountId = accountId;
    if (userId) where.userId = userId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { merchantName: { contains: search, mode: "insensitive" } },
      ];
    }
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const [transactions, total] = await Promise.all([
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
    ]);

    return NextResponse.json({
      transactions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
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
    await requireUser();
    const { transactionId, categoryId } = await req.json();

    const transaction = await db.transaction.update({
      where: { id: transactionId },
      data: { categoryId },
      include: { category: true },
    });

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Error updating transaction:", error);
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
  }
}
