import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type PlanId = "free" | "pro" | "elite" | "kol_room";
export type CopyMode = "alerts" | "confirm" | "auto";

export interface SubscriptionPlan {
  id: PlanId;
  name: string;
  starsPerMonth: number;
  walletLimit: number;
  dailyAlertLimit: number | "unlimited";
  realtimeAlerts: boolean;
  copyMode: CopyMode;
  executionFeeBps: number;
  features: string[];
}

export const PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    name: "Free",
    starsPerMonth: 0,
    walletLimit: 3,
    dailyAlertLimit: 5,
    realtimeAlerts: false,
    copyMode: "alerts",
    executionFeeBps: 75,
    features: ["15-minute delayed leaderboard", "3 wallet watches", "5 daily alerts"]
  },
  {
    id: "pro",
    name: "Pro",
    starsPerMonth: 999,
    walletLimit: 20,
    dailyAlertLimit: "unlimited",
    realtimeAlerts: true,
    copyMode: "confirm",
    executionFeeBps: 75,
    features: ["real-time alerts", "20 wallet watches", "confirm-to-copy trading", "basic PnL analytics"]
  },
  {
    id: "elite",
    name: "Elite",
    starsPerMonth: 2499,
    walletLimit: 100,
    dailyAlertLimit: "unlimited",
    realtimeAlerts: true,
    copyMode: "auto",
    executionFeeBps: 50,
    features: ["automatic copy trading", "100 wallet watches", "advanced risk controls", "priority alerts"]
  },
  {
    id: "kol_room",
    name: "KOL Room",
    starsPerMonth: 9999,
    walletLimit: 500,
    dailyAlertLimit: "unlimited",
    realtimeAlerts: true,
    copyMode: "auto",
    executionFeeBps: 50,
    features: ["group bot", "community leaderboard", "referral dashboard", "channel commission tracking"]
  }
];

export function getPlanById(id: PlanId): SubscriptionPlan {
  const plan = PLANS.find((candidate) => candidate.id === id);
  if (!plan) {
    throw new Error(`Unknown plan: ${id}`);
  }
  return plan;
}

export function getPlanLimits(id: PlanId): Pick<
  SubscriptionPlan,
  "walletLimit" | "dailyAlertLimit" | "realtimeAlerts" | "copyMode" | "executionFeeBps"
> {
  const plan = getPlanById(id);
  return {
    walletLimit: plan.walletLimit,
    dailyAlertLimit: plan.dailyAlertLimit,
    realtimeAlerts: plan.realtimeAlerts,
    copyMode: plan.copyMode,
    executionFeeBps: plan.executionFeeBps
  };
}

export interface ReferralCode {
  ownerUserId: string;
  kind: "personal" | "kol";
  code: string;
  startParam: string;
  link: string;
}

export interface ReferralAttribution {
  invitedUserId: string;
  inviterUserId: string;
  boundAt: Date;
}

export function createReferralCode(ownerUserId: string, kind: "personal" | "kol", botUsername: string): ReferralCode {
  const digest = createHash("sha256").update(`${kind}:${ownerUserId}`).digest("base64url").slice(0, 10);
  const prefix = kind === "kol" ? "kol" : "ref";
  const startParam = `${prefix}_${digest}`;
  return {
    ownerUserId,
    kind,
    code: digest,
    startParam,
    link: `https://t.me/${botUsername}?startapp=${startParam}`
  };
}

export type BindReferralResult =
  | { status: "bound"; attribution: ReferralAttribution }
  | { status: "rejected_self_invite"; attribution: null }
  | { status: "already_bound"; attribution: ReferralAttribution };

export function bindReferral(input: {
  invitedUserId: string;
  inviterUserId: string;
  existingAttribution: ReferralAttribution | null;
}): BindReferralResult {
  if (input.existingAttribution) {
    return { status: "already_bound", attribution: input.existingAttribution };
  }
  if (input.invitedUserId === input.inviterUserId) {
    return { status: "rejected_self_invite", attribution: null };
  }
  return {
    status: "bound",
    attribution: {
      invitedUserId: input.invitedUserId,
      inviterUserId: input.inviterUserId,
      boundAt: new Date()
    }
  };
}

export type RewardType = "pro_days" | "elite_days" | "pro_trial_days" | "platform_credit_stars";

export interface ReferralRewardGrant {
  userId: string;
  type: RewardType;
  amount: number;
  reason: string;
}

export function grantFirstPaymentRewards(input: {
  invitedUserId: string;
  inviterUserId: string;
  paidPlanId: Exclude<PlanId, "free">;
  invitedPaidCountAfterPayment: number;
  alreadyRewarded: boolean;
  inviterRewardPreference?: "pro_days" | "platform_credit_stars";
}): { rewards: ReferralRewardGrant[]; multiLevelRewards: ReferralRewardGrant[] } {
  if (input.alreadyRewarded) {
    return { rewards: [], multiLevelRewards: [] };
  }

  const inviterPrimaryReward: ReferralRewardGrant =
    input.inviterRewardPreference === "platform_credit_stars"
      ? {
          userId: input.inviterUserId,
          type: "platform_credit_stars",
          amount: 200,
          reason: "first_paid_referral"
        }
      : {
          userId: input.inviterUserId,
          type: "pro_days",
          amount: 7,
          reason: "first_paid_referral"
        };

  const rewards: ReferralRewardGrant[] = [
    inviterPrimaryReward,
    {
      userId: input.invitedUserId,
      type: "pro_trial_days",
      amount: 3,
      reason: "invited_user_first_payment"
    }
  ];

  if (input.invitedPaidCountAfterPayment === 3) {
    rewards.push({
      userId: input.inviterUserId,
      type: "pro_days",
      amount: 14,
      reason: "three_paid_referrals"
    });
  }

  if (input.invitedPaidCountAfterPayment === 10) {
    rewards.push({
      userId: input.inviterUserId,
      type: "elite_days",
      amount: 30,
      reason: "ten_paid_referrals"
    });
  }

  return { rewards, multiLevelRewards: [] };
}

export function calculateKolCommission(input: {
  source: "subscription" | "trade_fee";
  amountStars: number;
  rateBps?: number;
}): { amountStars: number; rateBps: number; source: "subscription" | "trade_fee" } {
  const rateBps = input.source === "subscription" ? 2000 : Math.min(Math.max(input.rateBps ?? 1000, 1000), 2000);
  return {
    source: input.source,
    rateBps,
    amountStars: Math.round((input.amountStars * rateBps) / 10_000)
  };
}

export type RiskReason =
  | "EMERGENCY_PAUSED"
  | "SINGLE_TRADE_LIMIT_EXCEEDED"
  | "DAILY_LOSS_LIMIT_EXCEEDED"
  | "LOW_LIQUIDITY"
  | "SLIPPAGE_TOO_HIGH"
  | "SMART_WALLET_SCORE_TOO_LOW"
  | "TOKEN_BLACKLISTED";

export interface RiskInput {
  tokenMint: string;
  inputAmountUsd: number;
  liquidityUsd: number;
  expectedSlippageBps: number;
  walletScore: number;
  dailyLossUsd: number;
  userDailyLossLimitUsd: number;
  userSingleTradeLimitUsd: number;
  emergencyPaused: boolean;
  blacklist: string[];
}

export interface RiskDecision {
  allowed: boolean;
  reasons: RiskReason[];
}

export function evaluateRisk(input: RiskInput): RiskDecision {
  const reasons: RiskReason[] = [];

  if (input.emergencyPaused) reasons.push("EMERGENCY_PAUSED");
  if (input.inputAmountUsd > input.userSingleTradeLimitUsd) reasons.push("SINGLE_TRADE_LIMIT_EXCEEDED");
  if (input.dailyLossUsd >= input.userDailyLossLimitUsd) reasons.push("DAILY_LOSS_LIMIT_EXCEEDED");
  if (input.liquidityUsd < 10_000) reasons.push("LOW_LIQUIDITY");
  if (input.expectedSlippageBps > 500) reasons.push("SLIPPAGE_TOO_HIGH");
  if (input.walletScore < 50) reasons.push("SMART_WALLET_SCORE_TOO_LOW");
  if (input.blacklist.includes(input.tokenMint)) reasons.push("TOKEN_BLACKLISTED");

  return { allowed: reasons.length === 0, reasons };
}

export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
}

export type TelegramInitDataVerification =
  | { ok: true; user: TelegramUser; startParam?: string; authDate: Date }
  | { ok: false; reason: "MISSING_HASH" | "INVALID_HASH" | "INVALID_USER" | "EXPIRED" };

export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  options: { maxAgeSeconds?: number; now?: Date } = {}
): TelegramInitDataVerification {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "MISSING_HASH" };

  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculated = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const expectedBuffer = Buffer.from(calculated, "hex");
  const actualBuffer = Buffer.from(hash, "hex");
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return { ok: false, reason: "INVALID_HASH" };
  }

  const authDateSeconds = Number(params.get("auth_date"));
  const authDate = new Date(authDateSeconds * 1000);
  const maxAgeSeconds = options.maxAgeSeconds ?? 86_400;
  const now = options.now ?? new Date();
  if (Number.isFinite(authDateSeconds) && now.getTime() - authDate.getTime() > maxAgeSeconds * 1000) {
    return { ok: false, reason: "EXPIRED" };
  }

  const rawUser = params.get("user");
  if (!rawUser) return { ok: false, reason: "INVALID_USER" };

  try {
    const user = JSON.parse(rawUser) as TelegramUser;
    if (!user.id) return { ok: false, reason: "INVALID_USER" };
    return {
      ok: true,
      user,
      startParam: params.get("start_param") ?? undefined,
      authDate
    };
  } catch {
    return { ok: false, reason: "INVALID_USER" };
  }
}
