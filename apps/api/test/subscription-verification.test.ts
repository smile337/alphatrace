import { describe, expect, it } from "vitest";
import { verifySubscriptionPersistence } from "../src/subscription-verification";

describe("subscription persistence verification", () => {
  it("confirms a Bot payment can be read through the API subscription store", async () => {
    let persistedPlanId: "pro" | "elite" | "kol_room" | null = null;

    const result = await verifySubscriptionPersistence({
      userId: "tg_1001",
      telegramId: 1001,
      planId: "elite",
      chargeId: "verify_charge_1",
      amountStars: 2499,
      botStore: {
        async recordSuccessfulPayment(input) {
          persistedPlanId = input.planId;
          return {
            payment: {
              id: "payment_1",
              userId: input.userId,
              planId: input.planId,
              amountStars: input.totalAmount,
              status: "paid",
              paidAt: new Date("2026-05-19T00:00:00.000Z")
            },
            subscription: {
              userId: input.userId,
              planId: input.planId,
              status: "active",
              startedAt: new Date("2026-05-19T00:00:00.000Z"),
              expiresAt: new Date("2026-06-18T00:00:00.000Z")
            }
          };
        }
      },
      apiStore: {
        async getActiveSubscription(userId) {
          return persistedPlanId
            ? {
                userId,
                planId: persistedPlanId,
                status: "active",
                expiresAt: "2026-06-18T00:00:00.000Z"
              }
            : null;
        }
      }
    });

    expect(result).toEqual({
      ok: true,
      userId: "tg_1001",
      planId: "elite",
      expiresAt: "2026-06-18T00:00:00.000Z"
    });
  });

  it("reports a mismatch when API cannot read the paid plan", async () => {
    const result = await verifySubscriptionPersistence({
      userId: "tg_1001",
      telegramId: 1001,
      planId: "pro",
      chargeId: "verify_charge_2",
      amountStars: 999,
      botStore: {
        async recordSuccessfulPayment(input) {
          return {
            payment: {
              id: "payment_2",
              userId: input.userId,
              planId: input.planId,
              amountStars: input.totalAmount,
              status: "paid",
              paidAt: new Date("2026-05-19T00:00:00.000Z")
            },
            subscription: {
              userId: input.userId,
              planId: input.planId,
              status: "active",
              startedAt: new Date("2026-05-19T00:00:00.000Z"),
              expiresAt: new Date("2026-06-18T00:00:00.000Z")
            }
          };
        }
      },
      apiStore: {
        async getActiveSubscription() {
          return null;
        }
      }
    });

    expect(result).toEqual({
      ok: false,
      reason: "ACTIVE_SUBSCRIPTION_NOT_FOUND",
      userId: "tg_1001",
      expectedPlanId: "pro"
    });
  });
});
