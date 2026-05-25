import { describe, expect, it } from "vitest";
import { describeTradeIntentExecuteFailure } from "../src/lib/trade-intent-errors";

describe("Mini App trade intent error messages", () => {
  it("maps execute API error codes to specific user-facing copy", () => {
    expect(describeTradeIntentExecuteFailure({ ok: false, code: "JUPITER_EXECUTE_FAILED" })).toBe("Jupiter 执行失败，请稍后重试");
    expect(describeTradeIntentExecuteFailure({ ok: false, code: "TRADE_INTENT_ALREADY_SUBMITTED" })).toBe("交易已提交，请等待确认");
    expect(describeTradeIntentExecuteFailure({ ok: false, code: "INVALID_SIGNED_TRANSACTION" })).toBe("钱包签名无效，请重新生成交易");
    expect(describeTradeIntentExecuteFailure({ ok: false, code: "TRADE_INTENT_NOT_READY" })).toBe("交易状态已变化，请重新生成交易");
  });

  it("maps a failed Jupiter result to its upstream error when present", () => {
    expect(
      describeTradeIntentExecuteFailure({
        ok: true,
        intent: {
          id: "intent_1",
          userId: "user_1",
          tokenMint: "Token111111111111111111111111111111111111111",
          inputMint: "So11111111111111111111111111111111111111112",
          outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          amount: "1000000",
          amountUsd: 50,
          status: "failed",
          riskReasons: [],
          jupiterRequestId: "req_1",
          signature: null
        },
        result: {
          status: "Failed",
          code: 9999,
          error: "Upstream liquidity route unavailable"
        }
      })
    ).toBe("Jupiter 执行失败：Upstream liquidity route unavailable");
  });

  it("maps common Jupiter execution errors to actionable copy", () => {
    const baseResult = {
      ok: true as const,
      intent: {
        id: "intent_1",
        userId: "user_1",
        tokenMint: "Token111111111111111111111111111111111111111",
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: "1000000",
        amountUsd: 50,
        status: "failed" as const,
        riskReasons: [],
        jupiterRequestId: "req_1",
        signature: null
      }
    };

    expect(
      describeTradeIntentExecuteFailure({
        ...baseResult,
        result: { status: "Failed", code: 6001, error: "Slippage tolerance exceeded" }
      })
    ).toBe("滑点超出设置，请提高滑点或重新生成报价");
    expect(
      describeTradeIntentExecuteFailure({
        ...baseResult,
        result: { status: "Failed", code: 1, error: "Blockhash not found" }
      })
    ).toBe("交易已过期，请重新生成交易");
    expect(
      describeTradeIntentExecuteFailure({
        ...baseResult,
        result: { status: "Failed", code: 1, error: "insufficient funds for fee" }
      })
    ).toBe("余额不足，请检查钱包 SOL 和代币余额");
  });
});
