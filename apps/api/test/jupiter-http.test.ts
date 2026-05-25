import { describe, expect, it } from "vitest";
import { buildJupiterOrderSearchParams } from "../src/jupiter-http";

describe("Jupiter HTTP client", () => {
  const orderInput = {
    inputMint: "So11111111111111111111111111111111111111112",
    outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    amount: "1000000",
    taker: "Taker111111111111111111111111111111111111",
    referralFeeBps: 75
  };

  it("omits referral fee when no referral account is configured", () => {
    const params = buildJupiterOrderSearchParams(orderInput);

    expect(params.get("inputMint")).toBe(orderInput.inputMint);
    expect(params.get("referralFee")).toBeNull();
    expect(params.get("referralAccount")).toBeNull();
  });

  it("sends referral fee with referral account when configured", () => {
    const params = buildJupiterOrderSearchParams({
      ...orderInput,
      referralAccount: "Referral11111111111111111111111111111111111"
    });

    expect(params.get("referralFee")).toBe("75");
    expect(params.get("referralAccount")).toBe("Referral11111111111111111111111111111111111");
  });
});
