import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { DEMO_TAKER_PUBLIC_KEY } from "../src/lib/demo-wallet";

describe("demo wallet defaults", () => {
  it("uses a syntactically valid Solana public key for Jupiter preview orders", () => {
    expect(new PublicKey(DEMO_TAKER_PUBLIC_KEY).toBase58()).toBe(DEMO_TAKER_PUBLIC_KEY);
  });
});
