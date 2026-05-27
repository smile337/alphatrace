import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildApi, type ApiStore, type TradeIntentDto } from "../src/app";
import type { PlanId } from "@alphatrace/shared";
import { createDemoJupiterOrder } from "../src/demo-jupiter";

function signedInitData(fields: Record<string, string>, botToken: string): string {
  const dataCheckString = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

describe("AlphaTrace API", () => {
  function createApp(store?: ApiStore) {
    const demoOrder = createDemoJupiterOrder({
      amount: "1000",
      inputMint: "So11111111111111111111111111111111111111112",
      referralFeeBps: 75
    });
    return buildApi({
      botToken: "123456:abc",
      botUsername: "AlphaTraceBot",
      store,
      jupiter: {
        order: async () => ({
          requestId: "req_1",
          transaction: demoOrder.transaction,
          outAmount: "1000",
          feeBps: 75,
          feeMint: "So11111111111111111111111111111111111111112"
        }),
        execute: async () => ({ status: "Success", signature: "sig_1", code: 0 })
      }
    });
  }

  const app = buildApi({
    botToken: "123456:abc",
    botUsername: "AlphaTraceBot",
    jupiter: {
      order: async () => ({
        requestId: "req_1",
        transaction: "base64tx",
        outAmount: "1000",
        feeBps: 75,
        feeMint: "So11111111111111111111111111111111111111112"
      }),
      execute: async () => ({ status: "Success", signature: "sig_1", code: 0 })
    }
  });

  it("returns the Stars pricing ladder", async () => {
    const response = await app.inject({ method: "GET", url: "/api/plans" });
    expect(response.statusCode).toBe(200);
    expect(response.json().plans.map((plan: { id: string; starsPerMonth: number }) => [plan.id, plan.starsPerMonth])).toEqual([
      ["free", 0],
      ["pro", 999],
      ["elite", 2499],
      ["kol_room", 9999]
    ]);
  });

  it("authenticates Telegram initData and binds start params", async () => {
    const initData = signedInitData(
      {
        auth_date: Math.floor(Date.now() / 1000).toString(),
        user: JSON.stringify({ id: 1001, username: "alice", first_name: "Alice" }),
        start_param: "ref_demo"
      },
      "123456:abc"
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/telegram",
      payload: { initData }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      user: { telegramId: 1001, username: "alice" },
      referral: { startParam: "ref_demo" }
    });
  });

  it("serves smart wallets with historical risk labels", async () => {
    const response = await app.inject({ method: "GET", url: "/api/smart-wallets" });
    expect(response.statusCode).toBe(200);
    expect(response.json().wallets).toEqual([]);
    expect(response.json()).toMatchObject({ source: "live_store" });
  });

  it("only lists wallets that pass the smart wallet eligibility threshold", async () => {
    const store = createMemoryStoreForTest();
    await store.upsertSmartWallet({
      address: "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV",
      chain: "solana",
      score: 35,
      winRate: 0.35,
      realizedPnl30dUsd: 0,
      maxDrawdown30d: 0.34,
      riskLabel: "no_recent_swaps"
    });
    await store.upsertSmartWallet({
      address: "5hNQovY7mscduGNGVYBchecUPzNdnNHTTeFt85t58sq1",
      chain: "solana",
      score: 73,
      winRate: 0.58,
      realizedPnl30dUsd: 4200,
      maxDrawdown30d: 0.22,
      riskLabel: "active_swap_wallet",
      performance: createPerformance({ estimatedProfit30dUsd: 4200, tradeCount30d: 8 })
    });

    const response = await createApp(store).inject({ method: "GET", url: "/api/smart-wallets" });

    expect(response.statusCode).toBe(200);
    expect(response.json().wallets).toEqual([
      expect.objectContaining({
        address: "5hNQovY7mscduGNGVYBchecUPzNdnNHTTeFt85t58sq1",
        score: 73
      })
    ]);
  });

  it("imports a user supplied smart wallet through the analyzer", async () => {
    const store = createMemoryStoreForTest();
    const response = await buildApi({
      botToken: "123456:abc",
      botUsername: "AlphaTraceBot",
      store,
      smartWalletAnalyzer: {
        async analyzeWallet(address) {
          return {
            address,
            chain: "solana",
            score: 71,
            winRate: 0.58,
            realizedPnl30dUsd: 4200,
            maxDrawdown30d: 0.22,
            riskLabel: "active_swap_wallet",
            performance: createPerformance({ estimatedProfit30dUsd: 4200, tradeCount30d: 8 })
          };
        }
      },
      jupiter: {
        order: async () => ({
          requestId: "req_1",
          transaction: "base64tx",
          outAmount: "1000",
          feeBps: 75,
          feeMint: "So11111111111111111111111111111111111111112"
        }),
        execute: async () => ({ status: "Success", signature: "sig_1", code: 0 })
      }
    }).inject({
      method: "POST",
      url: "/api/smart-wallets/import",
      payload: {
        address: "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      eligible: true,
      wallet: {
        address: "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV",
        score: 71,
        riskLabel: "active_swap_wallet"
      }
    });
    expect(await store.listSmartWallets()).toHaveLength(1);
  });

  it("refreshes a current smart wallet and returns updated profitability details", async () => {
    const store = createMemoryStoreForTest();
    let analysisCalls = 0;
    const app = buildApi({
      botToken: "123456:abc",
      botUsername: "AlphaTraceBot",
      store,
      smartWalletAnalyzer: {
        async analyzeWallet(address) {
          analysisCalls += 1;
          return {
            address,
            chain: "solana",
            score: analysisCalls === 1 ? 64 : 82,
            winRate: analysisCalls === 1 ? 0.52 : 0.69,
            realizedPnl30dUsd: analysisCalls === 1 ? 1800 : 9300,
            maxDrawdown30d: analysisCalls === 1 ? 0.31 : 0.16,
            riskLabel: analysisCalls === 1 ? "active_swap_wallet" : "high_win_rate_low_frequency",
            performance: createPerformance({
              estimatedProfit30dUsd: analysisCalls === 1 ? 1800 : 9300,
              tradeCount30d: analysisCalls === 1 ? 4 : 12
            })
          };
        }
      },
      jupiter: {
        order: async () => ({
          requestId: "req_1",
          transaction: "base64tx",
          outAmount: "1000",
          feeBps: 75,
          feeMint: "So11111111111111111111111111111111111111112"
        }),
        execute: async () => ({ status: "Success", signature: "sig_1", code: 0 })
      }
    });
    const address = "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV";
    await app.inject({ method: "POST", url: "/api/smart-wallets/import", payload: { address } });

    const response = await app.inject({ method: "POST", url: `/api/smart-wallets/${address}/refresh` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      eligible: true,
      wallet: {
        address,
        score: 82,
        realizedPnl30dUsd: 9300,
        performance: {
          tradeCount30d: 12,
          estimatedProfit30dUsd: 9300
        }
      }
    });
    expect(analysisCalls).toBe(2);
  });

  it("imports but does not mark a low quality real address as displayable smart wallet", async () => {
    const store = createMemoryStoreForTest();
    const response = await buildApi({
      botToken: "123456:abc",
      botUsername: "AlphaTraceBot",
      store,
      smartWalletAnalyzer: {
        async analyzeWallet(address) {
          return {
            address,
            chain: "solana",
            score: 35,
            winRate: 0.35,
            realizedPnl30dUsd: 0,
            maxDrawdown30d: 0.34,
            riskLabel: "no_recent_swaps"
          };
        }
      },
      jupiter: {
        order: async () => ({
          requestId: "req_1",
          transaction: "base64tx",
          outAmount: "1000",
          feeBps: 75,
          feeMint: "So11111111111111111111111111111111111111112"
        }),
        execute: async () => ({ status: "Success", signature: "sig_1", code: 0 })
      }
    }).inject({
      method: "POST",
      url: "/api/smart-wallets/import",
      payload: {
        address: "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      eligible: false,
      wallet: {
        score: 35,
        riskLabel: "no_recent_swaps"
      }
    });
    expect((await createApp(store).inject({ method: "GET", url: "/api/smart-wallets" })).json().wallets).toEqual([]);
  });

  it("discovers candidate wallets from live market transactions and keeps only eligible wallets", async () => {
    const store = createMemoryStoreForTest();
    const app = buildApi({
      botToken: "123456:abc",
      botUsername: "AlphaTraceBot",
      store,
      smartWalletAnalyzer: {
        async discoverCandidateWallets(input) {
          expect(input?.limit).toBeGreaterThan(2);
          return [
            "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV",
            "9w6WK3Sz49Xiqp4kbaBpz4vZ8WMctdo1nHSQZsE3YKVF",
            "5hNQovY7mscduGNGVYBchecUPzNdnNHTTeFt85t58sq1"
          ];
        },
        async analyzeWallet(address) {
          return {
            address,
            chain: "solana",
            score: address.startsWith("5hNQ") ? 73 : 35,
            winRate: address.startsWith("5hNQ") ? 0.58 : 0.35,
            realizedPnl30dUsd: address.startsWith("5hNQ") ? 4200 : 0,
            maxDrawdown30d: address.startsWith("5hNQ") ? 0.22 : 0.34,
            riskLabel: address.startsWith("5hNQ") ? "active_swap_wallet" : "no_recent_swaps",
            performance: address.startsWith("5hNQ") ? createPerformance({ estimatedProfit30dUsd: 4200, tradeCount30d: 8 }) : undefined
          };
        }
      },
      jupiter: {
        order: async () => ({
          requestId: "req_1",
          transaction: "base64tx",
          outAmount: "1000",
          feeBps: 75,
          feeMint: "So11111111111111111111111111111111111111112"
        }),
        execute: async () => ({ status: "Success", signature: "sig_1", code: 0 })
      }
    });

    const response = await app.inject({ method: "POST", url: "/api/smart-wallets/discover", payload: { limit: 2 } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      imported: [expect.objectContaining({ address: "5hNQovY7mscduGNGVYBchecUPzNdnNHTTeFt85t58sq1", score: 73 })],
      rejected: expect.arrayContaining([expect.objectContaining({ address: "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV", score: 35 })]),
      source: "helius"
    });
  });

  it("reuses an imported smart wallet without spending another market data call", async () => {
    const store = createMemoryStoreForTest();
    let analysisCalls = 0;
    const app = buildApi({
      botToken: "123456:abc",
      botUsername: "AlphaTraceBot",
      store,
      smartWalletAnalyzer: {
        async analyzeWallet(address) {
          analysisCalls += 1;
          return {
            address,
            chain: "solana",
            score: 71,
            winRate: 0.58,
            realizedPnl30dUsd: 4200,
            maxDrawdown30d: 0.22,
            riskLabel: "active_swap_wallet"
          };
        }
      },
      jupiter: {
        order: async () => ({
          requestId: "req_1",
          transaction: "base64tx",
          outAmount: "1000",
          feeBps: 75,
          feeMint: "So11111111111111111111111111111111111111112"
        }),
        execute: async () => ({ status: "Success", signature: "sig_1", code: 0 })
      }
    });

    const payload = { address: "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV" };
    const first = await app.inject({ method: "POST", url: "/api/smart-wallets/import", payload });
    const second = await app.inject({ method: "POST", url: "/api/smart-wallets/import", payload });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({ source: "cache" });
    expect(analysisCalls).toBe(1);
  });

  it("rejects smart wallet import when the market data source is not configured", async () => {
    const response = await createApp(createMemoryStoreForTest()).inject({
      method: "POST",
      url: "/api/smart-wallets/import",
      payload: {
        address: "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV"
      }
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ code: "SMART_WALLET_DATA_SOURCE_UNCONFIGURED" });
  });

  it("enforces free watchlist limits", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/watchlist",
      payload: {
        userId: "free_user",
        planId: "free",
        existingWatchCount: 3,
        walletAddress: "SmartWallet111111111111111111111111111111111"
      }
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: "WALLET_LIMIT_EXCEEDED" });
  });

  it("enforces watchlist limits from persisted watches instead of client counters", async () => {
    const store = createMemoryStoreForTest({
      watchCount: 3
    });
    const response = await createApp(store).inject({
      method: "POST",
      url: "/api/watchlist",
      payload: {
        userId: "free_user",
        planId: "free",
        existingWatchCount: 0,
        walletAddress: "SmartWallet111111111111111111111111111111111"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: "WALLET_LIMIT_EXCEEDED", walletLimit: 3 });
  });

  it("persists wallet watches through the configured store", async () => {
    const store = createMemoryStoreForTest({ activePlanId: "pro" });
    const response = await createApp(store).inject({
      method: "POST",
      url: "/api/watchlist",
      payload: {
        userId: "pro_user",
        planId: "pro",
        walletAddress: "SmartWallet111111111111111111111111111111111"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      watch: {
        userId: "pro_user",
        walletAddress: "SmartWallet111111111111111111111111111111111",
        realtime: true
      }
    });
    expect(store.createdWatches).toHaveLength(1);
  });

  it("persists copy rules through the configured store", async () => {
    const store = createMemoryStoreForTest({ activePlanId: "elite" });
    const response = await createApp(store).inject({
      method: "POST",
      url: "/api/copy-rules",
      payload: {
        userId: "elite_user",
        planId: "elite",
        walletAddress: "SmartWallet111111111111111111111111111111111",
        maxSingleTradeUsd: 100,
        maxDailyLossUsd: 300,
        maxSlippageBps: 250,
        blacklist: ["BadMint111111111111111111111111111111111111"]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      rule: {
        userId: "elite_user",
        walletAddress: "SmartWallet111111111111111111111111111111111",
        mode: "auto",
        emergencyPaused: false
      }
    });
    expect(store.createdCopyRules).toHaveLength(1);
  });

  it("uses the persisted active subscription instead of the client-supplied plan", async () => {
    const store = createMemoryStoreForTest({ activePlanId: "free" });
    const response = await createApp(store).inject({
      method: "POST",
      url: "/api/copy-rules",
      payload: {
        userId: "free_user",
        planId: "elite",
        walletAddress: "SmartWallet111111111111111111111111111111111",
        maxSingleTradeUsd: 100,
        maxDailyLossUsd: 300,
        maxSlippageBps: 250,
        blacklist: []
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: "COPY_TRADING_REQUIRES_PRO", planId: "free" });
    expect(store.createdCopyRules).toHaveLength(0);
  });

  it("returns the active subscription plan for a user", async () => {
    const store = createMemoryStoreForTest({ activePlanId: "pro" });
    const response = await createApp(store).inject({
      method: "GET",
      url: "/api/subscriptions/active?userId=pro_user"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      subscription: { userId: "pro_user", planId: "pro", status: "active" },
      plan: { id: "pro", walletLimit: 20 }
    });
  });

  it("creates and lists trade intents through the configured store", async () => {
    const store = createMemoryStoreForTest();
    const createResponse = await createApp(store).inject({
      method: "POST",
      url: "/api/trade-intents",
      payload: {
        userId: "elite_user",
        tokenMint: "Token111111111111111111111111111111111111111",
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: "1000000",
        amountUsd: 50,
        riskReasons: []
      }
    });

    expect(createResponse.statusCode).toBe(200);
    expect(createResponse.json()).toMatchObject({
      intent: {
        userId: "elite_user",
        tokenMint: "Token111111111111111111111111111111111111111",
        status: "needs_user_confirmation",
        riskReasons: []
      }
    });

    const listResponse = await createApp(store).inject({
      method: "GET",
      url: "/api/trade-intents?userId=elite_user"
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().tradeIntents).toHaveLength(1);
  });

  it("creates a Jupiter order from a trade intent and marks it ready for signature", async () => {
    const store = createMemoryStoreForTest({ activePlanId: "elite" });
    const app = createApp(store);
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/trade-intents",
      payload: {
        userId: "elite_user",
        tokenMint: "Token111111111111111111111111111111111111111",
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: "1000000",
        amountUsd: 50,
        riskReasons: []
      }
    });
    const intentId = createResponse.json().intent.id;

    const orderResponse = await app.inject({
      method: "POST",
      url: `/api/trade-intents/${intentId}/order`,
      payload: {
        planId: "elite",
        taker: "Taker111111111111111111111111111111111111"
      }
    });

    expect(orderResponse.statusCode).toBe(200);
    expect(orderResponse.json()).toMatchObject({
      order: { requestId: "req_1", transaction: expect.any(String) },
      executionFeeBps: 50,
      intent: {
        id: intentId,
        status: "ready_for_signature",
        jupiterRequestId: "req_1"
      }
    });
  });

  it("does not mark a trade intent ready when Jupiter returns no transaction", async () => {
    const store = createMemoryStoreForTest({ activePlanId: "pro" });
    const app = buildApi({
      botToken: "123456:abc",
      botUsername: "AlphaTraceBot",
      store,
      jupiter: {
        order: async () => ({
          requestId: "req_empty",
          transaction: "",
          outAmount: "1000",
          feeBps: 75,
          feeMint: "So11111111111111111111111111111111111111112",
          errorMessage: "Insufficient funds"
        }),
        execute: async () => ({ status: "Success", signature: "sig_1", code: 0 })
      }
    });
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/trade-intents",
      payload: {
        userId: "pro_user",
        tokenMint: "Token111111111111111111111111111111111111111",
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: "1000000",
        amountUsd: 50,
        riskReasons: []
      }
    });
    const intentId = createResponse.json().intent.id;

    const orderResponse = await app.inject({
      method: "POST",
      url: `/api/trade-intents/${intentId}/order`,
      payload: {
        planId: "pro",
        taker: "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV"
      }
    });
    const listResponse = await app.inject({ method: "GET", url: "/api/trade-intents?userId=pro_user" });

    expect(orderResponse.statusCode).toBe(422);
    expect(orderResponse.json()).toMatchObject({
      code: "JUPITER_ORDER_UNAVAILABLE",
      errorMessage: "Insufficient funds",
      requestId: "req_empty"
    });
    expect(listResponse.json().tradeIntents[0]).toMatchObject({
      id: intentId,
      status: "needs_user_confirmation",
      jupiterRequestId: null
    });
  });

  it("executes a ready trade intent and records the signature", async () => {
    const store = createMemoryStoreForTest();
    const app = createApp(store);
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/trade-intents",
      payload: {
        userId: "elite_user",
        tokenMint: "Token111111111111111111111111111111111111111",
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: "1000000",
        amountUsd: 50,
        riskReasons: []
      }
    });
    const intentId = createResponse.json().intent.id;
    const orderResponse = await app.inject({
      method: "POST",
      url: `/api/trade-intents/${intentId}/order`,
      payload: {
        planId: "elite",
        taker: "Taker111111111111111111111111111111111111"
      }
    });
    const signedTransaction = orderResponse.json().order.transaction;

    const executeResponse = await app.inject({
      method: "POST",
      url: `/api/trade-intents/${intentId}/execute`,
      payload: {
        signedTransaction
      }
    });

    expect(executeResponse.statusCode).toBe(200);
    expect(executeResponse.json()).toMatchObject({
      result: { status: "Success", signature: "sig_1" },
      intent: {
        id: intentId,
        status: "succeeded",
        signature: "sig_1"
      }
    });
  });

  it("returns the recorded signature when a succeeded trade intent is executed again", async () => {
    const store = createMemoryStoreForTest();
    const demoOrder = createDemoJupiterOrder({
      amount: "1000",
      inputMint: "So11111111111111111111111111111111111111112",
      referralFeeBps: 75
    });
    let executeCalls = 0;
    const app = buildApi({
      botToken: "123456:abc",
      botUsername: "AlphaTraceBot",
      store,
      jupiter: {
        order: async () => ({
          requestId: "req_1",
          transaction: demoOrder.transaction,
          outAmount: "1000",
          feeBps: 75,
          feeMint: "So11111111111111111111111111111111111111112"
        }),
        execute: async () => {
          executeCalls += 1;
          return { status: "Success", signature: "sig_1", code: 0 };
        }
      }
    });
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/trade-intents",
      payload: {
        userId: "elite_user",
        tokenMint: "Token111111111111111111111111111111111111111",
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: "1000000",
        amountUsd: 50,
        riskReasons: []
      }
    });
    const intentId = createResponse.json().intent.id;
    const orderResponse = await app.inject({
      method: "POST",
      url: `/api/trade-intents/${intentId}/order`,
      payload: {
        planId: "elite",
        taker: "Taker111111111111111111111111111111111111"
      }
    });
    const signedTransaction = orderResponse.json().order.transaction;
    await app.inject({
      method: "POST",
      url: `/api/trade-intents/${intentId}/execute`,
      payload: {
        signedTransaction
      }
    });

    const replayResponse = await app.inject({
      method: "POST",
      url: `/api/trade-intents/${intentId}/execute`,
      payload: {
        signedTransaction
      }
    });

    expect(replayResponse.statusCode).toBe(200);
    expect(replayResponse.json()).toMatchObject({
      result: { status: "Success", signature: "sig_1", code: 0 },
      intent: { id: intentId, status: "succeeded", signature: "sig_1" }
    });
    expect(executeCalls).toBe(1);
  });

  it("passes Telegram webhook updates to the configured bot handler", async () => {
    const updates: unknown[] = [];
    const app = buildApi({
      botToken: "123456:abc",
      botUsername: "AlphaTraceBot",
      store: createMemoryStoreForTest(),
      telegramWebhookHandler: async (update) => {
        updates.push(update);
      },
      jupiter: {
        order: async () => ({
          requestId: "req_1",
          transaction: "tx_1",
          outAmount: "1000",
          feeBps: 75,
          feeMint: "So11111111111111111111111111111111111111112"
        }),
        execute: async () => ({ status: "Success", signature: "sig_1", code: 0 })
      }
    });
    const update = { update_id: 1, message: { message_id: 2, text: "/start" } };

    const response = await app.inject({
      method: "POST",
      url: "/api/telegram/webhook",
      payload: update
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(updates).toEqual([update]);
  });

  it("rejects duplicate trade intent execution while the first submit is in flight", async () => {
    const store = createMemoryStoreForTest();
    const demoOrder = createDemoJupiterOrder({
      amount: "1000",
      inputMint: "So11111111111111111111111111111111111111112",
      referralFeeBps: 75
    });
    let executeCalls = 0;
    let resolveFirstExecute!: (result: { status: "Success"; signature: string; code: number }) => void;
    const firstExecute = new Promise<{ status: "Success"; signature: string; code: number }>((resolve) => {
      resolveFirstExecute = resolve;
    });
    const app = buildApi({
      botToken: "123456:abc",
      botUsername: "AlphaTraceBot",
      store,
      jupiter: {
        order: async () => ({
          requestId: "req_1",
          transaction: demoOrder.transaction,
          outAmount: "1000",
          feeBps: 75,
          feeMint: "So11111111111111111111111111111111111111112"
        }),
        execute: async () => {
          executeCalls += 1;
          if (executeCalls === 1) {
            return firstExecute;
          }
          return { status: "Success", signature: "sig_duplicate", code: 0 };
        }
      }
    });
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/trade-intents",
      payload: {
        userId: "elite_user",
        tokenMint: "Token111111111111111111111111111111111111111",
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: "1000000",
        amountUsd: 50,
        riskReasons: []
      }
    });
    const intentId = createResponse.json().intent.id;
    const orderResponse = await app.inject({
      method: "POST",
      url: `/api/trade-intents/${intentId}/order`,
      payload: {
        planId: "elite",
        taker: "Taker111111111111111111111111111111111111"
      }
    });

    const firstResponse = app.inject({
      method: "POST",
      url: `/api/trade-intents/${intentId}/execute`,
      payload: {
        signedTransaction: orderResponse.json().order.transaction
      }
    });
    while (executeCalls === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const duplicateResponse = await app.inject({
      method: "POST",
      url: `/api/trade-intents/${intentId}/execute`,
      payload: {
        signedTransaction: orderResponse.json().order.transaction
      }
    });

    expect(duplicateResponse.statusCode).toBe(409);
    expect(duplicateResponse.json()).toMatchObject({ code: "TRADE_INTENT_ALREADY_SUBMITTED" });
    expect(executeCalls).toBe(1);

    resolveFirstExecute({ status: "Success", signature: "sig_1", code: 0 });
    expect((await firstResponse).json()).toMatchObject({
      result: { status: "Success", signature: "sig_1" },
      intent: { status: "succeeded", signature: "sig_1" }
    });
  });

  it("marks a trade intent failed when Jupiter execution throws", async () => {
    const store = createMemoryStoreForTest();
    const demoOrder = createDemoJupiterOrder({
      amount: "1000",
      inputMint: "So11111111111111111111111111111111111111112",
      referralFeeBps: 75
    });
    const app = buildApi({
      botToken: "123456:abc",
      botUsername: "AlphaTraceBot",
      store,
      jupiter: {
        order: async () => ({
          requestId: "req_1",
          transaction: demoOrder.transaction,
          outAmount: "1000",
          feeBps: 75,
          feeMint: "So11111111111111111111111111111111111111112"
        }),
        execute: async () => {
          throw new Error("Jupiter execute failed: 502 upstream unavailable");
        }
      }
    });
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/trade-intents",
      payload: {
        userId: "elite_user",
        tokenMint: "Token111111111111111111111111111111111111111",
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: "1000000",
        amountUsd: 50,
        riskReasons: []
      }
    });
    const intentId = createResponse.json().intent.id;
    const orderResponse = await app.inject({
      method: "POST",
      url: `/api/trade-intents/${intentId}/order`,
      payload: {
        planId: "elite",
        taker: "Taker111111111111111111111111111111111111"
      }
    });

    const executeResponse = await app.inject({
      method: "POST",
      url: `/api/trade-intents/${intentId}/execute`,
      payload: {
        signedTransaction: orderResponse.json().order.transaction
      }
    });

    expect(executeResponse.statusCode).toBe(502);
    expect(executeResponse.json()).toMatchObject({ code: "JUPITER_EXECUTE_FAILED" });
    expect(await store.getTradeIntent(intentId)).toMatchObject({ status: "failed", signature: null });
  });

  it("rejects invalid signed transactions before executing a trade intent", async () => {
    const store = createMemoryStoreForTest();
    const app = createApp(store);
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/trade-intents",
      payload: {
        userId: "elite_user",
        tokenMint: "Token111111111111111111111111111111111111111",
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: "1000000",
        amountUsd: 50,
        riskReasons: []
      }
    });
    const intentId = createResponse.json().intent.id;
    await app.inject({
      method: "POST",
      url: `/api/trade-intents/${intentId}/order`,
      payload: {
        planId: "elite",
        taker: "Taker111111111111111111111111111111111111"
      }
    });

    const executeResponse = await app.inject({
      method: "POST",
      url: `/api/trade-intents/${intentId}/execute`,
      payload: {
        signedTransaction: "not-a-solana-transaction"
      }
    });

    expect(executeResponse.statusCode).toBe(400);
    expect(executeResponse.json()).toMatchObject({ code: "INVALID_SIGNED_TRANSACTION" });
    expect(await store.getTradeIntent(intentId)).toMatchObject({ status: "ready_for_signature", signature: null });
  });

  it("creates share cards with the inviter's Telegram link", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/share-cards",
      payload: { userId: "u1", cardType: "weekly_top5" }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      card: {
        cardType: "weekly_top5",
        inviteLink: expect.stringContaining("https://t.me/AlphaTraceBot?startapp=ref_")
      }
    });
  });

  it("returns KOL dashboard metrics", async () => {
    const response = await app.inject({ method: "GET", url: "/api/kol/dashboard?kolUserId=kol_1" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      dashboard: {
        newUsers: expect.any(Number),
        paidUsers: expect.any(Number),
        mrrStars: expect.any(Number),
        tradingVolumeUsd: expect.any(Number),
        commissionStars: expect.any(Number)
      }
    });
  });

  it("proxies Jupiter orders with transparent execution fee", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/swap/order",
      payload: {
        userId: "u1",
        planId: "pro",
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: "1000000",
        taker: "Taker111111111111111111111111111111111111"
      }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      order: { requestId: "req_1", transaction: "base64tx" },
      executionFeeBps: 75
    });
  });
});

function createMemoryStoreForTest(options: { watchCount?: number; activePlanId?: PlanId } = {}): ApiStore & {
  createdWatches: unknown[];
  createdCopyRules: unknown[];
} {
  const createdWatches: unknown[] = [];
  const createdCopyRules: unknown[] = [];
  const tradeIntents: TradeIntentDto[] = [];
  const smartWallets: Awaited<ReturnType<ApiStore["listSmartWallets"]>> = [];

  return {
    createdWatches,
    createdCopyRules,
    async upsertTelegramUser(input) {
      return {
        id: `tg_${input.telegramId}`,
        telegramId: input.telegramId,
        username: input.username,
        firstName: input.firstName
      };
    },
    async listSmartWallets() {
      return smartWallets;
    },
    async getSmartWallet(address) {
      return smartWallets.find((wallet) => wallet.address === address) ?? null;
    },
    async upsertSmartWallet(input) {
      const existingIndex = smartWallets.findIndex((wallet) => wallet.address === input.address);
      if (existingIndex >= 0) {
        smartWallets[existingIndex] = input;
      } else {
        smartWallets.push(input);
      }
      return input;
    },
    async getActiveSubscription(userId) {
      if (!options.activePlanId || options.activePlanId === "free") {
        return null;
      }
      return {
        userId,
        planId: options.activePlanId,
        status: "active",
        expiresAt: "2026-06-19T00:00:00.000Z"
      };
    },
    async countWalletWatches() {
      return options.watchCount ?? createdWatches.length;
    },
    async upsertWalletWatch(input) {
      const watch = {
        id: `watch_${input.userId}_${input.walletAddress.slice(0, 8)}`,
        ...input
      };
      createdWatches.push(watch);
      return watch;
    },
    async upsertCopyRule(input) {
      const rule = {
        id: `rule_${input.userId}_${input.walletAddress.slice(0, 8)}`,
        ...input,
        emergencyPaused: false
      };
      createdCopyRules.push(rule);
      return rule;
    },
    async createTradeIntent(input) {
      const intent: TradeIntentDto = {
        id: `intent_${tradeIntents.length + 1}`,
        ...input,
        status: input.riskReasons.length > 0 ? "blocked_by_risk" : "needs_user_confirmation",
        jupiterRequestId: null,
        signature: null
      };
      tradeIntents.push(intent);
      return intent;
    },
    async listTradeIntents(userId) {
      return tradeIntents.filter((intent) => intent.userId === userId);
    },
    async getTradeIntent(id) {
      return tradeIntents.find((intent) => intent.id === id) ?? null;
    },
    async markTradeIntentReady(input) {
      const intent = tradeIntents.find((candidate) => candidate.id === input.id);
      if (!intent) throw new Error("missing intent");
      intent.status = "ready_for_signature";
      intent.jupiterRequestId = input.jupiterRequestId;
      return intent;
    },
    async markTradeIntentSubmitted(input) {
      const intent = tradeIntents.find((candidate) => candidate.id === input.id);
      if (!intent) throw new Error("missing intent");
      if (intent.status !== "ready_for_signature") return null;
      intent.status = "submitted";
      return intent;
    },
    async markTradeIntentExecuted(input) {
      const intent = tradeIntents.find((candidate) => candidate.id === input.id);
      if (!intent) throw new Error("missing intent");
      intent.status = input.status;
      intent.signature = input.signature ?? null;
      return intent;
    }
  };
}

function createPerformance(input: { estimatedProfit30dUsd: number; tradeCount30d: number }) {
  return {
    tradeCount30d: input.tradeCount30d,
    winCount30d: Math.max(0, Math.round(input.tradeCount30d * 0.6)),
    lossCount30d: Math.max(0, input.tradeCount30d - Math.round(input.tradeCount30d * 0.6)),
    estimatedProfit30dUsd: input.estimatedProfit30dUsd,
    decisionProfitUsd: input.estimatedProfit30dUsd,
    stablecoinNetFlowUsd: input.estimatedProfit30dUsd,
    costCoveragePct: 100,
    openPositionCount: 0,
    profitConfidence: "high" as const,
    profitSignal: "realized" as const,
    avgTradeSizeUsd: Math.max(1, Math.round(input.estimatedProfit30dUsd / Math.max(1, input.tradeCount30d))),
    largestWinUsd: Math.max(1, Math.round(input.estimatedProfit30dUsd * 0.28)),
    largestLossUsd: -Math.max(1, Math.round(input.estimatedProfit30dUsd * 0.11)),
    lastTradeAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
    dataSource: "helius_enhanced_transactions"
  };
}
