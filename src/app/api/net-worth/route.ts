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
      const history = Array.from({ length: 8 }, (_, i) => {
        const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (7 - i), 1));
        const netWorth = 52000 + i * 1450;
        return {
          month: d.toISOString().slice(0, 7),
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

    // No `take` cap: ascending order + a row limit would return the OLDEST
    // rows, so the chart would stop gaining new months after a year. The
    // monthly roll-up below keeps the payload small regardless.
    const snapshots = await db.netWorthSnapshot.findMany({
      where: { userId: user.id },
      orderBy: { date: "asc" },
    });

    // One point per UTC calendar month — the latest snapshot recorded in
    // that month (snapshots are only taken when the page is opened, so this
    // is "last visit that month", not a guaranteed month-end). Rows are in
    // ascending order, so later ones overwrite earlier ones in the same bucket.
    const byMonth = new Map<string, (typeof snapshots)[number]>();
    for (const s of snapshots) {
      byMonth.set(s.date.toISOString().slice(0, 7), s);
    }

    return NextResponse.json({
      current: { assets, liabilities, netWorth },
      history: Array.from(byMonth.entries()).map(([month, s]) => ({
        month,
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
