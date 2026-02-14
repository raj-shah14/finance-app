import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mockCategoriesData } from "@/lib/mock-data";

export async function GET() {
  try {
    if (process.env.USE_MOCK_DATA === "true") {
      return NextResponse.json({ categories: mockCategoriesData });
    }

    const categories = await db.category.findMany({
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}
