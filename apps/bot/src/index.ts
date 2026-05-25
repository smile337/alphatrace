import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { prisma } from "@alphatrace/db";
import { Telegraf } from "telegraf";
import {
  type BotButton,
  buildBotCommands,
  buildStartMessage,
  buildSubscriptionConfirmation,
  createStarsInvoice,
  parseInvoicePayload,
  parseStartPayload,
  settleSuccessfulPayment
} from "./bot";
import { createPrismaBotPaymentStore } from "./prisma-store";

loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const token = process.env.TELEGRAM_BOT_TOKEN;
const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? "AlphaTraceBot";
const miniAppUrl = process.env.MINI_APP_URL;
const paymentStore = createPrismaBotPaymentStore(prisma);

if (!token) {
  console.log("Set TELEGRAM_BOT_TOKEN to run the AlphaTrace bot.");
  process.exit(0);
}

const bot = new Telegraf(token);

try {
  await bot.telegram.setMyCommands(buildBotCommands());
  if (miniAppUrl) {
    await bot.telegram.setChatMenuButton({
      menuButton: {
        type: "web_app",
        text: "Open AlphaTrace",
        web_app: { url: miniAppUrl }
      }
    });
  }
} catch (error) {
  const reason = error instanceof Error ? error.message.replace(token, "[redacted-token]") : "unknown error";
  console.warn(`Telegram bot menu setup failed; continuing startup. ${reason}`);
}

bot.start(async (ctx) => {
  const payload = parseStartPayload(ctx.startPayload);
  if (payload.kind === "subscribe") {
    await ctx.sendInvoice(createStarsInvoice(payload.planId));
    return;
  }

  const startParam = payload.kind === "none" ? "direct" : `${payload.kind === "personal" ? "ref" : "kol"}_${payload.code}`;
  const message = buildStartMessage(startParam, botUsername, miniAppUrl);
  await ctx.reply(message.text, {
    reply_markup: { inline_keyboard: [[toTelegramButton(message.buttons[0])]] }
  });
});

bot.command("subscribe_pro", async (ctx) => {
  await ctx.sendInvoice(createStarsInvoice("pro"));
});

bot.command("subscribe_elite", async (ctx) => {
  await ctx.sendInvoice(createStarsInvoice("elite"));
});

bot.command("paysupport", async (ctx) => {
  await ctx.reply("请发送你的支付截图、Telegram charge id 或订阅问题。我们会按 Telegram Stars 规则处理退款和支持。");
});

bot.on("pre_checkout_query", async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

bot.on("successful_payment", async (ctx) => {
  const payment = ctx.message.successful_payment;
  const payload = parseInvoicePayload(payment.invoice_payload);
  if (!payload.ok) {
    await ctx.reply("支付已收到，但订阅 payload 无法识别。请发送 /paysupport 联系支持处理。");
    return;
  }

  const state = await settleSuccessfulPayment({
    userId: `tg_${ctx.from.id}`,
    telegramId: ctx.from.id,
    username: ctx.from.username,
    firstName: ctx.from.first_name,
    planId: payload.planId,
    telegramPaymentChargeId: payment.telegram_payment_charge_id,
    totalAmount: payment.total_amount
  }, paymentStore);
  const message = buildSubscriptionConfirmation(state.subscription, botUsername, miniAppUrl);
  await ctx.reply(message.text, {
    reply_markup: { inline_keyboard: [[toTelegramButton(message.buttons[0])]] }
  });
});

bot.launch();
console.log("AlphaTrace Telegram bot started.");

function toTelegramButton(button: BotButton) {
  if ("webAppUrl" in button) {
    return { text: button.text, web_app: { url: button.webAppUrl } };
  }
  return { text: button.text, url: button.url };
}
