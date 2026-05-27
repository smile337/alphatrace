import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { prisma } from "@alphatrace/db";
import { configureAlphaTraceBot, createAlphaTraceBot } from "../../bot/src/telegram-bot";
import { createPrismaBotPaymentStore } from "../../bot/src/prisma-store";
import { buildApi } from "./app";
import { createHeliusSmartWalletAnalyzer } from "./helius-smart-wallet";
import { createJupiterHttpClient } from "./jupiter-http";
import { createPrismaApiStore } from "./prisma-store";

loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const botToken = process.env.TELEGRAM_BOT_TOKEN ?? "dev:token";
const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? "AlphaTraceBot";
const miniAppUrl = process.env.MINI_APP_URL;
const telegramBot = botToken === "dev:token"
  ? null
  : createAlphaTraceBot({
    token: botToken,
    botUsername,
    miniAppUrl,
    paymentStore: createPrismaBotPaymentStore(prisma)
  });

const webhookBaseUrl = process.env.TELEGRAM_WEBHOOK_BASE_URL ?? process.env.RENDER_EXTERNAL_URL;
if (telegramBot && webhookBaseUrl) {
  const webhookUrl = new URL("/api/telegram/webhook", webhookBaseUrl).toString();
  try {
    await configureAlphaTraceBot(telegramBot, miniAppUrl);
    await telegramBot.telegram.setWebhook(webhookUrl, {
      allowed_updates: ["message", "pre_checkout_query"]
    });
    console.log(`AlphaTrace Telegram webhook configured at ${webhookUrl}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message.replace(botToken, "[redacted-token]") : "unknown error";
    console.warn(`Telegram webhook setup failed; continuing API startup. ${reason}`);
  }
}

const jupiter = createJupiterHttpClient({
  baseUrl: process.env.JUPITER_BASE_URL,
  apiKey: process.env.JUPITER_API_KEY,
  referralAccount: process.env.JUPITER_REFERRAL_ACCOUNT
});

const app = buildApi({
  botToken,
  botUsername,
  telegramWebhookHandler: telegramBot ? (update) => telegramBot.handleUpdate(update as never) : undefined,
  store: createPrismaApiStore(prisma),
  smartWalletAnalyzer: createHeliusSmartWalletAnalyzer({
    apiKey: process.env.HELIUS_API_KEY,
    baseUrl: process.env.HELIUS_BASE_URL,
    discoveryAddresses: process.env.SMART_WALLET_DISCOVERY_ADDRESSES?.split(",").map((address) => address.trim()).filter(Boolean),
    discoveryTransactionLimit: Number(process.env.SMART_WALLET_DISCOVERY_TX_LIMIT ?? 20),
    discoveryCandidateLimit: Number(process.env.SMART_WALLET_DISCOVERY_CANDIDATE_LIMIT ?? 30)
  }),
  jupiter
});

const port = Number(process.env.PORT ?? 4000);
await app.listen({ port, host: "0.0.0.0" });
console.log(`AlphaTrace API listening on http://localhost:${port}`);
