import { Snaptrade } from "snaptrade-typescript-sdk";

/**
 * Shared SnapTrade SDK client.
 *
 * Required env:
 *   - SNAPTRADE_CLIENT_ID
 *   - SNAPTRADE_CONSUMER_KEY
 *
 * Sign up at https://snaptrade.com to obtain these. SnapTrade is used as
 * a secondary aggregator for brokerages/crypto exchanges that Plaid does
 * not reliably support (Robinhood, Coinbase, Fidelity, etc.).
 */
export const snapTradeClient = new Snaptrade({
  clientId: process.env.SNAPTRADE_CLIENT_ID || "",
  consumerKey: process.env.SNAPTRADE_CONSUMER_KEY || "",
});

export function snapTradeConfigured(): boolean {
  return Boolean(
    process.env.SNAPTRADE_CLIENT_ID && process.env.SNAPTRADE_CONSUMER_KEY
  );
}
