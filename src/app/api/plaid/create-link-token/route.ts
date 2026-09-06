import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { requireUser } from "@/lib/auth";
import { CountryCode, Products } from "plaid";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";

export async function POST(req: Request) {
  try {
    if (process.env.USE_MOCK_DATA === "true") {
      return NextResponse.json({ link_token: "mock-link-token" });
    }
    const user = await requireUser();
    const { plaidItemId } = await req.json().catch(() => ({}));

    // An existing Item needs Link update mode (not a second connection) when
    // Plaid reports ITEM_LOGIN_REQUIRED. The original access token remains
    // valid after update mode, so no public-token exchange is necessary.
    if (typeof plaidItemId === "string") {
      const item = await db.plaidItem.findFirst({
        where: { id: plaidItemId, userId: user.id },
        select: { accessTokenEncrypted: true },
      });
      if (!item) {
        return NextResponse.json({ error: "Connected institution not found" }, { status: 404 });
      }

      const response = await plaidClient.linkTokenCreate({
        user: { client_user_id: user.id },
        client_name: "Financial Flows",
        country_codes: [CountryCode.Us],
        language: "en",
        redirect_uri: process.env.PLAID_REDIRECT_URI,
        access_token: decrypt(item.accessTokenEncrypted),
      });
      return NextResponse.json({ link_token: response.data.link_token, updateMode: true });
    }

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: "Financial Flows",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
      redirect_uri: process.env.PLAID_REDIRECT_URI,
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error: any) {
    const plaidError = error?.response?.data;
    console.error("Error creating link token:", plaidError || error);
    return NextResponse.json({ error: "Failed to create link token" }, { status: 500 });
  }
}
