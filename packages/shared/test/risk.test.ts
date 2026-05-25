import { describe, expect, it } from "vitest";
import { evaluateRisk } from "../src/index";

describe("copy-trading risk engine", () => {
  const baseIntent = {
    tokenMint: "So11111111111111111111111111111111111111112",
    inputAmountUsd: 50,
    liquidityUsd: 100_000,
    expectedSlippageBps: 150,
    walletScore: 82,
    dailyLossUsd: 0,
    userDailyLossLimitUsd: 100,
    userSingleTradeLimitUsd: 100,
    emergencyPaused: false,
    blacklist: [] as string[]
  };

  it("approves a trade that stays inside all risk limits", () => {
    expect(evaluateRisk(baseIntent)).toEqual({
      allowed: true,
      reasons: []
    });
  });

  it("rejects paused, oversized, illiquid, high slippage, low-score, and blacklisted trades", () => {
    const decision = evaluateRisk({
      ...baseIntent,
      emergencyPaused: true,
      inputAmountUsd: 250,
      liquidityUsd: 2_000,
      expectedSlippageBps: 900,
      walletScore: 30,
      dailyLossUsd: 120,
      blacklist: [baseIntent.tokenMint]
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toEqual([
      "EMERGENCY_PAUSED",
      "SINGLE_TRADE_LIMIT_EXCEEDED",
      "DAILY_LOSS_LIMIT_EXCEEDED",
      "LOW_LIQUIDITY",
      "SLIPPAGE_TOO_HIGH",
      "SMART_WALLET_SCORE_TOO_LOW",
      "TOKEN_BLACKLISTED"
    ]);
  });
});
