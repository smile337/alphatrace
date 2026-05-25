import { describe, expect, it } from "vitest";
import {
  analyzeSmartWalletFromTransactions,
  assertSolanaAddress,
  extractCandidateWallets,
  isEligibleSmartWallet,
  WSOL_MINT
} from "../src/smart-wallet-analysis";

describe("smart wallet analysis", () => {
  it("rejects invalid Solana wallet addresses before import", () => {
    expect(() => assertSolanaAddress("SmartWallet111111111111111111111111111111111")).toThrow("Invalid Solana wallet address");
  });

  it("scores a wallet from parsed Helius swap activity", () => {
    const wallet = analyzeSmartWalletFromTransactions({
      address: "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV",
      transactions: [
        { type: "SWAP", timestamp: 1_770_000_000, nativeTransfers: [], tokenTransfers: [{ tokenAmount: 100 }] },
        { type: "SWAP", timestamp: 1_770_010_000, nativeTransfers: [], tokenTransfers: [{ tokenAmount: 80 }] },
        { type: "TRANSFER", timestamp: 1_770_020_000, nativeTransfers: [], tokenTransfers: [] }
      ]
    });

    expect(wallet).toMatchObject({
      address: "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV",
      chain: "solana",
      score: 76,
      winRate: 0.67,
      riskLabel: "active_swap_wallet",
      performance: {
        tradeCount30d: 2,
        winCount30d: 0,
        lossCount30d: 0,
        decisionProfitUsd: null,
        profitConfidence: "low",
        profitSignal: "insufficient_data",
        dataSource: "helius_enhanced_transactions"
      }
    });
    expect(wallet.realizedPnl30dUsd).toBe(0);
    expect(wallet.maxDrawdown30d).toBeGreaterThan(0);
    expect(wallet.performance?.estimatedProfit30dUsd).toBe(wallet.realizedPnl30dUsd);
    expect(wallet.performance?.avgTradeSizeUsd).toBe(0);
    expect(wallet.performance?.lastTradeAt).toBe("2026-02-02T05:26:40.000Z");
  });

  it("computes strict realized profit only from stablecoin cost-basis round trips", () => {
    const wallet = analyzeSmartWalletFromTransactions({
      address: "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV",
      transactions: [
        {
          type: "SWAP",
          timestamp: 1_770_000_000,
          tokenTransfers: [
            {
              mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
              tokenAmount: 100,
              fromUserAccount: "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV",
              toUserAccount: "pool"
            },
            {
              mint: "Token11111111111111111111111111111111111111",
              tokenAmount: 10,
              fromUserAccount: "pool",
              toUserAccount: "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV"
            }
          ]
        },
        {
          type: "SWAP",
          timestamp: 1_770_010_000,
          tokenTransfers: [
            {
              mint: "Token11111111111111111111111111111111111111",
              tokenAmount: 5,
              fromUserAccount: "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV",
              toUserAccount: "pool"
            },
            {
              mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
              tokenAmount: 80,
              fromUserAccount: "pool",
              toUserAccount: "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV"
            }
          ]
        }
      ]
    });

    expect(wallet.realizedPnl30dUsd).toBe(30);
    expect(wallet.performance).toMatchObject({
      estimatedProfit30dUsd: 30,
      decisionProfitUsd: 30,
      stablecoinNetFlowUsd: -20,
      costCoveragePct: 50,
      openPositionCount: 1,
      profitConfidence: "high",
      profitSignal: "realized",
      winCount30d: 1,
      lossCount30d: 0,
      largestWinUsd: 30,
      largestLossUsd: 0,
      profitBasis: "quote_asset_fifo_realized"
    });
  });

  it("computes realized profit from SOL quoted wallet round trips", () => {
    const walletAddress = "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV";
    const wallet = analyzeSmartWalletFromTransactions({
      address: walletAddress,
      quotePricesUsd: { [WSOL_MINT]: 100 },
      transactions: [
        {
          type: "TRANSFER",
          timestamp: 1_770_000_000,
          tokenTransfers: [
            {
              mint: WSOL_MINT,
              tokenAmount: 1,
              fromUserAccount: walletAddress,
              toUserAccount: "pool"
            },
            {
              mint: "Token11111111111111111111111111111111111111",
              tokenAmount: 10,
              fromUserAccount: "pool",
              toUserAccount: walletAddress
            }
          ]
        },
        {
          type: "CLOSE_ACCOUNT",
          timestamp: 1_770_010_000,
          tokenTransfers: [
            {
              mint: "Token11111111111111111111111111111111111111",
              tokenAmount: 10,
              fromUserAccount: walletAddress,
              toUserAccount: "pool"
            },
            {
              mint: WSOL_MINT,
              tokenAmount: 1.4,
              fromUserAccount: "pool",
              toUserAccount: walletAddress
            }
          ]
        }
      ]
    });

    expect(wallet.performance).toMatchObject({
      tradeCount30d: 2,
      estimatedProfit30dUsd: 40,
      decisionProfitUsd: 40,
      stablecoinNetFlowUsd: 40,
      profitConfidence: "high",
      profitSignal: "realized",
      winCount30d: 1,
      lossCount30d: 0
    });
    expect(isEligibleSmartWallet(wallet)).toBe(true);
  });

  it("extracts real wallet candidates from Helius swap transactions", () => {
    const candidates = extractCandidateWallets([
      {
        type: "SWAP",
        feePayer: "5hNQovY7mscduGNGVYBchecUPzNdnNHTTeFt85t58sq1",
        tokenTransfers: [
          {
            tokenAmount: 100,
            fromUserAccount: "So11111111111111111111111111111111111111112",
            toUserAccount: "HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC"
          }
        ]
      },
      {
        type: "TRANSFER",
        feePayer: "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV"
      }
    ]);

    expect(candidates).toEqual([
      "5hNQovY7mscduGNGVYBchecUPzNdnNHTTeFt85t58sq1",
      "HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC"
    ]);
  });

  it("marks only scored recent swap wallets as eligible for display", () => {
    expect(
      isEligibleSmartWallet({
        address: "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV",
        chain: "solana",
        score: 71,
        winRate: 0.58,
        realizedPnl30dUsd: 4200,
        maxDrawdown30d: 0.22,
        riskLabel: "active_swap_wallet",
        performance: {
          tradeCount30d: 8,
          winCount30d: 5,
          lossCount30d: 3,
          estimatedProfit30dUsd: 4200,
          decisionProfitUsd: 4200,
          profitSignal: "realized",
          profitConfidence: "high",
          avgTradeSizeUsd: 525,
          largestWinUsd: 1800,
          largestLossUsd: -300,
          lastTradeAt: "2026-05-20T00:00:00.000Z",
          updatedAt: "2026-05-20T00:00:00.000Z",
          dataSource: "helius_enhanced_transactions"
        }
      })
    ).toBe(true);
    expect(
      isEligibleSmartWallet({
        address: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
        chain: "solana",
        score: 84,
        winRate: 0.82,
        realizedPnl30dUsd: 0,
        maxDrawdown30d: 0.08,
        riskLabel: "high_win_rate_low_frequency",
        performance: {
          tradeCount30d: 99,
          winCount30d: 0,
          lossCount30d: 0,
          estimatedProfit30dUsd: 0,
          decisionProfitUsd: null,
          profitSignal: "insufficient_data",
          profitConfidence: "low",
          avgTradeSizeUsd: 0,
          largestWinUsd: 0,
          largestLossUsd: 0,
          lastTradeAt: "2026-05-20T00:00:00.000Z",
          updatedAt: "2026-05-20T00:00:00.000Z",
          dataSource: "helius_enhanced_transactions"
        }
      })
    ).toBe(false);
    expect(
      isEligibleSmartWallet({
        address: "5hNQovY7mscduGNGVYBchecUPzNdnNHTTeFt85t58sq1",
        chain: "solana",
        score: 35,
        winRate: 0.35,
        realizedPnl30dUsd: 0,
        maxDrawdown30d: 0.34,
        riskLabel: "no_recent_swaps"
      })
    ).toBe(false);
    expect(
      isEligibleSmartWallet({
        address: "HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC",
        chain: "solana",
        score: 84,
        winRate: 0.82,
        realizedPnl30dUsd: 10_000_000,
        maxDrawdown30d: 0.08,
        riskLabel: "high_win_rate_low_frequency"
      })
    ).toBe(false);
  });
});
