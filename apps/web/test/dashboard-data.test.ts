import { describe, expect, it, vi } from "vitest";
import { loadDashboardData } from "../src/lib/dashboard-data";

describe("Mini App dashboard data", () => {
  it("loads plans and smart wallets from the API", async () => {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.endsWith("/api/plans")
          ? {
              plans: [
                {
                  id: "pro",
                  name: "Pro",
                  starsPerMonth: 999,
                  walletLimit: 20,
                  dailyAlertLimit: "unlimited",
                  realtimeAlerts: true,
                  copyMode: "confirm",
                  executionFeeBps: 75,
                  features: []
                }
              ]
            }
          : url.endsWith("/api/subscriptions/active?userId=demo_web_user")
            ? {
                subscription: {
                  userId: "demo_web_user",
                  planId: "pro",
                  status: "active",
                  expiresAt: "2026-06-19T00:00:00.000Z"
                },
                plan: {
                  id: "pro",
                  name: "Pro",
                  starsPerMonth: 999,
                  walletLimit: 20,
                  dailyAlertLimit: "unlimited",
                  realtimeAlerts: true,
                  copyMode: "confirm",
                  executionFeeBps: 75,
                  features: []
                }
              }
          : {
              wallets: [
                {
                  address: "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV",
                  chain: "solana",
                  score: 88,
                  winRate: 0.62,
                  realizedPnl30dUsd: 18420,
                  maxDrawdown30d: 0.18,
                  riskLabel: "high_win_rate_low_frequency"
                }
              ]
            }
    })) as unknown as typeof fetch;

    const data = await loadDashboardData({
      apiBaseUrl: "https://api.example",
      fetcher: fetchMock
    });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example/api/plans", { cache: "no-store" });
    expect(fetchMock).toHaveBeenCalledWith("https://api.example/api/smart-wallets", { cache: "no-store" });
    expect(fetchMock).toHaveBeenCalledWith("https://api.example/api/subscriptions/active?userId=demo_web_user", { cache: "no-store" });
    expect(data.source).toBe("api");
    expect(data.plans).toHaveLength(1);
    expect(data.activePlan).toMatchObject({ id: "pro", copyMode: "confirm" });
    expect(data.wallets[0]).toMatchObject({
      address: "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV",
      shortAddress: "HhNPPxw...L1uV",
      score: 88,
      pnl: "+18.4K",
      color: "green"
    });
  });

  it("loads the active subscription for the authenticated Telegram user", async () => {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.endsWith("/api/plans")
          ? { plans: [{ id: "elite", name: "Elite", starsPerMonth: 2499, walletLimit: 100, dailyAlertLimit: "unlimited", realtimeAlerts: true, copyMode: "auto", executionFeeBps: 50, features: [] }] }
          : url.endsWith("/api/subscriptions/active?userId=tg_1001")
            ? { subscription: { userId: "tg_1001", planId: "elite", status: "active", expiresAt: "2026-06-19T00:00:00.000Z" }, plan: { id: "elite", name: "Elite", starsPerMonth: 2499, walletLimit: 100, dailyAlertLimit: "unlimited", realtimeAlerts: true, copyMode: "auto", executionFeeBps: 50, features: [] } }
            : { wallets: [{ address: "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV", chain: "solana", score: 88, winRate: 0.62, realizedPnl30dUsd: 18420, maxDrawdown30d: 0.18, riskLabel: "high_win_rate_low_frequency" }] }
    })) as unknown as typeof fetch;

    const data = await loadDashboardData({
      apiBaseUrl: "https://api.example",
      userId: "tg_1001",
      fetcher: fetchMock
    });

    expect(fetchMock).toHaveBeenCalledWith("https://api.example/api/subscriptions/active?userId=tg_1001", { cache: "no-store" });
    expect(data.activeSubscription).toMatchObject({ userId: "tg_1001", planId: "elite" });
    expect(data.activePlan.id).toBe("elite");
  });

  it("falls back to local dashboard data when the API is unavailable", async () => {
    const data = await loadDashboardData({
      apiBaseUrl: "https://api.example",
      fetcher: vi.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch
    });

    expect(data.source).toBe("fallback");
    expect(data.plans.length).toBeGreaterThan(1);
    expect(data.activePlan.id).toBe("free");
    expect(data.wallets).toEqual([]);
  });
});
