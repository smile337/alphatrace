import { Telegraf } from "telegraf";
import {
  type BotButton,
  buildBotCommands,
  buildStartMessage,
  buildSubscriptionConfirmation,
  createStarsInvoice,
  parseInvoicePayload,
  parseStartPayload,
  settleSuccessfulPayment,
  type BotPaymentStore
} from "./bot";

export interface AlphaTraceBotConfig {
  token: string;
  botUsername: string;
  miniAppUrl?: string;
  paymentStore: BotPaymentStore;
}

export function createAlphaTraceBot(config: AlphaTraceBotConfig): Telegraf {
  const bot = new Telegraf(config.token);

  bot.start(async (ctx) => {
    const payload = parseStartPayload(ctx.startPayload);
    if (payload.kind === "subscribe") {
      await ctx.sendInvoice(createStarsInvoice(payload.planId));
      return;
    }

    const startParam = payload.kind === "none" ? "direct" : `${payload.kind === "personal" ? "ref" : "kol"}_${payload.code}`;
    const message = buildStartMessage(startParam, config.botUsername, config.miniAppUrl);
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

    const state = await settleSuccessfulPayment(
      {
        userId: `tg_${ctx.from.id}`,
        telegramId: ctx.from.id,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        planId: payload.planId,
        telegramPaymentChargeId: payment.telegram_payment_charge_id,
        totalAmount: payment.total_amount
      },
      config.paymentStore
    );
    const message = buildSubscriptionConfirmation(state.subscription, config.botUsername, config.miniAppUrl);
    await ctx.reply(message.text, {
      reply_markup: { inline_keyboard: [[toTelegramButton(message.buttons[0])]] }
    });
  });

  return bot;
}

export async function configureAlphaTraceBot(bot: Telegraf, miniAppUrl?: string): Promise<void> {
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
}

function toTelegramButton(button: BotButton) {
  if ("webAppUrl" in button) {
    return { text: button.text, web_app: { url: button.webAppUrl } };
  }
  return { text: button.text, url: button.url };
}
