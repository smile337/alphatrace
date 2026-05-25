import { getPlanById, type PlanId } from "@alphatrace/shared";

export type StartPayload =
  | { kind: "personal"; code: string }
  | { kind: "kol"; code: string }
  | { kind: "subscribe"; planId: PaidPlanId }
  | { kind: "none" };

export type PaidPlanId = Exclude<PlanId, "free">;

export type BotButton = { text: string; url: string } | { text: string; webAppUrl: string };

export interface SuccessfulPaymentInput {
  userId: string;
  telegramId?: number;
  username?: string;
  firstName?: string;
  planId: PaidPlanId;
  telegramPaymentChargeId: string;
  totalAmount: number;
}

export interface SuccessfulPaymentState {
  payment: {
    id: string;
    userId: string;
    planId: PaidPlanId;
    amountStars: number;
    status: "paid";
    paidAt: Date;
  };
  subscription: {
    userId: string;
    planId: PaidPlanId;
    status: "active";
    startedAt: Date;
    expiresAt: Date;
  };
}

export interface BotPaymentStore {
  recordSuccessfulPayment(input: SuccessfulPaymentInput): Promise<SuccessfulPaymentState>;
}

export type InvoicePayload =
  | { ok: true; planId: PaidPlanId }
  | { ok: false; reason: "INVALID_PAYLOAD" | "UNSUPPORTED_PLAN" };

export function parseStartPayload(payload: string | undefined): StartPayload {
  if (!payload) return { kind: "none" };
  if (payload.startsWith("ref_")) return { kind: "personal", code: payload.slice(4) };
  if (payload.startsWith("kol_")) return { kind: "kol", code: payload.slice(4) };
  if (payload === "subscribe_pro") return { kind: "subscribe", planId: "pro" };
  if (payload === "subscribe_elite") return { kind: "subscribe", planId: "elite" };
  if (payload === "subscribe_kol_room") return { kind: "subscribe", planId: "kol_room" };
  return { kind: "none" };
}

export function buildStartMessage(
  startParam = "direct",
  botUsername = "AlphaTraceBot",
  miniAppUrl?: string
): { text: string; buttons: BotButton[] } {
  return {
    text:
      "AlphaTrace 追踪 Solana 聪明钱包、实时提醒并支持非托管跟单。历史数据不代表未来收益，请设置限额并自行控制风险。",
    buttons: [
      buildOpenButton(startParam, botUsername, miniAppUrl)
    ]
  };
}

export function createStarsInvoice(planId: Exclude<PlanId, "free">) {
  const plan = getPlanById(planId);
  return {
    title: `AlphaTrace ${plan.name}`,
    description: `${plan.name} monthly subscription for AlphaTrace smart-wallet tracking.`,
    payload: `subscribe:${plan.id}`,
    provider_token: "",
    currency: "XTR",
    prices: [{ label: `${plan.name} monthly`, amount: plan.starsPerMonth }]
  };
}

export function parseInvoicePayload(payload: string): InvoicePayload {
  const [kind, planId] = payload.split(":");
  if (kind !== "subscribe" || !planId) return { ok: false, reason: "INVALID_PAYLOAD" };
  if (planId !== "pro" && planId !== "elite" && planId !== "kol_room") {
    return { ok: false, reason: "UNSUPPORTED_PLAN" };
  }
  return { ok: true, planId };
}

export function processSuccessfulPayment(input: SuccessfulPaymentInput): SuccessfulPaymentState {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 30);

  return {
    payment: {
      id: input.telegramPaymentChargeId,
      userId: input.userId,
      planId: input.planId,
      amountStars: input.totalAmount,
      status: "paid",
      paidAt: now
    },
    subscription: {
      userId: input.userId,
      planId: input.planId,
      status: "active",
      startedAt: now,
      expiresAt
    }
  };
}

export async function settleSuccessfulPayment(
  input: SuccessfulPaymentInput,
  store?: BotPaymentStore
): Promise<SuccessfulPaymentState> {
  if (store) return store.recordSuccessfulPayment(input);
  return processSuccessfulPayment(input);
}

export function buildSubscriptionConfirmation(
  subscription: { planId: PaidPlanId; expiresAt: Date },
  botUsername = "AlphaTraceBot",
  miniAppUrl?: string
): { text: string; buttons: BotButton[] } {
  const plan = getPlanById(subscription.planId);
  const expiry = subscription.expiresAt.toISOString().slice(0, 10);
  return {
    text: `AlphaTrace ${plan.name} 已开通，有效期至 ${expiry}。历史数据不代表未来收益，请先设置单笔限额、日亏损上限和紧急暂停。`,
    buttons: [
      buildOpenButton("direct", botUsername, miniAppUrl)
    ]
  };
}

export function buildBotCommands(): Array<{ command: string; description: string }> {
  return [
    { command: "start", description: "打开 AlphaTrace Mini App" },
    { command: "subscribe_pro", description: "订阅 Pro 计划" },
    { command: "subscribe_elite", description: "订阅 Elite 自动跟单" },
    { command: "paysupport", description: "Stars 支付与退款支持" }
  ];
}

function buildOpenButton(startParam: string, botUsername: string, miniAppUrl?: string): BotButton {
  if (!miniAppUrl) {
    return {
      text: "Open AlphaTrace",
      url: `https://t.me/${botUsername}?startapp=${startParam}`
    };
  }

  const url = new URL(miniAppUrl);
  url.searchParams.set("startapp", startParam);
  return {
    text: "Open AlphaTrace",
    webAppUrl: url.toString()
  };
}
