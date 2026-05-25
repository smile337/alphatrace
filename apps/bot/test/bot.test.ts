import { describe, expect, it } from "vitest";
import {
  buildBotCommands,
  buildSubscriptionConfirmation,
  buildStartMessage,
  createStarsInvoice,
  parseInvoicePayload,
  parseStartPayload,
  processSuccessfulPayment,
  settleSuccessfulPayment
} from "../src/bot";

describe("Telegram bot flows", () => {
  it("parses personal and KOL startapp payloads", () => {
    expect(parseStartPayload("ref_abc")).toEqual({ kind: "personal", code: "abc" });
    expect(parseStartPayload("kol_xyz")).toEqual({ kind: "kol", code: "xyz" });
    expect(parseStartPayload("subscribe_pro")).toEqual({ kind: "subscribe", planId: "pro" });
    expect(parseStartPayload("subscribe_elite")).toEqual({ kind: "subscribe", planId: "elite" });
    expect(parseStartPayload(undefined)).toEqual({ kind: "none" });
  });

  it("builds a start message without promising profit", () => {
    const message = buildStartMessage("ref_demo", "Alpha1TraceBot");
    expect(message.text).toContain("历史数据不代表未来收益");
    expect(message.buttons[0]).toEqual({
      text: "Open AlphaTrace",
      url: "https://t.me/Alpha1TraceBot?startapp=ref_demo"
    });
  });

  it("builds a start message with a Mini App web_app button when a URL is configured", () => {
    const message = buildStartMessage("ref_demo", "Alpha1TraceBot", "https://alpha.example/app");

    expect(message.buttons[0]).toEqual({
      text: "Open AlphaTrace",
      webAppUrl: "https://alpha.example/app?startapp=ref_demo"
    });
  });

  it("creates Stars invoices for digital subscriptions", () => {
    expect(createStarsInvoice("pro")).toMatchObject({
      title: "AlphaTrace Pro",
      currency: "XTR",
      prices: [{ label: "Pro monthly", amount: 999 }],
      provider_token: ""
    });
  });

  it("parses subscription invoice payloads defensively", () => {
    expect(parseInvoicePayload("subscribe:pro")).toEqual({ ok: true, planId: "pro" });
    expect(parseInvoicePayload("subscribe:elite")).toEqual({ ok: true, planId: "elite" });
    expect(parseInvoicePayload("subscribe:free")).toEqual({ ok: false, reason: "UNSUPPORTED_PLAN" });
    expect(parseInvoicePayload("bad-payload")).toEqual({ ok: false, reason: "INVALID_PAYLOAD" });
  });

  it("records successful payment state", () => {
    const result = processSuccessfulPayment({
      userId: "u1",
      planId: "elite",
      telegramPaymentChargeId: "charge_1",
      totalAmount: 2499
    });

    expect(result).toMatchObject({
      payment: { userId: "u1", planId: "elite", amountStars: 2499, status: "paid" },
      subscription: { userId: "u1", planId: "elite", status: "active" }
    });
  });

  it("persists successful payment state when a store is configured", async () => {
    const persisted = await settleSuccessfulPayment(
      {
        userId: "tg_1001",
        telegramId: 1001,
        username: "alice",
        firstName: "Alice",
        planId: "elite",
        telegramPaymentChargeId: "charge_1",
        totalAmount: 2499
      },
      {
        async recordSuccessfulPayment(input) {
          return {
            payment: {
              id: "db_payment_1",
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
      }
    );

    expect(persisted).toMatchObject({
      payment: { id: "db_payment_1", userId: "tg_1001", planId: "elite", amountStars: 2499, status: "paid" },
      subscription: { userId: "tg_1001", planId: "elite", status: "active" }
    });
  });

  it("builds a paid subscription confirmation with Mini App entry", () => {
    const state = processSuccessfulPayment({
      userId: "u1",
      planId: "pro",
      telegramPaymentChargeId: "charge_1",
      totalAmount: 999
    });

    const message = buildSubscriptionConfirmation(state.subscription, "Alpha1TraceBot");

    expect(message.text).toContain("Pro");
    expect(message.text).toContain("已开通");
    expect(message.text).toContain("历史数据不代表未来收益");
    expect(message.buttons[0]).toEqual({
      text: "Open AlphaTrace",
      url: "https://t.me/Alpha1TraceBot?startapp=direct"
    });
  });

  it("builds a paid subscription confirmation with configured Mini App URL", () => {
    const state = processSuccessfulPayment({
      userId: "u1",
      planId: "pro",
      telegramPaymentChargeId: "charge_1",
      totalAmount: 999
    });

    const message = buildSubscriptionConfirmation(state.subscription, "Alpha1TraceBot", "https://alpha.example/app");

    expect(message.buttons[0]).toEqual({
      text: "Open AlphaTrace",
      webAppUrl: "https://alpha.example/app?startapp=direct"
    });
  });

  it("exposes Telegram commands for onboarding, subscriptions, and support", () => {
    expect(buildBotCommands()).toEqual([
      { command: "start", description: "打开 AlphaTrace Mini App" },
      { command: "subscribe_pro", description: "订阅 Pro 计划" },
      { command: "subscribe_elite", description: "订阅 Elite 自动跟单" },
      { command: "paysupport", description: "Stars 支付与退款支持" }
    ]);
  });
});
