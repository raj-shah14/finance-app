import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Create a manual asset (real estate, vehicle, or generic personal
 * property) that flows into Net Worth alongside aggregator accounts.
 *
 * These appear in /accounts with provider="manual" and contribute as
 * assets in the Net Worth calculation. Manual assets are not synced —
 * the user updates `currentBalance` (= current value) themselves.
 *
 * Body: {
 *   name: string,
 *   type: "real_estate" | "vehicle" | "other_asset",
 *   subtype?: string,            // e.g. "primary residence", "rental"
 *   currentValue: number,        // current market value
 *   purchasePrice?: number,      // original cost basis
 *   purchaseDate?: string,       // ISO date
 *   notes?: string,
 * }
 */
const ALLOWED_TYPES = new Set(["real_estate", "vehicle", "other_asset"]);

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user.householdId) {
      return NextResponse.json({ error: "No household" }, { status: 400 });
    }

    const body = await req.json();
    const {
      name,
      type,
      subtype,
      currentValue,
      purchasePrice,
      purchaseDate,
      notes,
    } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(type)) {
      return NextResponse.json(
        {
          error: `type must be one of: ${Array.from(ALLOWED_TYPES).join(", ")}`,
        },
        { status: 400 }
      );
    }
    if (typeof currentValue !== "number" || currentValue < 0) {
      return NextResponse.json(
        { error: "currentValue must be a non-negative number" },
        { status: 400 }
      );
    }

    // Reuse Account.plaidAccountId as the external unique key with a
    // "manual_" prefix to avoid collisions with Plaid (raw UUIDs) and
    // SnapTrade (st_ prefix).
    const externalId = `manual_${crypto.randomUUID()}`;

    const account = await db.account.create({
      data: {
        plaidAccountId: externalId,
        provider: "manual",
        name,
        type,
        subtype: subtype || null,
        currentBalance: currentValue,
        availableBalance: currentValue,
        isoCurrencyCode: "USD",
        purchasePrice:
          typeof purchasePrice === "number" ? purchasePrice : null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        notes: notes || null,
        userId: user.id,
        householdId: user.householdId,
      },
    });

    return NextResponse.json(account);
  } catch (error) {
    console.error("Error creating manual asset:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create manual asset";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Update the current value of an existing manual asset.
 * Body: { accountId: string, currentValue: number, notes?: string }
 */
export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const { accountId, currentValue, notes } = await req.json();

    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 });
    }
    if (typeof currentValue !== "number" || currentValue < 0) {
      return NextResponse.json(
        { error: "currentValue must be a non-negative number" },
        { status: 400 }
      );
    }

    const account = await db.account.findFirst({
      where: { id: accountId, userId: user.id, provider: "manual" },
    });
    if (!account) {
      return NextResponse.json({ error: "Manual asset not found" }, { status: 404 });
    }

    const updated = await db.account.update({
      where: { id: accountId },
      data: {
        currentBalance: currentValue,
        availableBalance: currentValue,
        notes: typeof notes === "string" ? notes : account.notes,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating manual asset:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update manual asset";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
