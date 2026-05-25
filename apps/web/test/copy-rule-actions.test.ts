import { describe, expect, it, vi } from "vitest";
import { saveCopyRule } from "../src/lib/copy-rule-actions";

describe("Mini App copy rule actions", () => {
  it("posts copy rules through the same-origin proxy", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        rule: {
          id: "rule_1",
          userId: "tg_1001",
          walletAddress: "SmartWallet111111111111111111111111111111111",
          maxSingleTradeUsd: 50,
          maxDailyLossUsd: 100,
          maxSlippageBps: 300,
          blacklist: [],
          mode: "auto",
          emergencyPaused: false
        }
      })
    })) as unknown as typeof fetch;

    const result = await saveCopyRule({
      userId: "tg_1001",
      planId: "elite",
      walletAddress: "SmartWallet111111111111111111111111111111111",
      maxSingleTradeUsd: 50,
      maxDailyLossUsd: 100,
      maxSlippageBps: 300,
      blacklist: [],
      fetcher
    });

    expect(fetcher).toHaveBeenCalledWith("/api/copy-rules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "tg_1001",
        planId: "elite",
        walletAddress: "SmartWallet111111111111111111111111111111111",
        maxSingleTradeUsd: 50,
        maxDailyLossUsd: 100,
        maxSlippageBps: 300,
        blacklist: []
      })
    });
    expect(result).toMatchObject({
      ok: true,
      rule: {
        id: "rule_1",
        mode: "auto",
        emergencyPaused: false
      }
    });
  });

  it("returns API errors without throwing", async () => {
    const result = await saveCopyRule({
      userId: "tg_1001",
      planId: "free",
      walletAddress: "SmartWallet111111111111111111111111111111111",
      maxSingleTradeUsd: 50,
      maxDailyLossUsd: 100,
      maxSlippageBps: 300,
      blacklist: [],
      fetcher: vi.fn(async () => ({
        ok: false,
        json: async () => ({ code: "COPY_TRADING_REQUIRES_PRO" })
      })) as unknown as typeof fetch
    });

    expect(result).toEqual({ ok: false, code: "COPY_TRADING_REQUIRES_PRO" });
  });
});
