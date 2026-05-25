import { describe, expect, it } from "vitest";
import { VersionedTransaction } from "@solana/web3.js";
import { createDemoJupiterOrder } from "../src/demo-jupiter";

describe("Demo Jupiter responses", () => {
  it("returns a base64 versioned transaction that browser wallets can deserialize", async () => {
    const order = createDemoJupiterOrder({
      amount: "1000000",
      inputMint: "So11111111111111111111111111111111111111112",
      referralFeeBps: 50
    });

    const transaction = VersionedTransaction.deserialize(Buffer.from(order.transaction, "base64"));

    expect(order).toMatchObject({
      requestId: "demo_request",
      outAmount: "1000000",
      feeBps: 50,
      feeMint: "So11111111111111111111111111111111111111112"
    });
    expect(transaction.message.staticAccountKeys.length).toBeGreaterThan(0);
  });
});
