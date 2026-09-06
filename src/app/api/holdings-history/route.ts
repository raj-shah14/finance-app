import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

const KINDS = ["savings", "investments"] as const;
type Kind = (typeof KINDS)[number];

const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Mirrors the account filters HoldingsView applies client-side for each
// page, so the snapshot totals line up exactly with what's shown there.
function accountFilter(kind: Kind): Prisma.AccountWhereInput {
  return kind === "savings"
    ? { type: "depository", subtype: "savings" }
    : { type: "investment" };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const kindParam = url.searchParams.get("kind");
    if (!kindParam || !KINDS.includes(kindParam as Kind)) {
      return NextResponse.json(
        { error: `kind must be one of: ${KINDS.join(", ")}` },
        { status: 400 }
      );
    }
    const kind = kindParam as Kind;

    if (process.env.USE_MOCK_DATA === "true") {
      const today = new Date();
      const startOfYear = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
      const daysThisYear = Math.floor(
        (today.getTime() - startOfYear.getTime()) / 86400000
      );
      const base = kind === "savings" ? 15000 : 42000;
      const history = Array.from({ length: Math.min(daysThisYear + 1, 60) }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (Math.min(daysThisYear, 59) - i));
        return { date: d.toISOString(), value: base + i * (base * 0.0015) };
      });
      const current = history[history.length - 1]?.value ?? base;
      const startOfYearValue = history[0]?.value ?? base;
      return NextResponse.json({
        current,
        startOfYearValue,
        yearlyChangePercent: startOfYearValue > 0 ? Math.round(((current - startOfYearValue) / startOfYearValue) * 1000) / 10 : 0,
        monthlyChangePercent: 2.3,
        monthly: MONTH_NAMES_SHORT.slice(0, today.getUTCMonth() + 1).map((m, i) => ({
          month: m,
          value: base + i * (base * 0.02),
        })),
      });
    }

    const user = await requireUser();
    if (!user.householdId) {
      return NextResponse.json({ current: 0, startOfYearValue: 0, yearlyChangePercent: 0, monthlyChangePercent: 0, monthly: [] });
    }

    const accounts = await db.account.findMany({
      where: { userId: user.id, ...accountFilter(kind) },
      select: { currentBalance: true },
    });
    const current = accounts.reduce((s, a) => s + (a.currentBalance ?? 0), 0);

    // One row per user per kind per day — upsert today's snapshot so
    // history accumulates from whenever this page is first opened. There
    // is no way to back-date real historical balances (same limitation as
    // Net Worth), so this intentionally does not fabricate earlier data.
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    await db.holdingsSnapshot.upsert({
      where: { userId_kind_date: { userId: user.id, kind, date: startOfToday } },
      update: { value: current },
      create: { userId: user.id, kind, date: startOfToday, value: current },
    });

    // Scope everything to the current calendar year — the trend
    // intentionally resets on Jan 1 rather than scrolling indefinitely,
    // so "start of year vs. current" always means *this* year.
    const now = new Date();
    const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const yearSnapshots = await db.holdingsSnapshot.findMany({
      where: { userId: user.id, kind, date: { gte: startOfYear } },
      orderBy: { date: "asc" },
    });

    const startOfYearValue = yearSnapshots[0]?.value ?? current;
    const yearlyChangePercent =
      startOfYearValue > 0
        ? Math.round(((current - startOfYearValue) / startOfYearValue) * 1000) / 10
        : 0;

    // Monthly % change: compare against the most recent snapshot from
    // before this month began (i.e. where the prior month left off).
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const prevMonthSnapshot = await db.holdingsSnapshot.findFirst({
      where: { userId: user.id, kind, date: { lt: startOfMonth } },
      orderBy: { date: "desc" },
    });
    const monthlyChangePercent =
      prevMonthSnapshot && prevMonthSnapshot.value > 0
        ? Math.round(((current - prevMonthSnapshot.value) / prevMonthSnapshot.value) * 1000) / 10
        : 0;

    // Monthly chart, Jan → current month: last known snapshot value in
    // each month, carrying the previous month's value forward across any
    // month with no visits (rather than dropping to zero).
    const monthly: { month: string; value: number }[] = [];
    let carry = 0;
    for (let m = 0; m <= now.getUTCMonth(); m++) {
      const monthSnapshots = yearSnapshots.filter(
        (s) => s.date.getUTCMonth() === m
      );
      const value =
        monthSnapshots.length > 0
          ? monthSnapshots[monthSnapshots.length - 1].value
          : carry;
      carry = value;
      monthly.push({ month: MONTH_NAMES_SHORT[m], value });
    }

    return NextResponse.json({
      current,
      startOfYearValue,
      yearlyChangePercent,
      monthlyChangePercent,
      monthly,
    });
  } catch (error) {
    console.error("Error fetching holdings history:", error);
    return NextResponse.json({ error: "Failed to fetch holdings history" }, { status: 500 });
  }
}
