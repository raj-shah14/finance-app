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
      client_name: "Financial Flow",
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
