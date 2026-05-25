import type { PrismaClient } from "@alphatrace/db";
import type { BotPaymentStore, SuccessfulPaymentState } from "./bot";

export function createPrismaBotPaymentStore(prisma: PrismaClient): BotPaymentStore {
  return {
    async recordSuccessfulPayment(input) {
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setUTCDate(expiresAt.getUTCDate() + 30);
      const telegramId = BigInt(input.telegramId ?? Number(input.userId.replace(/^tg_/, "")));

      return prisma.$transaction(async (tx) => {
        const user = await tx.user.upsert({
          where: { telegramId },
          create: {
            id: input.userId,
            telegramId,
            username: input.username,
            firstName: input.firstName
          },
          update: {
            username: input.username,
            firstName: input.firstName
          }
        });

        const existingPayment = await tx.payment.findUnique({
          where: { telegramPaymentChargeId: input.telegramPaymentChargeId }
        });
        const payment = existingPayment ?? await tx.payment.create({
          data: {
            userId: user.id,
            planId: input.planId,
            amountStars: input.totalAmount,
            status: "paid",
            telegramPaymentChargeId: input.telegramPaymentChargeId,
            paidAt: now
          }
        });

        let subscription = await tx.subscription.findFirst({
          where: {
            userId: user.id,
            planId: input.planId,
            status: "active",
            expiresAt: { gte: now }
          },
          orderBy: { expiresAt: "desc" }
        });

        if (!subscription || !existingPayment) {
          subscription = await tx.subscription.create({
            data: {
              userId: user.id,
              planId: input.planId,
              status: "active",
              startedAt: now,
              expiresAt
            }
          });
        }

        return {
          payment: {
            id: payment.id,
            userId: user.id,
            planId: input.planId,
            amountStars: payment.amountStars,
            status: "paid",
            paidAt: payment.paidAt ?? now
          },
          subscription: {
            userId: user.id,
            planId: input.planId,
            status: "active",
            startedAt: subscription.startedAt,
            expiresAt: subscription.expiresAt
          }
        } satisfies SuccessfulPaymentState;
      });
    }
  };
}
