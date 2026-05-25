import { PublicKey } from "@solana/web3.js";
import type { SmartWalletDto } from "./app";

export interface HeliusEnhancedTransaction {
  type?: string;
  feePayer?: string;
  timestamp?: number;
  nativeTransfers?: unknown[];
  tokenTransfers?: Array<{
    mint?: string;
    tokenAmount?: number;
    fromUserAccount?: string;
    toUserAccount?: string;
  }>;
}

export const DEFAULT_SMART_WALLET_MIN_SCORE = 60;
export const MAX_SMART_WALLET_ACTIVITY_USD_PROXY = 250_000;

const EXCLUDED_CANDIDATE_ADDRESSES = new Set([
  "11111111111111111111111111111111",
  "So11111111111111111111111111111111111111112",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  "ComputeBudget111111111111111111111111111111"
]);
const STABLECOIN_MINTS = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoUhxwYDB3bYbeQ6g4J"
]);
export const WSOL_MINT = "So11111111111111111111111111111111111111112";

export function assertSolanaAddress(address: string): string {
  try {
    return new PublicKey(address).toBase58();
  } catch {
    throw new Error("Invalid Solana wallet address");
  }
}

export function analyzeSmartWalletFromTransactions(input: {
  address: string;
  transactions: HeliusEnhancedTransaction[];
  quotePricesUsd?: Record<string, number>;
}): SmartWalletDto {
  const address = assertSolanaAddress(input.address);
  const quotePricesUsd = normalizeQuotePrices(input.quotePricesUsd);
  const trades = input.transactions.filter((transaction) => transaction.type === "SWAP" || hasWalletQuoteTrade(address, transaction, quotePricesUsd));
  const transferVolume = trades.reduce((total, transaction) => {
    return total + (transaction.tokenTransfers ?? []).reduce((sum, transfer) => sum + Math.abs(transfer.tokenAmount ?? 0), 0);
  }, 0);
  const activityScore = Math.min(30, trades.length * 12);
  const volumeScore = Math.min(20, Math.round(Math.log10(Math.max(transferVolume, 1)) * 8));
  const score = Math.max(35, Math.min(95, 34 + activityScore + volumeScore));
  const winRate = Math.min(0.82, Math.max(0.35, Number((0.45 + trades.length * 0.11).toFixed(2))));
  const realized = calculateQuoteAssetRealizedPnl(address, trades, quotePricesUsd);
  const realizedPnl30dUsd = Math.round(realized.profitUsd);
  const decisionProfitUsd = realized.closedTrades > 0 ? realized.profitUsd : realized.hasQuoteFlow ? realized.quoteNetFlowUsd : null;
  const profitConfidence = realized.closedTrades > 0 ? "high" : realized.hasQuoteFlow ? "medium" : "low";
  const profitSignal = realized.closedTrades > 0 ? "realized" : realized.hasQuoteFlow ? "cash_flow" : "insufficient_data";
  const costCoveragePct =
    realized.closedTrades + realized.openPositionCount > 0 ? Math.round((realized.closedTrades / (realized.closedTrades + realized.openPositionCount)) * 100) : 0;
  const maxDrawdown30d = Number(Math.min(0.72, Math.max(0.08, 0.34 - trades.length * 0.06)).toFixed(2));
  const winCount30d = realized.wins;
  const lossCount30d = realized.losses;
  const avgTradeSizeUsd = realized.closedTrades > 0 ? Math.round(realized.proceedsUsd / realized.closedTrades) : 0;
  const largestWinUsd = Math.round(realized.largestWinUsd);
  const largestLossUsd = Math.round(realized.largestLossUsd);
  const lastTradeAt = latestTimestampIso(trades);

  return {
    address,
    chain: "solana",
    score,
    winRate,
    realizedPnl30dUsd,
    maxDrawdown30d,
    riskLabel: riskLabelFor({ score, swaps: trades.length, maxDrawdown30d }),
    performance: {
      tradeCount30d: trades.length,
      winCount30d,
      lossCount30d,
      estimatedProfit30dUsd: realizedPnl30dUsd,
      decisionProfitUsd: decisionProfitUsd === null ? null : Math.round(decisionProfitUsd),
      stablecoinNetFlowUsd: Math.round(realized.quoteNetFlowUsd),
      costCoveragePct,
      openPositionCount: realized.openPositionCount,
      profitConfidence,
      profitSignal,
      avgTradeSizeUsd,
      largestWinUsd,
      largestLossUsd,
      lastTradeAt,
      updatedAt: new Date().toISOString(),
      dataSource: "helius_enhanced_transactions",
      profitBasis: "quote_asset_fifo_realized"
    }
  };
}

export function extractCandidateWallets(transactions: HeliusEnhancedTransaction[], limit = 10): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();

  for (const transaction of transactions) {
    if (transaction.type !== "SWAP") continue;
    addCandidate(transaction.feePayer, candidates, seen, limit);
    for (const transfer of transaction.tokenTransfers ?? []) {
      addCandidate(transfer.fromUserAccount, candidates, seen, limit);
      addCandidate(transfer.toUserAccount, candidates, seen, limit);
    }
    if (candidates.length >= limit) break;
  }

  return candidates;
}

export function isEligibleSmartWallet(wallet: SmartWalletDto, minScore = DEFAULT_SMART_WALLET_MIN_SCORE): boolean {
  const decisionProfitUsd = wallet.performance?.decisionProfitUsd;
  const hasActionableProfit =
    typeof decisionProfitUsd === "number" && decisionProfitUsd > 0 && wallet.performance?.profitSignal !== "insufficient_data";

  return (
    wallet.score >= minScore &&
    wallet.riskLabel !== "no_recent_swaps" &&
    wallet.riskLabel !== "high_risk_do_not_auto_copy" &&
    wallet.realizedPnl30dUsd <= MAX_SMART_WALLET_ACTIVITY_USD_PROXY &&
    hasActionableProfit
  );
}

function riskLabelFor(input: { score: number; swaps: number; maxDrawdown30d: number }): string {
  if (input.swaps === 0) return "no_recent_swaps";
  if (input.score >= 80 && input.maxDrawdown30d <= 0.2) return "high_win_rate_low_frequency";
  if (input.score >= 60) return "active_swap_wallet";
  return "high_risk_do_not_auto_copy";
}

function latestTimestampIso(transactions: HeliusEnhancedTransaction[]): string | null {
  const latestTimestamp = transactions.reduce((latest, transaction) => Math.max(latest, transaction.timestamp ?? 0), 0);
  return latestTimestamp > 0 ? new Date(latestTimestamp * 1000).toISOString() : null;
}

function calculateQuoteAssetRealizedPnl(
  walletAddress: string,
  swaps: HeliusEnhancedTransaction[],
  quotePricesUsd: Record<string, number>
) {
  const lots = new Map<string, Array<{ amount: number; unitCostUsd: number }>>();
  let profitUsd = 0;
  let proceedsUsd = 0;
  let stableInUsdTotal = 0;
  let stableOutUsdTotal = 0;
  let closedTrades = 0;
  let wins = 0;
  let losses = 0;
  let largestWinUsd = 0;
  let largestLossUsd = 0;

  for (const swap of swaps) {
    const transfers = swap.tokenTransfers ?? [];
    const quoteOutUsd = transfers
      .filter((transfer) => transfer.fromUserAccount === walletAddress && isQuoteAsset(transfer.mint, quotePricesUsd))
      .reduce((sum, transfer) => sum + quoteTransferUsd(transfer.mint, transfer.tokenAmount, quotePricesUsd), 0);
    const quoteInUsd = transfers
      .filter((transfer) => transfer.toUserAccount === walletAddress && isQuoteAsset(transfer.mint, quotePricesUsd))
      .reduce((sum, transfer) => sum + quoteTransferUsd(transfer.mint, transfer.tokenAmount, quotePricesUsd), 0);
    stableInUsdTotal += quoteInUsd;
    stableOutUsdTotal += quoteOutUsd;
    const tokenIn = transfers.find(
      (transfer) => transfer.toUserAccount === walletAddress && transfer.mint && !isQuoteAsset(transfer.mint, quotePricesUsd) && (transfer.tokenAmount ?? 0) > 0
    );
    const tokenOut = transfers.find(
      (transfer) => transfer.fromUserAccount === walletAddress && transfer.mint && !isQuoteAsset(transfer.mint, quotePricesUsd) && (transfer.tokenAmount ?? 0) > 0
    );

    if (quoteOutUsd > 0 && tokenIn?.mint && (tokenIn.tokenAmount ?? 0) > 0) {
      const amount = Math.abs(tokenIn.tokenAmount ?? 0);
      const walletLots = lots.get(tokenIn.mint) ?? [];
      walletLots.push({ amount, unitCostUsd: quoteOutUsd / amount });
      lots.set(tokenIn.mint, walletLots);
    }

    if (quoteInUsd > 0 && tokenOut?.mint && (tokenOut.tokenAmount ?? 0) > 0) {
      const amountSold = Math.abs(tokenOut.tokenAmount ?? 0);
      const costUsd = consumeCostBasis(lots.get(tokenOut.mint) ?? [], amountSold);
      if (costUsd === null) continue;
      const pnl = quoteInUsd - costUsd;
      profitUsd += pnl;
      proceedsUsd += quoteInUsd;
      closedTrades += 1;
      if (pnl >= 0) {
        wins += 1;
        largestWinUsd = Math.max(largestWinUsd, pnl);
      } else {
        losses += 1;
        largestLossUsd = Math.min(largestLossUsd, pnl);
      }
    }
  }

  const openPositionCount = Array.from(lots.values()).filter((walletLots) => walletLots.some((lot) => lot.amount > 0)).length;
  return {
    profitUsd,
    proceedsUsd,
    closedTrades,
    wins,
    losses,
    largestWinUsd,
    largestLossUsd,
    quoteNetFlowUsd: stableInUsdTotal - stableOutUsdTotal,
    hasQuoteFlow: stableInUsdTotal > 0 || stableOutUsdTotal > 0,
    openPositionCount
  };
}

function consumeCostBasis(lots: Array<{ amount: number; unitCostUsd: number }>, amount: number): number | null {
  let remaining = amount;
  let costUsd = 0;

  while (remaining > 0 && lots.length > 0) {
    const lot = lots[0];
    const used = Math.min(remaining, lot.amount);
    costUsd += used * lot.unitCostUsd;
    lot.amount -= used;
    remaining -= used;
    if (lot.amount <= 0) lots.shift();
  }

  return remaining <= 0 ? costUsd : null;
}

function normalizeQuotePrices(input: Record<string, number> | undefined): Record<string, number> {
  const prices: Record<string, number> = {};
  for (const mint of STABLECOIN_MINTS) prices[mint] = 1;
  if (input) {
    for (const [mint, price] of Object.entries(input)) {
      if (Number.isFinite(price) && price > 0) prices[mint] = price;
    }
  }
  return prices;
}

function isQuoteAsset(mint: string | undefined, quotePricesUsd: Record<string, number>): boolean {
  return Boolean(mint && quotePricesUsd[mint]);
}

function quoteTransferUsd(mint: string | undefined, tokenAmount: number | undefined, quotePricesUsd: Record<string, number>): number {
  if (!mint) return 0;
  return Math.abs(tokenAmount ?? 0) * (quotePricesUsd[mint] ?? 0);
}

function hasWalletQuoteTrade(walletAddress: string, transaction: HeliusEnhancedTransaction, quotePricesUsd: Record<string, number>): boolean {
  const transfers = transaction.tokenTransfers ?? [];
  const hasQuoteLeg = transfers.some(
    (transfer) =>
      (transfer.fromUserAccount === walletAddress || transfer.toUserAccount === walletAddress) && isQuoteAsset(transfer.mint, quotePricesUsd)
  );
  const hasTokenLeg = transfers.some(
    (transfer) =>
      (transfer.fromUserAccount === walletAddress || transfer.toUserAccount === walletAddress) && transfer.mint && !isQuoteAsset(transfer.mint, quotePricesUsd)
  );
  return hasQuoteLeg && hasTokenLeg;
}

function addCandidate(address: string | undefined, candidates: string[], seen: Set<string>, limit: number) {
  if (!address || candidates.length >= limit) return;
  let normalized: string;
  try {
    normalized = assertSolanaAddress(address);
  } catch {
    return;
  }
  if (EXCLUDED_CANDIDATE_ADDRESSES.has(normalized) || seen.has(normalized)) return;
  seen.add(normalized);
  candidates.push(normalized);
}
