import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeManualLoanBalance } from "@/lib/manual-loan";

/**
 * Create a manual asset (real estate, vehicle, personal property) or a
 * manual loan (mortgage, auto loan) that flow into Net Worth alongside
 * aggregator accounts.
 *
 * Assets appear with provider="manual" and contribute on the assets
 * side. Loans appear with provider="manual" + type="loan" and contribute
 * on the liabilities side. Loan balances are recomputed automatically
 * from matching payment transactions; users do not need to update them.
 *
 * Asset body: {
 *   name, type: "real_estate" | "vehicle" | "other_asset",
 *   subtype?, currentValue, purchasePrice?, purchaseDate?, notes?
 * }
 * Loan body: {
 *   name, type: "loan", subtype?,
 *   originalPrincipal, interestRate?, purchaseDate?,
 *   merchantPatterns: string[], notes?
 * }
 */
const ASSET_TYPES = new Set(["real_estate", "vehicle", "other_asset"]);

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
      // asset-only
      currentValue,
      purchasePrice,
      // loan-only
      originalPrincipal,
      interestRate,
      termMonths,
      monthlyPayment,
      escrowMonthly,
      hoaMonthly,
      extraPrincipalMonthly,
      merchantPatterns,
      // shared
      purchaseDate,
      notes,
    } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const externalId = `manual_${crypto.randomUUID()}`;

    if (type === "loan") {
      if (typeof originalPrincipal !== "number" || originalPrincipal <= 0) {
        return NextResponse.json(
          { error: "originalPrincipal must be a positive number" },
          { status: 400 }
        );
      }
      if (typeof termMonths !== "number" || termMonths <= 0) {
        return NextResponse.json(
          { error: "termMonths must be a positive integer (e.g. 60 = 5yr, 360 = 30yr)" },
          { status: 400 }
        );
      }
      if (typeof interestRate !== "number" || interestRate < 0) {
        return NextResponse.json(
          { error: "interestRate (APR %) is required, use 0 for interest-free" },
          { status: 400 }
        );
      }
      const patterns = Array.isArray(merchantPatterns)
        ? merchantPatterns
            .map((p: unknown) => String(p).trim())
            .filter(Boolean)
        : [];
      const start = purchaseDate ? new Date(purchaseDate) : null;

      const currentBalance = await computeManualLoanBalance({
        originalPrincipal,
        interestRate,
        termMonths,
        monthlyPayment:
          typeof monthlyPayment === "number" ? monthlyPayment : null,
        escrowMonthly:
          typeof escrowMonthly === "number" ? escrowMonthly : null,
        hoaMonthly: typeof hoaMonthly === "number" ? hoaMonthly : null,
        startDate: start,
        merchantPatterns: patterns,
        householdId: user.householdId,
      });

      const account = await db.account.create({
        data: {
          plaidAccountId: externalId,
          provider: "manual",
          name,
          type: "loan",
          subtype: subtype || null,
          currentBalance,
          availableBalance: null,
          isoCurrencyCode: "USD",
          purchasePrice: originalPrincipal,
          purchaseDate: start,
          interestRate,
          termMonths,
          monthlyPayment:
            typeof monthlyPayment === "number" ? monthlyPayment : null,
          escrowMonthly:
            typeof escrowMonthly === "number" ? escrowMonthly : null,
          hoaMonthly: typeof hoaMonthly === "number" ? hoaMonthly : null,
          extraPrincipalMonthly:
            typeof extraPrincipalMonthly === "number"
              ? extraPrincipalMonthly
              : null,
          merchantPatterns: patterns,
          notes: notes || null,
          userId: user.id,
          householdId: user.householdId,
        },
      });
      return NextResponse.json(account);
    }

    // ---- Asset branch ----
    if (!ASSET_TYPES.has(type)) {
      return NextResponse.json(
        {
          error: `type must be 'loan' or one of: ${Array.from(ASSET_TYPES).join(", ")}`,
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
 * Update an existing manual account.
 *
 * For assets: { accountId, currentValue, notes? }
 * For loans:  { accountId, interestRate?, merchantPatterns?, notes? } —
 * currentBalance is recomputed from patterns automatically.
 */
export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const {
      accountId,
      currentValue,
      interestRate,
      termMonths,
      monthlyPayment,
      escrowMonthly,
      hoaMonthly,
      extraPrincipalMonthly,
      merchantPatterns,
      notes,
    } = body;

    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 });
    }

    const account = await db.account.findFirst({
      where: { id: accountId, userId: user.id, provider: "manual" },
    });
    if (!account) {
      return NextResponse.json({ error: "Manual account not found" }, { status: 404 });
    }

    if (account.type === "loan") {
      const patterns = Array.isArray(merchantPatterns)
        ? merchantPatterns.map((p: unknown) => String(p).trim()).filter(Boolean)
        : account.merchantPatterns;
      const rate =
        typeof interestRate === "number" ? interestRate : account.interestRate;
      const term =
        typeof termMonths === "number" ? termMonths : account.termMonths;
      const pmt =
        typeof monthlyPayment === "number"
          ? monthlyPayment
          : account.monthlyPayment;
      const escrow =
        typeof escrowMonthly === "number"
          ? escrowMonthly
          : account.escrowMonthly;
      const hoa =
        typeof hoaMonthly === "number" ? hoaMonthly : account.hoaMonthly;
      const extra =
        typeof extraPrincipalMonthly === "number"
          ? extraPrincipalMonthly
          : account.extraPrincipalMonthly;
      const newBalance = await computeManualLoanBalance({
        originalPrincipal: account.purchasePrice ?? 0,
        interestRate: rate,
        termMonths: term,
        monthlyPayment: pmt,
        escrowMonthly: escrow,
        hoaMonthly: hoa,
        startDate: account.purchaseDate,
        merchantPatterns: patterns,
        householdId: account.householdId,
      });
      const updated = await db.account.update({
        where: { id: accountId },
        data: {
          interestRate: rate,
          termMonths: term,
          monthlyPayment: pmt,
          escrowMonthly: escrow,
          hoaMonthly: hoa,
          extraPrincipalMonthly: extra,
          merchantPatterns: patterns,
          currentBalance: newBalance,
          notes: typeof notes === "string" ? notes : account.notes,
        },
      });
      return NextResponse.json(updated);
    }

    if (typeof currentValue !== "number" || currentValue < 0) {
      return NextResponse.json(
        { error: "currentValue must be a non-negative number" },
        { status: 400 }
      );
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
    console.error("Error updating manual account:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update manual account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
