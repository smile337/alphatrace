import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyInstance } from "fastify";
import { VersionedTransaction } from "@solana/web3.js";
import { z } from "zod";
import {
  PLANS,
  createReferralCode,
  type CopyMode,
  getPlanById,
  getPlanLimits,
  type PlanId,
  verifyTelegramInitData
} from "@alphatrace/shared";
import { assertSolanaAddress, isEligibleSmartWallet } from "./smart-wallet-analysis";

export interface JupiterOrderResponse {
  requestId: string;
  transaction: string;
  outAmount: string;
  feeBps: number;
  feeMint: string;
  error?: string;
  errorMessage?: string;
}

export interface JupiterExecuteResponse {
  status: "Success" | "Failed";
  signature?: string;
  code: number;
  error?: string;
}

export interface JupiterClient {
  order(input: {
    inputMint: string;
    outputMint: string;
    amount: string;
    taker: string;
    referralFeeBps: number;
  }): Promise<JupiterOrderResponse>;
  execute(input: { signedTransaction: string; requestId: string }): Promise<JupiterExecuteResponse>;
}

export interface ApiConfig {
  botToken: string;
  botUsername: string;
  jupiter: JupiterClient;
  smartWalletAnalyzer?: SmartWalletAnalyzer;
  store?: ApiStore;
}

export interface SmartWalletAnalyzer {
  analyzeWallet(address: string): Promise<SmartWalletDto>;
  discoverCandidateWallets?(input?: { limit?: number; excludeAddresses?: string[] }): Promise<string[]>;
}

export interface ApiUser {
  id: string;
  telegramId: number;
  username?: string;
  firstName?: string;
}

export interface SmartWalletDto {
  address: string;
  chain: string;
  score: number;
  winRate: number;
  realizedPnl30dUsd: number;
  maxDrawdown30d: number;
  riskLabel: string;
  performance?: SmartWalletPerformanceDto;
}

export interface SmartWalletPerformanceDto {
  tradeCount30d: number;
  winCount30d: number;
  lossCount30d: number;
  estimatedProfit30dUsd: number;
  decisionProfitUsd?: number | null;
  stablecoinNetFlowUsd?: number;
  costCoveragePct?: number;
  openPositionCount?: number;
  profitConfidence?: "high" | "medium" | "low";
  profitSignal?: "realized" | "cash_flow" | "insufficient_data";
  avgTradeSizeUsd: number;
  largestWinUsd: number;
  largestLossUsd: number;
  lastTradeAt: string | null;
  updatedAt: string;
  dataSource: string;
  profitBasis?: string;
}

export interface WalletWatchDto {
  id: string;
  userId: string;
  walletAddress: string;
  realtime: boolean;
}

export interface CopyRuleDto {
  id: string;
  userId: string;
  walletAddress: string;
  maxSingleTradeUsd: number;
  maxDailyLossUsd: number;
  maxSlippageBps: number;
  blacklist: string[];
  mode: CopyMode;
  emergencyPaused: boolean;
}

export type TradeIntentStatus =
  | "needs_user_confirmation"
  | "ready_for_signature"
  | "blocked_by_risk"
  | "submitted"
  | "succeeded"
  | "failed";

export interface TradeIntentDto {
  id: string;
  userId: string;
  tokenMint: string;
  inputMint: string;
  outputMint: string;
  amount: string;
  amountUsd: number;
  status: TradeIntentStatus;
  riskReasons: string[];
  jupiterRequestId: string | null;
  signature: string | null;
}

export interface ActiveSubscriptionDto {
  userId: string;
  planId: PlanId;
  status: "active";
  expiresAt: string | null;
}

export interface ResolvedSubscriptionDto {
  userId: string;
  planId: PlanId;
  status: "active" | "free";
  expiresAt: string | null;
}

export interface ApiStore {
  upsertTelegramUser(input: {
    telegramId: number;
    username?: string;
    firstName?: string;
  }): Promise<ApiUser>;
  listSmartWallets(): Promise<SmartWalletDto[]>;
  getSmartWallet(address: string): Promise<SmartWalletDto | null>;
  upsertSmartWallet(input: SmartWalletDto): Promise<SmartWalletDto>;
  getActiveSubscription(userId: string): Promise<ActiveSubscriptionDto | null>;
  countWalletWatches(userId: string): Promise<number>;
  upsertWalletWatch(input: {
    userId: string;
    walletAddress: string;
    realtime: boolean;
  }): Promise<WalletWatchDto>;
  upsertCopyRule(input: {
    userId: string;
    walletAddress: string;
    maxSingleTradeUsd: number;
    maxDailyLossUsd: number;
    maxSlippageBps: number;
    blacklist: string[];
    mode: CopyMode;
  }): Promise<CopyRuleDto>;
  createTradeIntent(input: {
    userId: string;
    tokenMint: string;
    inputMint: string;
    outputMint: string;
    amount: string;
    amountUsd: number;
    riskReasons: string[];
  }): Promise<TradeIntentDto>;
  listTradeIntents(userId: string): Promise<TradeIntentDto[]>;
  getTradeIntent(id: string): Promise<TradeIntentDto | null>;
  markTradeIntentReady(input: { id: string; jupiterRequestId: string }): Promise<TradeIntentDto>;
  markTradeIntentSubmitted(input: { id: string }): Promise<TradeIntentDto | null>;
  markTradeIntentExecuted(input: {
    id: string;
    status: Extract<TradeIntentStatus, "succeeded" | "failed">;
    signature?: string;
  }): Promise<TradeIntentDto>;
}

const planIdSchema = z.enum(["free", "pro", "elite", "kol_room"]);
const tradeIntentInputSchema = z.object({
  userId: z.string().min(1),
  tokenMint: z.string().min(20),
  inputMint: z.string().min(20),
  outputMint: z.string().min(20),
  amount: z.string().min(1),
  amountUsd: z.number().positive(),
  riskReasons: z.array(z.string()).default([])
});

export const SMART_WALLETS: SmartWalletDto[] = [
  {
    address: "SmartWallet111111111111111111111111111111111",
    chain: "solana",
    score: 88,
    winRate: 0.62,
    realizedPnl30dUsd: 18_420,
    maxDrawdown30d: 0.18,
    riskLabel: "high_win_rate_low_frequency"
  },
  {
    address: "SmartWallet222222222222222222222222222222222",
    chain: "solana",
    score: 74,
    winRate: 0.51,
    realizedPnl30dUsd: 32_100,
    maxDrawdown30d: 0.34,
    riskLabel: "new_token_hunter"
  },
  {
    address: "SmartWallet333333333333333333333333333333333",
    chain: "solana",
    score: 41,
    winRate: 0.44,
    realizedPnl30dUsd: 81_500,
    maxDrawdown30d: 0.67,
    riskLabel: "high_risk_do_not_auto_copy"
  }
];

export function buildApi(config: ApiConfig): FastifyInstance {
  const app = Fastify({ logger: false });
  const memoryTradeIntents: TradeIntentDto[] = [];

  app.register(cors, { origin: true });
  app.register(sensible);

  app.get("/health", async () => ({ ok: true }));

  app.get("/api/plans", async () => ({ plans: PLANS }));

  app.get("/api/subscriptions/active", async (request) => {
    const query = z.object({ userId: z.string().min(1).default("demo_web_user") }).parse(request.query);
    const resolved = await resolveUserPlan(config.store, query.userId);
    return {
      subscription: resolved.subscription,
      plan: resolved.plan,
      limits: resolved.limits
    };
  });

  app.post("/api/auth/telegram", async (request, reply) => {
    const body = z.object({ initData: z.string().min(1) }).parse(request.body);
    const verification = verifyTelegramInitData(body.initData, config.botToken);
    if (!verification.ok) {
      return reply.code(401).send({ code: verification.reason });
    }

    const user = config.store
      ? await config.store.upsertTelegramUser({
          telegramId: verification.user.id,
          username: verification.user.username,
          firstName: verification.user.first_name
        })
      : {
          id: `tg_${verification.user.id}`,
          telegramId: verification.user.id,
          username: verification.user.username,
          firstName: verification.user.first_name
        };

    return {
      user,
      referral: verification.startParam
        ? {
            startParam: verification.startParam,
            bound: verification.startParam.startsWith("ref_") || verification.startParam.startsWith("kol_")
          }
        : null
    };
  });

  app.get("/api/smart-wallets", async () => ({
    wallets: config.store ? filterEligibleSmartWallets(await config.store.listSmartWallets()) : [],
    source: "live_store"
  }));

  app.post("/api/smart-wallets/import", async (request, reply) => {
    const body = z.object({ address: z.string().min(32) }).parse(request.body);
    let address: string;
    try {
      address = assertSolanaAddress(body.address);
    } catch {
      return reply.code(400).send({ code: "INVALID_SOLANA_WALLET_ADDRESS" });
    }
    if (!config.store || !config.smartWalletAnalyzer) {
      return reply.code(503).send({ code: "SMART_WALLET_DATA_SOURCE_UNCONFIGURED" });
    }

    const cachedWallet = await config.store.getSmartWallet(address);
    if (cachedWallet) {
      return { wallet: cachedWallet, eligible: isEligibleSmartWallet(cachedWallet), source: "cache" };
    }

    const wallet = await config.smartWalletAnalyzer.analyzeWallet(address);
    const savedWallet = await config.store.upsertSmartWallet(wallet);
    return { wallet: savedWallet, eligible: isEligibleSmartWallet(savedWallet), source: "helius" };
  });

  app.post("/api/smart-wallets/:address/refresh", async (request, reply) => {
    const params = z.object({ address: z.string().min(32) }).parse(request.params);
    let address: string;
    try {
      address = assertSolanaAddress(params.address);
    } catch {
      return reply.code(400).send({ code: "INVALID_SOLANA_WALLET_ADDRESS" });
    }
    if (!config.store || !config.smartWalletAnalyzer) {
      return reply.code(503).send({ code: "SMART_WALLET_DATA_SOURCE_UNCONFIGURED" });
    }

    const wallet = await config.store.upsertSmartWallet(await config.smartWalletAnalyzer.analyzeWallet(address));
    return { wallet, eligible: isEligibleSmartWallet(wallet), source: "helius" };
  });

  app.post("/api/smart-wallets/discover", async (request, reply) => {
    const body = z
      .object({
        limit: z.number().int().min(1).max(10).default(5),
        excludeAddresses: z.array(z.string()).default([])
      })
      .parse(request.body ?? {});
    if (!config.store || !config.smartWalletAnalyzer?.discoverCandidateWallets) {
      return reply.code(503).send({ code: "SMART_WALLET_DISCOVERY_UNCONFIGURED" });
    }

    const excludeAddresses = body.excludeAddresses.flatMap((candidate) => {
      try {
        return [assertSolanaAddress(candidate)];
      } catch {
        return [];
      }
    });
    const excluded = new Set(excludeAddresses);
    const candidateLimit = Math.min(30, Math.max(body.limit, body.limit * 4));
    const candidateAddresses = (
      await config.smartWalletAnalyzer.discoverCandidateWallets({
        limit: candidateLimit,
        excludeAddresses
      })
    ).filter((address) => !excluded.has(address));
    const imported: SmartWalletDto[] = [];
    const rejected: SmartWalletDto[] = [];

    for (const address of candidateAddresses) {
      const wallet = await config.store.upsertSmartWallet(await config.smartWalletAnalyzer.analyzeWallet(address));
      if (isEligibleSmartWallet(wallet)) {
        imported.push(wallet);
        if (imported.length >= body.limit) break;
      } else {
        rejected.push(wallet);
      }
    }

    return {
      imported: filterEligibleSmartWallets(imported),
      rejected,
      candidates: candidateAddresses.length,
      source: "helius"
    };
  });

  app.post("/api/watchlist", async (request, reply) => {
    const body = z
      .object({
        userId: z.string().min(1),
        planId: planIdSchema,
        existingWatchCount: z.number().int().min(0).optional(),
        walletAddress: z.string().min(20)
      })
      .parse(request.body);
    const resolvedPlan = await resolveUserPlan(config.store, body.userId, body.planId);
    const limits = resolvedPlan.limits;
    const existingWatchCount = config.store
      ? await config.store.countWalletWatches(body.userId)
      : (body.existingWatchCount ?? 0);

    if (existingWatchCount >= limits.walletLimit) {
      return reply.code(403).send({
        code: "WALLET_LIMIT_EXCEEDED",
        walletLimit: limits.walletLimit,
        planId: resolvedPlan.plan.id
      });
    }

    if (config.store) {
      return {
        watch: await config.store.upsertWalletWatch({
          userId: body.userId,
          walletAddress: body.walletAddress,
          realtime: limits.realtimeAlerts
        })
      };
    }

    return {
      watch: {
        id: `watch_${body.userId}_${body.walletAddress.slice(0, 8)}`,
        userId: body.userId,
        walletAddress: body.walletAddress,
        realtime: limits.realtimeAlerts
      }
    };
  });

  app.post("/api/copy-rules", async (request, reply) => {
    const body = z
      .object({
        userId: z.string().min(1),
        planId: planIdSchema,
        walletAddress: z.string().min(20),
        maxSingleTradeUsd: z.number().positive(),
        maxDailyLossUsd: z.number().positive(),
        maxSlippageBps: z.number().int().min(1).max(5000),
        blacklist: z.array(z.string()).default([])
      })
      .parse(request.body);
    const resolvedPlan = await resolveUserPlan(config.store, body.userId, body.planId);
    const limits = resolvedPlan.limits;

    if (limits.copyMode === "alerts") {
      return reply.code(403).send({ code: "COPY_TRADING_REQUIRES_PRO", planId: resolvedPlan.plan.id });
    }

    if (config.store) {
      return {
        rule: await config.store.upsertCopyRule({
          ...body,
          mode: limits.copyMode
        })
      };
    }

    return {
      rule: {
        id: `rule_${body.userId}_${body.walletAddress.slice(0, 8)}`,
        ...body,
        mode: limits.copyMode,
        emergencyPaused: false
      }
    };
  });

  app.post("/api/share-cards", async (request) => {
    const body = z
      .object({
        userId: z.string().min(1),
        cardType: z.enum(["daily_alerts", "weekly_top5", "wallet_profile"])
      })
      .parse(request.body);
    const referral = createReferralCode(body.userId, "personal", config.botUsername);

    return {
      card: {
        id: `card_${body.cardType}_${Date.now()}`,
        userId: body.userId,
        cardType: body.cardType,
        title:
          body.cardType === "weekly_top5"
            ? "本周聪明钱包排行榜 Top 5"
            : body.cardType === "daily_alerts"
              ? "今日聪明钱包异动摘要"
              : "钱包历史表现与风险标签",
        inviteLink: referral.link,
        disclaimer: "历史数据不代表未来收益，自动跟单需自行控制风险。"
      }
    };
  });

  app.get("/api/referrals/me", async (request) => {
    const query = z.object({ userId: z.string().default("demo_user") }).parse(request.query);
    const referral = createReferralCode(query.userId, "personal", config.botUsername);
    return {
      referral,
      stats: {
        invitedUsers: 0,
        paidUsers: 0,
        pendingRewards: []
      }
    };
  });

  app.post("/api/referrals/claim", async () => ({
    claimed: true,
    rewards: []
  }));

  app.get("/api/kol/dashboard", async (request) => {
    const query = z.object({ kolUserId: z.string().min(1) }).parse(request.query);
    const referral = createReferralCode(query.kolUserId, "kol", config.botUsername);
    return {
      dashboard: {
        kolUserId: query.kolUserId,
        entryLink: referral.link,
        newUsers: 128,
        paidUsers: 24,
        mrrStars: 24 * 999,
        tradingVolumeUsd: 84_200,
        commissionStars: 4_796
      }
    };
  });

  app.post("/api/trade-intents", async (request) => {
    const body = tradeIntentInputSchema.parse(request.body);
    const intent = config.store
      ? await config.store.createTradeIntent(body)
      : createMemoryTradeIntent(memoryTradeIntents, body);

    return { intent };
  });

  app.get("/api/trade-intents", async (request) => {
    const query = z.object({ userId: z.string().min(1) }).parse(request.query);
    const tradeIntents = config.store
      ? await config.store.listTradeIntents(query.userId)
      : memoryTradeIntents.filter((intent) => intent.userId === query.userId);

    return { tradeIntents };
  });

  app.post("/api/trade-intents/:id/order", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z
      .object({
        planId: planIdSchema,
        taker: z.string().min(20)
      })
      .parse(request.body);
    const intent = config.store
      ? await config.store.getTradeIntent(params.id)
      : (memoryTradeIntents.find((candidate) => candidate.id === params.id) ?? null);

    if (!intent) {
      return reply.code(404).send({ code: "TRADE_INTENT_NOT_FOUND" });
    }
    if (intent.status === "blocked_by_risk") {
      return reply.code(403).send({ code: "TRADE_INTENT_BLOCKED_BY_RISK", riskReasons: intent.riskReasons });
    }

    const resolvedPlan = await resolveUserPlan(config.store, intent.userId, body.planId);
    const executionFeeBps = resolvedPlan.limits.executionFeeBps;
    const order = await config.jupiter.order({
      inputMint: intent.inputMint,
      outputMint: intent.outputMint,
      amount: intent.amount,
      taker: body.taker,
      referralFeeBps: executionFeeBps
    });
    if (!order.transaction) {
      return reply.code(422).send({
        code: "JUPITER_ORDER_UNAVAILABLE",
        requestId: order.requestId,
        errorMessage: order.errorMessage ?? order.error ?? "Jupiter did not return a transaction"
      });
    }
    const updatedIntent = config.store
      ? await config.store.markTradeIntentReady({ id: intent.id, jupiterRequestId: order.requestId })
      : markMemoryTradeIntentReady(memoryTradeIntents, intent.id, order.requestId);

    return { intent: updatedIntent, order, executionFeeBps, planId: resolvedPlan.plan.id };
  });

  app.post("/api/trade-intents/:id/execute", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z
      .object({
        signedTransaction: z.string().min(1)
      })
      .parse(request.body);
    const intent = config.store
      ? await config.store.getTradeIntent(params.id)
      : (memoryTradeIntents.find((candidate) => candidate.id === params.id) ?? null);

    if (!intent) {
      return reply.code(404).send({ code: "TRADE_INTENT_NOT_FOUND" });
    }
    if (intent.status === "succeeded" && intent.signature) {
      return {
        intent,
        result: {
          status: "Success",
          signature: intent.signature,
          code: 0
        } satisfies JupiterExecuteResponse
      };
    }
    if (intent.status === "submitted") {
      return reply.code(409).send({ code: "TRADE_INTENT_ALREADY_SUBMITTED" });
    }
    if (intent.status !== "ready_for_signature" || !intent.jupiterRequestId) {
      return reply.code(409).send({ code: "TRADE_INTENT_NOT_READY" });
    }
    if (!isValidSignedTransaction(body.signedTransaction)) {
      return reply.code(400).send({ code: "INVALID_SIGNED_TRANSACTION" });
    }
    const submittedIntent = config.store
      ? await config.store.markTradeIntentSubmitted({ id: intent.id })
      : markMemoryTradeIntentSubmitted(memoryTradeIntents, intent.id);
    if (!submittedIntent) {
      return reply.code(409).send({ code: "TRADE_INTENT_ALREADY_SUBMITTED" });
    }

    let result: JupiterExecuteResponse;
    try {
      result = await config.jupiter.execute({
        signedTransaction: body.signedTransaction,
        requestId: intent.jupiterRequestId
      });
    } catch {
      const failedIntent = config.store
        ? await config.store.markTradeIntentExecuted({ id: intent.id, status: "failed" })
        : markMemoryTradeIntentExecuted(memoryTradeIntents, intent.id, "failed");
      return reply.code(502).send({ code: "JUPITER_EXECUTE_FAILED", intent: failedIntent });
    }
    const nextStatus = result.status === "Success" ? "succeeded" : "failed";
    const updatedIntent = config.store
      ? await config.store.markTradeIntentExecuted({ id: intent.id, status: nextStatus, signature: result.signature })
      : markMemoryTradeIntentExecuted(memoryTradeIntents, intent.id, nextStatus, result.signature);

    return { intent: updatedIntent, result };
  });

  app.post("/api/swap/order", async (request) => {
    const body = z
      .object({
        userId: z.string().min(1),
        planId: planIdSchema,
        inputMint: z.string().min(20),
        outputMint: z.string().min(20),
        amount: z.string().min(1),
        taker: z.string().min(20)
      })
      .parse(request.body);
    const resolvedPlan = await resolveUserPlan(config.store, body.userId, body.planId);
    const executionFeeBps = resolvedPlan.limits.executionFeeBps;
    const order = await config.jupiter.order({
      inputMint: body.inputMint,
      outputMint: body.outputMint,
      amount: body.amount,
      taker: body.taker,
      referralFeeBps: executionFeeBps
    });
    if (!order.transaction) {
      return {
        code: "JUPITER_ORDER_UNAVAILABLE",
        requestId: order.requestId,
        errorMessage: order.errorMessage ?? order.error ?? "Jupiter did not return a transaction",
        executionFeeBps,
        planId: resolvedPlan.plan.id
      };
    }

    return { order, executionFeeBps, planId: resolvedPlan.plan.id };
  });

  app.post("/api/swap/execute", async (request) => {
    const body = z
      .object({
        signedTransaction: z.string().min(1),
        requestId: z.string().min(1)
      })
      .parse(request.body);
    const result = await config.jupiter.execute(body);
    return { result };
  });

  app.post("/api/telegram/webhook", async () => ({ ok: true }));

  return app;
}

function filterEligibleSmartWallets(wallets: SmartWalletDto[]): SmartWalletDto[] {
  return wallets.filter((wallet) => isEligibleSmartWallet(wallet));
}

async function resolveUserPlan(store: ApiStore | undefined, userId: string, fallbackPlanId: PlanId = "free") {
  const activeSubscription = store ? await store.getActiveSubscription(userId) : null;
  const subscription: ResolvedSubscriptionDto = activeSubscription ?? {
    userId,
    planId: store ? "free" : fallbackPlanId,
    status: store ? "free" : fallbackPlanId === "free" ? "free" : "active",
    expiresAt: null
  };
  const plan = getPlanById(subscription.planId);

  return {
    subscription,
    plan,
    limits: getPlanLimits(plan.id)
  };
}

function isValidSignedTransaction(signedTransaction: string): boolean {
  try {
    VersionedTransaction.deserialize(Buffer.from(signedTransaction, "base64"));
    return true;
  } catch {
    return false;
  }
}

function createMemoryTradeIntent(
  tradeIntents: TradeIntentDto[],
  input: {
    userId: string;
    tokenMint: string;
    inputMint: string;
    outputMint: string;
    amount: string;
    amountUsd: number;
    riskReasons: string[];
  }
): TradeIntentDto {
  const intent: TradeIntentDto = {
    id: `intent_${tradeIntents.length + 1}`,
    ...input,
    status: input.riskReasons.length > 0 ? "blocked_by_risk" : "needs_user_confirmation",
    jupiterRequestId: null,
    signature: null
  };
  tradeIntents.push(intent);
  return intent;
}

function markMemoryTradeIntentReady(tradeIntents: TradeIntentDto[], id: string, jupiterRequestId: string): TradeIntentDto {
  const intent = tradeIntents.find((candidate) => candidate.id === id);
  if (!intent) {
    throw new Error(`Missing trade intent: ${id}`);
  }
  intent.status = "ready_for_signature";
  intent.jupiterRequestId = jupiterRequestId;
  return intent;
}

function markMemoryTradeIntentSubmitted(tradeIntents: TradeIntentDto[], id: string): TradeIntentDto | null {
  const intent = tradeIntents.find((candidate) => candidate.id === id);
  if (!intent) {
    throw new Error(`Missing trade intent: ${id}`);
  }
  if (intent.status !== "ready_for_signature") {
    return null;
  }
  intent.status = "submitted";
  return intent;
}

function markMemoryTradeIntentExecuted(
  tradeIntents: TradeIntentDto[],
  id: string,
  status: Extract<TradeIntentStatus, "succeeded" | "failed">,
  signature?: string
): TradeIntentDto {
  const intent = tradeIntents.find((candidate) => candidate.id === id);
  if (!intent) {
    throw new Error(`Missing trade intent: ${id}`);
  }
  intent.status = status;
  intent.signature = signature ?? null;
  return intent;
}
