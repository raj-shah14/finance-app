import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Net worth = (cash + investments + manual assets) − (credit + loan
// principal), same formula the Accounts page uses. Plaid/SnapTrade
// return `currentBalance` as a positive number for both credit and
// loan accounts representing the amount owed.
function computeNetWorth(accounts: { type: string; currentBalance: number | null }[]) {
  const sum = (types: string[]) =>
    accounts
      .filter((a) => types.includes(a.type))
      .reduce((s, a) => s + (a.currentBalance ?? 0), 0);

  const assets = sum(["depository", "investment", "real_estate", "vehicle", "other_asset"]);
  const liabilities = sum(["credit", "loan"]);
  return { assets, liabilities, netWorth: assets - liabilities };
}

export async function GET() {
  try {
    if (process.env.USE_MOCK_DATA === "true") {
      const today = new Date();
      const history = Array.from({ length: 14 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (13 - i));
        const netWorth = 52000 + i * 350;
        return {
          date: d.toISOString(),
          assets: netWorth + 4300,
          liabilities: 4300,
          netWorth,
        };
      });
      return NextResponse.json({ current: history[history.length - 1], history });
    }

    const user = await requireUser();
    if (!user.householdId) {
      return NextResponse.json({ current: null, history: [] });
    }

    const accounts = await db.account.findMany({
      where: { userId: user.id },
      select: { type: true, currentBalance: true },
    });
    const { assets, liabilities, netWorth } = computeNetWorth(accounts);

    // One row per user per day — upsert today's snapshot so history
    // accumulates from whenever the user first opens this page. There is
    // no way to back-date real historical balances, so this intentionally
    // does not fabricate a longer history.
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    await db.netWorthSnapshot.upsert({
      where: { userId_date: { userId: user.id, date: startOfToday } },
      update: { assets, liabilities, netWorth },
      create: { userId: user.id, date: startOfToday, assets, liabilities, netWorth },
    });

    const snapshots = await db.netWorthSnapshot.findMany({
      where: { userId: user.id },
      orderBy: { date: "asc" },
      take: 365,
    });

    return NextResponse.json({
      current: { assets, liabilities, netWorth },
      history: snapshots.map((s) => ({
        date: s.date,
        assets: s.assets,
        liabilities: s.liabilities,
        netWorth: s.netWorth,
      })),
    });
  } catch (error) {
    console.error("Error fetching net worth:", error);
    return NextResponse.json({ error: "Failed to fetch net worth" }, { status: 500 });
  }
}
