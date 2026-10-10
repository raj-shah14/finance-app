/**
 * Keys for "always categorize this merchant as X" rules.
 *
 * Card/merchant purchases carry a clean merchant_name ("starbucks"), which
 * is a fine key. Bank (ACH/wire) rows usually don't, so the key used to be
 * the whole descriptor — which for things like card autopays embeds a
 * per-payment ID ("CITI AUTOPAY DES:PAYMENT ID:XXXXXXXXXX40100 INDN:…").
 * A rule saved from one month's payment then never matched the next month's,
 * so the same correction had to be repeated forever.
 *
 * For descriptors without a merchant name we now also derive a key with the
 * variable parts removed. Lookups try the exact (old-style) key first, so
 * every rule saved before this change keeps working; new rules are saved
 * under the normalized key.
 */

/** Strip the parts of a bank descriptor that change from payment to payment. */
export function normalizeDescriptor(name: string): string {
  return (
    name
      .toLowerCase()
      // "ID:XXXXXXXXXX40100", "CO ID:CITICARDAP", "ID: 1343"
      .replace(/\bid:\s*\S+/g, " ")
      // "Confirmation# XXXXX77401", "ref: 8837364" — needs the # or : so a
      // word like "refund" is left alone.
      .replace(/\b(?:confirmation|conf|ref(?:erence)?)\s*[#:]\s*\S+/g, " ")
      // masked runs ("xxxxx77401") and long digit runs (trace/auth numbers);
      // short numbers like an account's last four digits are kept.
      .replace(/\bx{3,}\d*\b/g, " ")
      .replace(/\b\d{5,}\b/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

export function merchantRuleKeys(
  merchantName: string | null | undefined,
  name: string
): { raw: string; normalized: string } {
  const raw = (merchantName || name).toLowerCase();
  // A real merchant name is already stable — only descriptors get cleaned.
  if (merchantName) return { raw, normalized: raw };
  return { raw, normalized: normalizeDescriptor(name) || raw };
}

/** The category a saved rule assigns to this transaction, if any. */
export function findMerchantRuleCategory(
  rules: Record<string, string>,
  merchantName: string | null | undefined,
  name: string
): string | null {
  const { raw, normalized } = merchantRuleKeys(merchantName, name);
  return rules[raw] ?? rules[normalized] ?? null;
}
