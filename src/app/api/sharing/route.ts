import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mockSharingPreferences } from "@/lib/mock-data";

// In-memory store for mock financial sharing prefs (persists per server process)
let mockFinancialPrefs = { shareIncome: false, shareNetSavings: false };

export async function GET() {
  try {
    if (process.env.USE_MOCK_DATA === "true") {
      return NextResponse.json({
        preferences: mockSharingPreferences,
        shareIncome: mockFinancialPrefs.shareIncome,
        shareNetSavings: mockFinancialPrefs.shareNetSavings,
      });
    }

    const user = await requireUser();
    if (!user.householdId) {
      return NextResponse.json({ preferences: [], shareIncome: false, shareNetSavings: false });
    }

    const categories = await db.category.findMany({
      orderBy: { sortOrder: "asc" },
    });

    const existingPrefs = await db.sharingPreference.findMany({
      where: { userId: user.id },
      include: { category: true },
    });

    const prefMap = Object.fromEntries(
      existingPrefs.map((p) => [p.categoryId, p])
    );

    const preferences = categories.map((cat) => ({
      categoryId: cat.id,
      categoryName: cat.name,
      emoji: cat.emoji,
      sharedWithHousehold: prefMap[cat.id]?.sharedWithHousehold ?? true,
    }));

    return NextResponse.json({ preferences, shareIncome: false, shareNetSavings: false });
  } catch (error) {
    console.error("Error fetching sharing preferences:", error);
    return NextResponse.json(
      { error: "Failed to fetch sharing preferences" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();

    // Handle financial sharing toggles
    if ("shareIncome" in body || "shareNetSavings" in body) {
      if (process.env.USE_MOCK_DATA === "true") {
        if ("shareIncome" in body) mockFinancialPrefs.shareIncome = body.shareIncome;
        if ("shareNetSavings" in body) mockFinancialPrefs.shareNetSavings = body.shareNetSavings;
        return NextResponse.json({ success: true, ...mockFinancialPrefs });
      }
      // Real mode: store in user metadata or a settings table (future)
      return NextResponse.json({ success: true });
    }

    // Handle category sharing toggles
    if (process.env.USE_MOCK_DATA === "true") {
      // Persist the toggle in the mutable mock array
      const idx = mockSharingPreferences.findIndex((p) => p.categoryId === body.categoryId);
      if (idx !== -1) {
        mockSharingPreferences[idx] = { ...mockSharingPreferences[idx], sharedWithHousehold: body.sharedWithHousehold };
      }
      return NextResponse.json({
        success: true,
        preference: {
          categoryId: body.categoryId,
          sharedWithHousehold: body.sharedWithHousehold,
        },
      });
    }

    const user = await requireUser();
    const { categoryId, sharedWithHousehold } = body;

    const preference = await db.sharingPreference.upsert({
      where: {
        userId_categoryId_householdId: {
          userId: user.id,
          categoryId,
          householdId: user.householdId!,
        },
      },
      update: { sharedWithHousehold },
      create: {
        userId: user.id,
        categoryId,
        householdId: user.householdId!,
        sharedWithHousehold,
      },
    });

    return NextResponse.json({ success: true, preference });
  } catch (error) {
    console.error("Error updating sharing preference:", error);
    return NextResponse.json(
      { error: "Failed to update sharing preference" },
      { status: 500 }
    );
  }
}
