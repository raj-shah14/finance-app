import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { mockCategoriesData } from "@/lib/mock-data";

export async function GET() {
  try {
    if (process.env.USE_MOCK_DATA === "true") {
      return NextResponse.json({ categories: mockCategoriesData });
    }

    await requireUser();
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

    if (process.env.USE_MOCK_DATA !== "true") {
      await requireUser();
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

export async function PATCH(req: Request) {
  try {
    const { categoryId, name, emoji, color } = await req.json();
    if (!categoryId) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 });
    }

    if (process.env.USE_MOCK_DATA === "true") {
      const idx = mockCategoriesData.findIndex((c) => c.id === categoryId);
      if (idx === -1) return NextResponse.json({ error: "Category not found" }, { status: 404 });
      const cat = mockCategoriesData[idx];
      if (typeof name === "string" && name.trim()) cat.name = name.trim();
      if (typeof emoji === "string" && emoji) cat.emoji = emoji;
      if (typeof color === "string" && color) cat.color = color;
      return NextResponse.json({ category: cat });
    }

    await requireUser();

    const existing = await db.category.findUnique({ where: { id: categoryId } });
    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const data: { name?: string; emoji?: string; color?: string } = {};

    // Default categories: only emoji + color editable. Name stays locked
    // because PLAID_CATEGORY_MAP and EXCLUDED_FROM_SPENDING reference them
    // by name.
    if (typeof name === "string" && name.trim() && name.trim() !== existing.name) {
      if (existing.isDefault) {
        return NextResponse.json({ error: "Cannot rename default categories" }, { status: 400 });
      }
      const dup = await db.category.findFirst({
        where: { name: name.trim(), id: { not: categoryId } },
      });
      if (dup) {
        return NextResponse.json({ error: "Category with this name already exists" }, { status: 400 });
      }
      data.name = name.trim();
    }
    if (typeof emoji === "string" && emoji && emoji !== existing.emoji) data.emoji = emoji;
    if (typeof color === "string" && color && color !== existing.color) data.color = color;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ category: existing });
    }

    const category = await db.category.update({
      where: { id: categoryId },
      data,
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { categoryId } = await req.json();
    if (!categoryId) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 });
    }

    if (process.env.USE_MOCK_DATA === "true") {
      return NextResponse.json({ success: true });
    }

    await requireUser();

    const category = await db.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    if (category.isDefault) {
      return NextResponse.json({ error: "Cannot delete default categories" }, { status: 400 });
    }

    // Unset category on transactions using this category
    await db.transaction.updateMany({
      where: { categoryId },
      data: { categoryId: null },
    });

    // Delete related records then the category
    await db.merchantCategoryRule.deleteMany({ where: { categoryId } });
    await db.sharingPreference.deleteMany({ where: { categoryId } });
    await db.category.delete({ where: { id: categoryId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
