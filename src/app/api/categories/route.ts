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

export async function POST(req: Request) {
  try {
    const { name, emoji, color } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (process.env.USE_MOCK_DATA === "true") {
      const newCat = { id: `cat_custom_${Date.now()}`, name, emoji: emoji || "📌", color: color || "#6366f1", isDefault: false, sortOrder: 50 };
      mockCategoriesData.push(newCat);
      return NextResponse.json({ category: newCat });
    }

    // Check for duplicate name
    const existing = await db.category.findFirst({ where: { name: name.trim() } });
    if (existing) {
      return NextResponse.json({ error: "Category already exists" }, { status: 400 });
    }

    const category = await db.category.create({
      data: {
        name: name.trim(),
        emoji: emoji || "📌",
        color: color || "#6366f1",
        isDefault: false,
        sortOrder: 50,
      },
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
