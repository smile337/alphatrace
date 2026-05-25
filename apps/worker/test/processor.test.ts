import { describe, expect, it } from "vitest";
import { processWalletTradeEvent } from "../src/processor";

describe("wallet event processor", () => {
  it("creates an alert and trade intent for allowed Elite auto-copy rules", () => {
    const result = processWalletTradeEvent({
      event: {
        walletAddress: "SmartWallet111111111111111111111111111111111",
        tokenMint: "Token111111111111111111111111111111111111111",
        side: "buy",
        amountUsd: 50,
        liquidityUsd: 100_000,
        expectedSlippageBps: 120,
        walletScore: 84
      },
      rules: [
        {
          id: "rule_1",
          userId: "elite_user",
          planId: "elite",
          walletAddress: "SmartWallet111111111111111111111111111111111",
          maxSingleTradeUsd: 100,
          maxDailyLossUsd: 100,
          currentDailyLossUsd: 0,
          blacklist: [],
          emergencyPaused: false
        }
      ]
    });

    expect(result.alerts).toHaveLength(1);
    expect(result.tradeIntents).toEqual([
      expect.objectContaining({
        userId: "elite_user",
        mode: "auto",
        status: "ready_for_signature",
        tokenMint: "Token111111111111111111111111111111111111111"
      })
    ]);
  });

  it("records a blocked intent when risk rules reject the trade", () => {
    const result = processWalletTradeEvent({
      event: {
        walletAddress: "SmartWallet111111111111111111111111111111111",
        tokenMint: "Blocked111111111111111111111111111111111111",
        side: "buy",
        amountUsd: 500,
        liquidityUsd: 1_000,
        expectedSlippageBps: 900,
        walletScore: 20
      },
      rules: [
        {
          id: "rule_1",
          userId: "elite_user",
          planId: "elite",
          walletAddress: "SmartWallet111111111111111111111111111111111",
          maxSingleTradeUsd: 100,
          maxDailyLossUsd: 100,
          currentDailyLossUsd: 0,
          blacklist: ["Blocked111111111111111111111111111111111111"],
          emergencyPaused: false
        }
      ]
    });

    expect(result.tradeIntents[0]).toMatchObject({
      status: "blocked_by_risk",
      riskReasons: ["SINGLE_TRADE_LIMIT_EXCEEDED", "LOW_LIQUIDITY", "SLIPPAGE_TOO_HIGH", "SMART_WALLET_SCORE_TOO_LOW", "TOKEN_BLACKLISTED"]
    });
  });
});
