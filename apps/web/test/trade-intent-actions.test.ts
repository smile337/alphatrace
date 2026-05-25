import { describe, expect, it, vi } from "vitest";
import { createTradeIntent, createTradeIntentOrder, executeTradeIntent } from "../src/lib/trade-intent-actions";

describe("Mini App trade intent actions", () => {
  it("creates trade intents through the same-origin proxy", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        intent: {
          id: "intent_1",
          userId: "tg_1001",
          tokenMint: "Token111111111111111111111111111111111111111",
          inputMint: "So11111111111111111111111111111111111111112",
          outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          amount: "1000000",
          amountUsd: 50,
          status: "needs_user_confirmation",
          riskReasons: [],
          jupiterRequestId: null,
          signature: null
        }
      })
    })) as unknown as typeof fetch;

    const result = await createTradeIntent({
      userId: "tg_1001",
      tokenMint: "Token111111111111111111111111111111111111111",
      inputMint: "So11111111111111111111111111111111111111112",
      outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      amount: "1000000",
      amountUsd: 50,
      riskReasons: [],
      fetcher
    });

    expect(fetcher).toHaveBeenCalledWith("/api/trade-intents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "tg_1001",
        tokenMint: "Token111111111111111111111111111111111111111",
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: "1000000",
        amountUsd: 50,
        riskReasons: []
      })
    });
    expect(result).toMatchObject({ ok: true, intent: { id: "intent_1" } });
  });

  it("creates orders for trade intents through the same-origin proxy", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        intent: { id: "intent_1", status: "ready_for_signature", jupiterRequestId: "req_1" },
        order: { requestId: "req_1", transaction: "base64tx" },
        executionFeeBps: 50
      })
    })) as unknown as typeof fetch;

    const result = await createTradeIntentOrder({
      intentId: "intent_1",
      planId: "elite",
      taker: "Taker111111111111111111111111111111111111",
      fetcher
    });

    expect(fetcher).toHaveBeenCalledWith("/api/trade-intents/intent_1/order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        planId: "elite",
        taker: "Taker111111111111111111111111111111111111"
      })
    });
    expect(result).toMatchObject({
      ok: true,
      order: { requestId: "req_1", transaction: "base64tx" },
      executionFeeBps: 50
    });
  });

  it("keeps Jupiter order failure details from the same-origin proxy", async () => {
    const result = await createTradeIntentOrder({
      intentId: "intent_1",
      planId: "pro",
      taker: "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV",
      fetcher: vi.fn(async () => ({
        ok: false,
        json: async () => ({
          code: "JUPITER_ORDER_UNAVAILABLE",
          errorMessage: "Insufficient funds"
        })
      })) as unknown as typeof fetch
    });

    expect(result).toEqual({
      ok: false,
      code: "JUPITER_ORDER_UNAVAILABLE",
      errorMessage: "Insufficient funds"
    });
  });

  it("executes ready trade intents through the same-origin proxy", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        intent: { id: "intent_1", status: "succeeded", signature: "sig_1" },
        result: { status: "Success", signature: "sig_1", code: 0 }
      })
    })) as unknown as typeof fetch;

    const result = await executeTradeIntent({
      intentId: "intent_1",
      signedTransaction: "signed_base64tx",
      fetcher
    });

    expect(fetcher).toHaveBeenCalledWith("/api/trade-intents/intent_1/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signedTransaction: "signed_base64tx" })
    });
    expect(result).toMatchObject({
      ok: true,
      intent: { status: "succeeded", signature: "sig_1" },
      result: { status: "Success", signature: "sig_1" }
    });
  });
});
