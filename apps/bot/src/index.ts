import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { prisma } from "@alphatrace/db";
import { configureAlphaTraceBot, createAlphaTraceBot } from "./telegram-bot";
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

const bot = createAlphaTraceBot({
  token,
  botUsername,
  miniAppUrl,
  paymentStore
});

try {
  await configureAlphaTraceBot(bot, miniAppUrl);
} catch (error) {
  const reason = error instanceof Error ? error.message.replace(token, "[redacted-token]") : "unknown error";
  console.warn(`Telegram bot menu setup failed; continuing startup. ${reason}`);
}

bot.launch();
console.log("AlphaTrace Telegram bot started.");
