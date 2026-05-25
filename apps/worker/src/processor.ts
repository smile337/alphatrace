import { evaluateRisk, getPlanLimits, type PlanId, type RiskReason } from "@alphatrace/shared";

export interface WalletTradeEvent {
  walletAddress: string;
  tokenMint: string;
  side: "buy" | "sell";
  amountUsd: number;
  liquidityUsd: number;
  expectedSlippageBps: number;
  walletScore: number;
}

export interface CopyRule {
  id: string;
  userId: string;
  planId: PlanId;
  walletAddress: string;
  maxSingleTradeUsd: number;
  maxDailyLossUsd: number;
  currentDailyLossUsd: number;
  blacklist: string[];
  emergencyPaused: boolean;
}

export interface Alert {
  userId: string;
  walletAddress: string;
  tokenMint: string;
  message: string;
}

export interface TradeIntent {
  id: string;
  userId: string;
  ruleId: string;
  tokenMint: string;
  amountUsd: number;
  mode: "confirm" | "auto";
  status: "ready_for_signature" | "needs_user_confirmation" | "blocked_by_risk";
  riskReasons: RiskReason[];
}

export function processWalletTradeEvent(input: {
  event: WalletTradeEvent;
  rules: CopyRule[];
}): { alerts: Alert[]; tradeIntents: TradeIntent[] } {
  const matchingRules = input.rules.filter((rule) => rule.walletAddress === input.event.walletAddress);
  const alerts: Alert[] = matchingRules.map((rule) => ({
    userId: rule.userId,
    walletAddress: input.event.walletAddress,
    tokenMint: input.event.tokenMint,
    message: `${input.event.walletAddress.slice(0, 8)} ${input.event.side === "buy" ? "bought" : "sold"} ${input.event.tokenMint.slice(0, 8)}`
  }));

  const tradeIntents: TradeIntent[] = matchingRules
    .map((rule) => {
      const limits = getPlanLimits(rule.planId);
      if (limits.copyMode === "alerts") return null;

      const risk = evaluateRisk({
        tokenMint: input.event.tokenMint,
        inputAmountUsd: input.event.amountUsd,
        liquidityUsd: input.event.liquidityUsd,
        expectedSlippageBps: input.event.expectedSlippageBps,
        walletScore: input.event.walletScore,
        dailyLossUsd: rule.currentDailyLossUsd,
        userDailyLossLimitUsd: rule.maxDailyLossUsd,
        userSingleTradeLimitUsd: rule.maxSingleTradeUsd,
        emergencyPaused: rule.emergencyPaused,
        blacklist: rule.blacklist
      });

      return {
        id: `intent_${rule.id}_${input.event.tokenMint.slice(0, 8)}`,
        userId: rule.userId,
        ruleId: rule.id,
        tokenMint: input.event.tokenMint,
        amountUsd: Math.min(input.event.amountUsd, rule.maxSingleTradeUsd),
        mode: limits.copyMode,
        status: risk.allowed
          ? limits.copyMode === "auto"
            ? "ready_for_signature"
            : "needs_user_confirmation"
          : "blocked_by_risk",
        riskReasons: risk.reasons
      } satisfies TradeIntent;
    })
    .filter((intent): intent is TradeIntent => intent !== null);

  return { alerts, tradeIntents };
}
