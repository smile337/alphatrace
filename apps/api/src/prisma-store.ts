import type { Prisma } from "@prisma/client";
import type { PrismaClient } from "@alphatrace/db";
import type { ApiStore, CopyRuleDto, SmartWalletDto, SmartWalletPerformanceDto, TradeIntentDto, WalletWatchDto } from "./app";

export function createPrismaApiStore(prisma: PrismaClient): ApiStore {
  return {
    async upsertTelegramUser(input) {
      const user = await prisma.user.upsert({
        where: { telegramId: BigInt(input.telegramId) },
        create: {
          telegramId: BigInt(input.telegramId),
          username: input.username,
          firstName: input.firstName
        },
        update: {
          username: input.username,
          firstName: input.firstName
        }
      });
      return {
        id: user.id,
        telegramId: Number(user.telegramId),
        username: user.username ?? undefined,
        firstName: user.firstName ?? undefined
      };
    },

    async listSmartWallets() {
      const wallets = await prisma.smartWallet.findMany({
        where: {
          NOT: {
            address: { startsWith: "SmartWallet" }
          }
        },
        select: smartWalletSelect,
        orderBy: { score: "desc" }
      });
      return wallets.map(toSmartWalletDto);
    },

    async getSmartWallet(address) {
      const wallet = await prisma.smartWallet.findFirst({
        where: {
          address,
          NOT: {
            address: { startsWith: "SmartWallet" }
          }
        },
        select: smartWalletSelect
      });
      return wallet ? toSmartWalletDto(wallet) : null;
    },

    async upsertSmartWallet(input) {
      const wallet = await prisma.smartWallet.upsert({
        where: { address: input.address },
        create: {
          ...input,
          performance: toJsonPerformance(input.performance)
        },
        update: {
          ...input,
          performance: toJsonPerformance(input.performance)
        },
        select: smartWalletSelect
      });
      return toSmartWalletDto(wallet);
    },

    async getActiveSubscription(userId) {
      const subscription = await prisma.subscription.findFirst({
        where: {
          userId,
          status: "active",
          expiresAt: { gt: new Date() }
        },
        orderBy: { expiresAt: "desc" }
      });
      return subscription
        ? {
            userId: subscription.userId,
            planId: subscription.planId,
            status: "active",
            expiresAt: subscription.expiresAt.toISOString()
          }
        : null;
    },

    async countWalletWatches(userId) {
      return prisma.walletWatch.count({ where: { userId } });
    },

    async upsertWalletWatch(input) {
      const userId = await ensureUserId(prisma, input.userId);
      const smartWallet = await ensureSmartWallet(prisma, input.walletAddress);
      const watch = await prisma.walletWatch.upsert({
        where: {
          userId_smartWalletId: {
            userId,
            smartWalletId: smartWallet.id
          }
        },
        create: {
          userId,
          smartWalletId: smartWallet.id,
          realtime: input.realtime
        },
        update: {
          realtime: input.realtime
        },
        include: {
          smartWallet: { select: { address: true } }
        }
      });
      return toWalletWatchDto(watch);
    },

    async upsertCopyRule(input) {
      const userId = await ensureUserId(prisma, input.userId);
      const smartWallet = await ensureSmartWallet(prisma, input.walletAddress);
      const rule = await prisma.copyRule.upsert({
        where: {
          userId_smartWalletId: {
            userId,
            smartWalletId: smartWallet.id
          }
        },
        create: {
          userId,
          smartWalletId: smartWallet.id,
          maxSingleTradeUsd: input.maxSingleTradeUsd,
          maxDailyLossUsd: input.maxDailyLossUsd,
          maxSlippageBps: input.maxSlippageBps,
          blacklist: input.blacklist
        },
        update: {
          maxSingleTradeUsd: input.maxSingleTradeUsd,
          maxDailyLossUsd: input.maxDailyLossUsd,
          maxSlippageBps: input.maxSlippageBps,
          blacklist: input.blacklist
        },
        include: {
          smartWallet: { select: { address: true } }
        }
      });
      return toCopyRuleDto(rule, input.mode);
    },

    async createTradeIntent(input) {
      const userId = await ensureUserId(prisma, input.userId);
      const intent = await prisma.tradeIntent.create({
        data: {
          userId,
          tokenMint: input.tokenMint,
          inputMint: input.inputMint,
          outputMint: input.outputMint,
          amount: input.amount,
          amountUsd: input.amountUsd,
          riskReasons: input.riskReasons,
          status: input.riskReasons.length > 0 ? "blocked_by_risk" : "needs_user_confirmation"
        }
      });
      return toTradeIntentDto(intent);
    },

    async listTradeIntents(userId) {
      const intents = await prisma.tradeIntent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 25
      });
      return intents.map(toTradeIntentDto);
    },

    async getTradeIntent(id) {
      const intent = await prisma.tradeIntent.findUnique({ where: { id } });
      return intent ? toTradeIntentDto(intent) : null;
    },

    async markTradeIntentReady(input) {
      const intent = await prisma.tradeIntent.update({
        where: { id: input.id },
        data: {
          status: "ready_for_signature",
          jupiterRequestId: input.jupiterRequestId
        }
      });
      return toTradeIntentDto(intent);
    },

    async markTradeIntentSubmitted(input) {
      const result = await prisma.tradeIntent.updateMany({
        where: { id: input.id, status: "ready_for_signature" },
        data: { status: "submitted" }
      });
      if (result.count === 0) {
        return null;
      }
      const intent = await prisma.tradeIntent.findUniqueOrThrow({ where: { id: input.id } });
      return toTradeIntentDto(intent);
    },

    async markTradeIntentExecuted(input) {
      const intent = await prisma.tradeIntent.update({
        where: { id: input.id },
        data: {
          status: input.status,
          signature: input.signature
        }
      });
      return toTradeIntentDto(intent);
    }
  };
}

const smartWalletSelect = {
  address: true,
  chain: true,
  score: true,
  winRate: true,
  realizedPnl30dUsd: true,
  maxDrawdown30d: true,
  riskLabel: true,
  performance: true
} as const;

function toSmartWalletDto(wallet: {
  address: string;
  chain: string;
  score: number;
  winRate: number;
  realizedPnl30dUsd: number;
  maxDrawdown30d: number;
  riskLabel: string;
  performance: unknown;
}): SmartWalletDto {
  return {
    address: wallet.address,
    chain: wallet.chain,
    score: wallet.score,
    winRate: wallet.winRate,
    realizedPnl30dUsd: wallet.realizedPnl30dUsd,
    maxDrawdown30d: wallet.maxDrawdown30d,
    riskLabel: wallet.riskLabel,
    performance: parseSmartWalletPerformance(wallet.performance)
  };
}

function parseSmartWalletPerformance(value: unknown): SmartWalletPerformanceDto | undefined {
  if (!value || typeof value !== "object") return undefined;
  const performance = value as Partial<SmartWalletPerformanceDto>;
  if (typeof performance.tradeCount30d !== "number" || typeof performance.estimatedProfit30dUsd !== "number") return undefined;
  return {
    tradeCount30d: performance.tradeCount30d,
    winCount30d: typeof performance.winCount30d === "number" ? performance.winCount30d : 0,
    lossCount30d: typeof performance.lossCount30d === "number" ? performance.lossCount30d : 0,
    estimatedProfit30dUsd: performance.estimatedProfit30dUsd,
    decisionProfitUsd: typeof performance.decisionProfitUsd === "number" ? performance.decisionProfitUsd : null,
    stablecoinNetFlowUsd: typeof performance.stablecoinNetFlowUsd === "number" ? performance.stablecoinNetFlowUsd : 0,
    costCoveragePct: typeof performance.costCoveragePct === "number" ? performance.costCoveragePct : 0,
    openPositionCount: typeof performance.openPositionCount === "number" ? performance.openPositionCount : 0,
    profitConfidence:
      performance.profitConfidence === "high" || performance.profitConfidence === "medium" || performance.profitConfidence === "low"
        ? performance.profitConfidence
        : "low",
    profitSignal:
      performance.profitSignal === "realized" || performance.profitSignal === "cash_flow" || performance.profitSignal === "insufficient_data"
        ? performance.profitSignal
        : "insufficient_data",
    avgTradeSizeUsd: typeof performance.avgTradeSizeUsd === "number" ? performance.avgTradeSizeUsd : 0,
    largestWinUsd: typeof performance.largestWinUsd === "number" ? performance.largestWinUsd : 0,
    largestLossUsd: typeof performance.largestLossUsd === "number" ? performance.largestLossUsd : 0,
    lastTradeAt: typeof performance.lastTradeAt === "string" ? performance.lastTradeAt : null,
    updatedAt: typeof performance.updatedAt === "string" ? performance.updatedAt : new Date(0).toISOString(),
    dataSource: typeof performance.dataSource === "string" ? performance.dataSource : "unknown",
    profitBasis: typeof performance.profitBasis === "string" ? performance.profitBasis : undefined
  };
}

function toJsonPerformance(performance: SmartWalletPerformanceDto | undefined): Prisma.InputJsonObject | undefined {
  return performance ? { ...performance } : undefined;
}

async function ensureSmartWallet(prisma: PrismaClient, address: string) {
  return prisma.smartWallet.upsert({
    where: { address },
    create: {
      address,
      chain: "solana",
      score: 50,
      winRate: 0,
      realizedPnl30dUsd: 0,
      maxDrawdown30d: 0,
      riskLabel: "unverified_wallet"
    },
    update: {}
  });
}

async function ensureUserId(prisma: PrismaClient, userId: string): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true }
  });
  if (existing) return existing.id;

  const telegramId = fallbackTelegramId(userId);
  const user = await prisma.user.upsert({
    where: { telegramId },
    create: {
      id: userId,
      telegramId
    },
    update: {}
  });
  return user.id;
}

function fallbackTelegramId(userId: string): bigint {
  if (userId.startsWith("tg_")) {
    const id = Number(userId.slice(3));
    if (Number.isSafeInteger(id) && id > 0) return BigInt(id);
  }

  let hash = 0;
  for (const char of userId) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return BigInt(9_000_000_000 + hash);
}

function toWalletWatchDto(input: {
  id: string;
  userId: string;
  realtime: boolean;
  smartWallet: { address: string };
}): WalletWatchDto {
  return {
    id: input.id,
    userId: input.userId,
    walletAddress: input.smartWallet.address,
    realtime: input.realtime
  };
}

function toCopyRuleDto(
  input: {
    id: string;
    userId: string;
    maxSingleTradeUsd: number;
    maxDailyLossUsd: number;
    maxSlippageBps: number;
    blacklist: string[];
    emergencyPaused: boolean;
    smartWallet: { address: string };
  },
  mode: CopyRuleDto["mode"]
): CopyRuleDto {
  return {
    id: input.id,
    userId: input.userId,
    walletAddress: input.smartWallet.address,
    maxSingleTradeUsd: input.maxSingleTradeUsd,
    maxDailyLossUsd: input.maxDailyLossUsd,
    maxSlippageBps: input.maxSlippageBps,
    blacklist: input.blacklist,
    mode,
    emergencyPaused: input.emergencyPaused
  };
}

function toTradeIntentDto(input: {
  id: string;
  userId: string;
  tokenMint: string;
  inputMint: string;
  outputMint: string;
  amount: string;
  amountUsd: number;
  status: TradeIntentDto["status"];
  riskReasons: string[];
  jupiterRequestId: string | null;
  signature: string | null;
}): TradeIntentDto {
  return {
    id: input.id,
    userId: input.userId,
    tokenMint: input.tokenMint,
    inputMint: input.inputMint,
    outputMint: input.outputMint,
    amount: input.amount,
    amountUsd: input.amountUsd,
    status: input.status,
    riskReasons: input.riskReasons,
    jupiterRequestId: input.jupiterRequestId,
    signature: input.signature
  };
}
