import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { prisma } from "@alphatrace/db";
import { buildApi } from "./app";
import { createHeliusSmartWalletAnalyzer } from "./helius-smart-wallet";
import { createJupiterHttpClient } from "./jupiter-http";
import { createPrismaApiStore } from "./prisma-store";

loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const jupiter = createJupiterHttpClient({
  baseUrl: process.env.JUPITER_BASE_URL,
  apiKey: process.env.JUPITER_API_KEY,
  referralAccount: process.env.JUPITER_REFERRAL_ACCOUNT
});

const app = buildApi({
  botToken: process.env.TELEGRAM_BOT_TOKEN ?? "dev:token",
  botUsername: process.env.TELEGRAM_BOT_USERNAME ?? "AlphaTraceBot",
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
