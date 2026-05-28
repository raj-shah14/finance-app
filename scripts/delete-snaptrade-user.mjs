import { Snaptrade } from "snaptrade-typescript-sdk";

const client = new Snaptrade({
  clientId: process.env.SNAPTRADE_CLIENT_ID,
  consumerKey: process.env.SNAPTRADE_CONSUMER_KEY,
});

const userId = process.argv[2];
if (!userId) {
  console.error("Usage: node scripts/delete-snaptrade-user.mjs <userId>");
  process.exit(1);
}

try {
  const res = await client.authentication.deleteSnapTradeUser({ userId });
  console.log("Deleted:", JSON.stringify(res.data, null, 2));
} catch (err) {
  console.error("Status:", err.status);
  console.error("Body:", JSON.stringify(err.responseBody, null, 2));
  process.exit(1);
}
