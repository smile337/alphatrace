import { prisma } from "@alphatrace/db";
import { getPlanById, type PlanId } from "@alphatrace/shared";
import { createPrismaBotPaymentStore } from "../../bot/src/prisma-store";
import { createPrismaApiStore } from "./prisma-store";
import { verifySubscriptionPersistence } from "./subscription-verification";

type PaidPlanId = Exclude<PlanId, "free">;

const userId = process.env.VERIFY_SUBSCRIPTION_USER_ID ?? `verify_${Date.now()}`;
const telegramId = Number(process.env.VERIFY_SUBSCRIPTION_TELEGRAM_ID ?? 9_900_000_001);
const planId = parsePaidPlanId(process.env.VERIFY_SUBSCRIPTION_PLAN_ID ?? "pro");
const plan = getPlanById(planId);

try {
  const result = await verifySubscriptionPersistence({
    userId,
    telegramId,
    planId,
    chargeId: process.env.VERIFY_SUBSCRIPTION_CHARGE_ID ?? `verify_charge_${Date.now()}`,
    amountStars: plan.starsPerMonth,
    botStore: createPrismaBotPaymentStore(prisma),
    apiStore: createPrismaApiStore(prisma)
  });

  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
} finally {
  await prisma.$disconnect();
}

function parsePaidPlanId(value: string): PaidPlanId {
  if (value === "pro" || value === "elite" || value === "kol_room") return value;
  throw new Error(`Unsupported VERIFY_SUBSCRIPTION_PLAN_ID: ${value}`);
}
