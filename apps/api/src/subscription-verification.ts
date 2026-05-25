import type { PlanId } from "@alphatrace/shared";

type PaidPlanId = Exclude<PlanId, "free">;

export interface SubscriptionVerificationBotStore {
  recordSuccessfulPayment(input: {
    userId: string;
    telegramId: number;
    planId: PaidPlanId;
    telegramPaymentChargeId: string;
    totalAmount: number;
  }): Promise<unknown>;
}

export interface SubscriptionVerificationApiStore {
  getActiveSubscription(userId: string): Promise<{
    userId: string;
    planId: PlanId;
    status: "active";
    expiresAt: string | null;
  } | null>;
}

export type SubscriptionVerificationResult =
  | { ok: true; userId: string; planId: PaidPlanId; expiresAt: string | null }
  | { ok: false; reason: "ACTIVE_SUBSCRIPTION_NOT_FOUND"; userId: string; expectedPlanId: PaidPlanId }
  | {
      ok: false;
      reason: "ACTIVE_SUBSCRIPTION_PLAN_MISMATCH";
      userId: string;
      expectedPlanId: PaidPlanId;
      actualPlanId: PlanId;
    };

export async function verifySubscriptionPersistence(input: {
  userId: string;
  telegramId: number;
  planId: PaidPlanId;
  chargeId: string;
  amountStars: number;
  botStore: SubscriptionVerificationBotStore;
  apiStore: SubscriptionVerificationApiStore;
}): Promise<SubscriptionVerificationResult> {
  await input.botStore.recordSuccessfulPayment({
    userId: input.userId,
    telegramId: input.telegramId,
    planId: input.planId,
    telegramPaymentChargeId: input.chargeId,
    totalAmount: input.amountStars
  });

  const activeSubscription = await input.apiStore.getActiveSubscription(input.userId);
  if (!activeSubscription) {
    return {
      ok: false,
      reason: "ACTIVE_SUBSCRIPTION_NOT_FOUND",
      userId: input.userId,
      expectedPlanId: input.planId
    };
  }

  if (activeSubscription.planId !== input.planId) {
    return {
      ok: false,
      reason: "ACTIVE_SUBSCRIPTION_PLAN_MISMATCH",
      userId: input.userId,
      expectedPlanId: input.planId,
      actualPlanId: activeSubscription.planId
    };
  }

  return {
    ok: true,
    userId: input.userId,
    planId: activeSubscription.planId,
    expiresAt: activeSubscription.expiresAt
  };
}
