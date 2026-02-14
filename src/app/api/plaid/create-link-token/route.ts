import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { requireUser } from "@/lib/auth";
import { CountryCode, Products } from "plaid";

export async function POST() {
  try {
    if (process.env.USE_MOCK_DATA === "true") {
      return NextResponse.json({ link_token: "mock-link-token" });
    }
    const user = await requireUser();

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: "FinanceFlow",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error("Error creating link token:", error);
    return NextResponse.json({ error: "Failed to create link token" }, { status: 500 });
  }
}
