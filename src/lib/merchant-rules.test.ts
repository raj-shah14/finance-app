import { describe, expect, it } from "vitest";
import { findMerchantRuleCategory, merchantRuleKeys, normalizeDescriptor } from "@/lib/merchant-rules";

describe("normalizeDescriptor", () => {
  it("gives the same key for a recurring ACH autopay with a changing ID", () => {
    const july = "CITI AUTOPAY DES:PAYMENT ID:XXXXXXXXXX40100 INDN:RAJ SHAH CO ID:CITICARDAP WEB";
    const august = "CITI AUTOPAY DES:PAYMENT ID:XXXXXXXXXX71822 INDN:RAJ SHAH CO ID:CITICARDAP WEB";
    expect(normalizeDescriptor(july)).toBe(normalizeDescriptor(august));
    expect(normalizeDescriptor(july)).toBe("citi autopay des:payment indn:raj shah co web");
  });

  it("handles the other shapes seen on card payments", () => {
    expect(normalizeDescriptor("CHASE CREDIT CRD DES:AUTOPAY ID:XXXXXXXXXX26356 INDN:SHAH RAJ CO ID:XXXXX39224 PPD"))
      .toBe("chase credit crd des:autopay indn:shah raj co ppd");
    expect(normalizeDescriptor("DISCOVER DES:E-PAYMENT ID:1343 INDN:SHAH RAJ CO ID:XXXXX20270 WEB"))
      .toBe("discover des:e-payment indn:shah raj co web");
  });

  it("drops confirmation numbers but keeps a short account number", () => {
    expect(normalizeDescriptor("Online Scheduled Payment to ACCT# 3640 Confirmation# XXXXX77401"))
      .toBe("online scheduled payment to acct# 3640");
  });

  it("leaves a word like 'refund' alone", () => {
    expect(normalizeDescriptor("AMAZON REFUND ref: 8837364")).toBe("amazon refund");
    expect(normalizeDescriptor("Store refund")).toBe("store refund");
  });

  it("does not touch ordinary names", () => {
    expect(normalizeDescriptor("Whole Foods Market")).toBe("whole foods market");
    expect(normalizeDescriptor("Trader Joe's #123")).toBe("trader joe's #123");
  });

  it("strips long digit runs", () => {
    expect(normalizeDescriptor("POS DEBIT 1234567890 SHELL OIL")).toBe("pos debit shell oil");
  });
});

describe("merchantRuleKeys", () => {
  it("keeps a real merchant name as is", () => {
    expect(merchantRuleKeys("Starbucks", "STARBUCKS #1234 SEATTLE WA")).toEqual({ raw: "starbucks", normalized: "starbucks" });
  });

  it("normalizes a descriptor when there's no merchant name", () => {
    const k = merchantRuleKeys(null, "CITI AUTOPAY DES:PAYMENT ID:XXXXXXXXXX40100 INDN:RAJ SHAH CO ID:CITICARDAP WEB");
    expect(k.raw).toContain("xxxxxxxxxx40100");
    expect(k.normalized).toBe("citi autopay des:payment indn:raj shah co web");
  });

  it("falls back to the raw key rather than an empty one", () => {
    expect(merchantRuleKeys(null, "ID:123456789").normalized).toBe("id:123456789");
  });
});

describe("findMerchantRuleCategory", () => {
  const descriptor = (id: string) => `CITI AUTOPAY DES:PAYMENT ID:XXXXXXXXXX${id} INDN:RAJ SHAH CO ID:CITICARDAP WEB`;

  it("matches next month's payment against a rule saved under the normalized key", () => {
    const rules = { [merchantRuleKeys(null, descriptor("40100")).normalized]: "cat_cc_bill" };
    expect(findMerchantRuleCategory(rules, null, descriptor("71822"))).toBe("cat_cc_bill");
  });

  it("still honors rules saved before this change, under the exact descriptor", () => {
    const rules = { [descriptor("40100").toLowerCase()]: "cat_old" };
    expect(findMerchantRuleCategory(rules, null, descriptor("40100"))).toBe("cat_old");
    // …but an old exact-ID rule can't match a different ID, which is the bug being fixed.
    expect(findMerchantRuleCategory(rules, null, descriptor("71822"))).toBeNull();
  });

  it("prefers an exact old-style rule over the normalized one", () => {
    const rules = {
      [descriptor("40100").toLowerCase()]: "cat_exact",
      [merchantRuleKeys(null, descriptor("40100")).normalized]: "cat_normalized",
    };
    expect(findMerchantRuleCategory(rules, null, descriptor("40100"))).toBe("cat_exact");
  });

  it("matches a merchant-name rule", () => {
    expect(findMerchantRuleCategory({ starbucks: "cat_dining" }, "Starbucks", "STARBUCKS #1234")).toBe("cat_dining");
  });

  it("returns null when nothing matches", () => {
    expect(findMerchantRuleCategory({}, null, "Some Merchant")).toBeNull();
  });
});
