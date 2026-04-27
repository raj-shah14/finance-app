import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/encryption";

export async function POST(req: Request) {
  try {
    if (process.env.USE_MOCK_DATA === "true") {
      return NextResponse.json({ success: true, accounts: 0 });
    }
    const user = await requireUser();
    const { public_token, metadata } = await req.json();

    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const { access_token, item_id } = exchangeResponse.data;

    // Check if this Plaid item is already connected
    const existingItem = await db.plaidItem.findFirst({
      where: { plaidItemId: item_id, userId: user.id },
    });
    if (existingItem) {
      return NextResponse.json(
        { error: "This institution is already connected" },
        { status: 409 }
      );
    }

    // Check if this institution is already connected (Plaid gives new item_id on re-link)
    const institutionId = metadata?.institution?.institution_id;
    if (institutionId) {
      const existingInstitution = await db.plaidItem.findFirst({
        where: { institutionId, userId: user.id },
      });
      if (existingInstitution) {
        return NextResponse.json(
          { error: "This institution is already connected" },
          { status: 409 }
        );
      }
    }

    const plaidItem = await db.plaidItem.create({
      data: {
        plaidItemId: item_id,
        accessTokenEncrypted: encrypt(access_token),
        institutionId: metadata?.institution?.institution_id || null,
        institutionName: metadata?.institution?.name || null,
        userId: user.id,
      },
    });

    const accountsResponse = await plaidClient.accountsGet({ access_token });

    for (const account of accountsResponse.data.accounts) {
      const existingAccount = await db.account.findFirst({
        where: { plaidAccountId: account.account_id },
      });
      if (existingAccount) continue;

      await db.account.create({
        data: {
          plaidAccountId: account.account_id,
          name: account.name,
          officialName: account.official_name || null,
          type: account.type,
          subtype: account.subtype || null,
          mask: account.mask || null,
          currentBalance: account.balances.current,
          availableBalance: account.balances.available,
          isoCurrencyCode: account.balances.iso_currency_code || "USD",
          plaidItemId: plaidItem.id,
          userId: user.id,
          householdId: user.householdId!,
        },
      });
    }

    return NextResponse.json({ success: true, accounts: accountsResponse.data.accounts.length });
  } catch (error) {
    console.error("Error exchanging token:", error);
    return NextResponse.json({ error: "Failed to connect account" }, { status: 500 });
  }
}
