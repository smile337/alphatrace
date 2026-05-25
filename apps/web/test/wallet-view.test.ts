import { describe, expect, it } from "vitest";
import { toWalletViewModel, type SmartWalletApiDto } from "../src/lib/wallet-view";

describe("wallet view model", () => {
  it("turns raw profitability metrics into a clear follow decision", () => {
    const wallet = toWalletViewModel(createWallet({
      decisionProfitUsd: 9,
      realizedPnl30dUsd: 9,
      costCoveragePct: 13,
      openPositionCount: 20,
      stablecoinNetFlowUsd: -675,
      tradeCount30d: 47,
      winCount30d: 2,
      lossCount30d: 1
    }));

    expect(wallet.followAdvice).toEqual({
      level: "watch",
      label: "观察",
      actionLabel: "加入观察",
      tone: "amber",
      reason: "收益为正，但闭合样本少、未闭合仓位多，不适合直接重仓跟。"
    });
    expect(wallet.decisionSignals).toEqual([
      {
        label: "盈利能力",
        level: "弱",
        tone: "amber",
        detail: "近 30 日已实现 +9，闭合盈利样本 3 笔。"
      },
      {
        label: "数据可信",
        level: "中",
        tone: "amber",
        detail: "链上闭环收益可信，但成本覆盖只有 13%。"
      },
      {
        label: "仓位风险",
        level: "高",
        tone: "red",
        detail: "仍有 20 个未闭合仓位，报价资产净额 -675。"
      }
    ]);
  });

  it("marks mature profitable wallets as directly followable", () => {
    const wallet = toWalletViewModel(createWallet({
      decisionProfitUsd: 2400,
      realizedPnl30dUsd: 2400,
      costCoveragePct: 72,
      openPositionCount: 2,
      stablecoinNetFlowUsd: 600,
      tradeCount30d: 38,
      winCount30d: 21,
      lossCount30d: 7
    }));

    expect(wallet.followAdvice).toMatchObject({
      level: "follow",
      label: "可跟单",
      actionLabel: "跟单此钱包",
      tone: "green"
    });
    expect(wallet.decisionSignals.map((signal) => `${signal.label}:${signal.level}`)).toEqual([
      "盈利能力:强",
      "数据可信:高",
      "仓位风险:低"
    ]);
  });
});

function createWallet(input: {
  decisionProfitUsd: number;
  realizedPnl30dUsd: number;
  costCoveragePct: number;
  openPositionCount: number;
  stablecoinNetFlowUsd: number;
  tradeCount30d: number;
  winCount30d: number;
  lossCount30d: number;
}): SmartWalletApiDto {
  return {
    address: "HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC",
    chain: "solana",
    score: 84,
    winRate: 0.82,
    realizedPnl30dUsd: input.realizedPnl30dUsd,
    maxDrawdown30d: 0.08,
    riskLabel: "high_win_rate_low_frequency",
    performance: {
      tradeCount30d: input.tradeCount30d,
      winCount30d: input.winCount30d,
      lossCount30d: input.lossCount30d,
      estimatedProfit30dUsd: input.realizedPnl30dUsd,
      decisionProfitUsd: input.decisionProfitUsd,
      stablecoinNetFlowUsd: input.stablecoinNetFlowUsd,
      costCoveragePct: input.costCoveragePct,
      openPositionCount: input.openPositionCount,
      profitConfidence: "high",
      profitSignal: "realized",
      avgTradeSizeUsd: Math.round(input.realizedPnl30dUsd / Math.max(1, input.winCount30d + input.lossCount30d)),
      largestWinUsd: 10,
      largestLossUsd: -1,
      lastTradeAt: "2026-05-24T01:36:00.000Z",
      updatedAt: "2026-05-24T01:40:00.000Z",
      dataSource: "helius_enhanced_transactions",
      profitBasis: "quote_asset_fifo_realized"
    }
  };
}
