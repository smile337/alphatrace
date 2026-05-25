import { describe, expect, it, vi } from "vitest";
import { runTradeIntentExecution } from "../src/lib/trade-intent-execution";

describe("Mini App trade intent execution orchestration", () => {
  it("does not call execute when wallet signing is rejected", async () => {
    const sign = vi.fn(async () => ({ ok: false as const, code: "SIGNATURE_REJECTED" as const }));
    const execute = vi.fn();

    const result = await runTradeIntentExecution({
      intentId: "intent_1",
      transaction: "unsigned_tx",
      sign,
      execute
    });

    expect(sign).toHaveBeenCalledWith({ transaction: "unsigned_tx" });
    expect(execute).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, stage: "signing", code: "SIGNATURE_REJECTED" });
  });

  it("executes the signed transaction after wallet signing succeeds", async () => {
    const sign = vi.fn(async () => ({ ok: true as const, signedTransaction: "signed_tx", source: "wallet" as const }));
    const execute = vi.fn(async () => ({
      ok: true as const,
      intent: {
        id: "intent_1",
        userId: "user_1",
        tokenMint: "Token111111111111111111111111111111111111111",
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: "1000000",
        amountUsd: 50,
        status: "succeeded",
        riskReasons: [],
        jupiterRequestId: "req_1",
        signature: "sig_1"
      },
      result: { status: "Success" as const, signature: "sig_1", code: 0 }
    }));

    const result = await runTradeIntentExecution({
      intentId: "intent_1",
      transaction: "unsigned_tx",
      sign,
      execute
    });

    expect(execute).toHaveBeenCalledWith({ intentId: "intent_1", signedTransaction: "signed_tx" });
    expect(result).toMatchObject({ ok: true, executeResult: { result: { status: "Success", signature: "sig_1" } } });
  });
});
