import { describe, expect, it, vi } from "vitest";
import { discoverSmartWallets, importSmartWallet, refreshSmartWallet } from "../src/lib/smart-wallet-actions";

describe("Mini App smart wallet actions", () => {
  it("imports a user supplied smart wallet through the same-origin proxy", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        wallet: {
          address: "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV",
          chain: "solana",
          score: 76,
          winRate: 0.67,
          realizedPnl30dUsd: 3780,
          maxDrawdown30d: 0.22,
          riskLabel: "active_swap_wallet"
        },
        eligible: true
      })
    })) as unknown as typeof fetch;

    const result = await importSmartWallet({
      address: "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV",
      fetcher
    });

    expect(fetcher).toHaveBeenCalledWith("/api/smart-wallets/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV" })
    });
    expect(result).toMatchObject({ ok: true, wallet: { score: 76 }, eligible: true });
  });

  it("returns a stable error code when the data source is missing", async () => {
    const result = await importSmartWallet({
      address: "HhNPPxwsX8mEq8QTexKSG7ChfG3L59QaFjJC6oFqL1uV",
      fetcher: vi.fn(async () => ({
        ok: false,
        json: async () => ({ code: "SMART_WALLET_DATA_SOURCE_UNCONFIGURED" })
      })) as unknown as typeof fetch
    });

    expect(result).toEqual({ ok: false, code: "SMART_WALLET_DATA_SOURCE_UNCONFIGURED" });
  });

  it("requests real market discovery through the same-origin proxy", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        imported: [
          {
            address: "5hNQovY7mscduGNGVYBchecUPzNdnNHTTeFt85t58sq1",
            chain: "solana",
            score: 73,
            winRate: 0.58,
            realizedPnl30dUsd: 4200,
            maxDrawdown30d: 0.22,
            riskLabel: "active_swap_wallet"
          }
        ],
        rejected: [],
        source: "helius"
      })
    })) as unknown as typeof fetch;

    const result = await discoverSmartWallets({
      fetcher,
      excludeAddresses: ["CurrentWallet111111111111111111111111111111"]
    });

    expect(fetcher).toHaveBeenCalledWith("/api/smart-wallets/discover", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ limit: 5, excludeAddresses: ["CurrentWallet111111111111111111111111111111"] })
    });
    expect(result).toMatchObject({ ok: true, wallets: [{ score: 73 }], rejectedCount: 0 });
  });

  it("refreshes a selected smart wallet through the same-origin proxy", async () => {
    const address = "5hNQovY7mscduGNGVYBchecUPzNdnNHTTeFt85t58sq1";
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        wallet: {
          address,
          chain: "solana",
          score: 82,
          winRate: 0.69,
          realizedPnl30dUsd: 9300,
          maxDrawdown30d: 0.16,
          riskLabel: "high_win_rate_low_frequency",
          performance: {
            tradeCount30d: 12,
            winCount30d: 8,
            lossCount30d: 4,
            estimatedProfit30dUsd: 9300,
            avgTradeSizeUsd: 775,
            largestWinUsd: 2604,
            largestLossUsd: -1488,
            lastTradeAt: "2026-05-20T00:00:00.000Z",
            updatedAt: "2026-05-20T00:00:00.000Z",
            dataSource: "helius_enhanced_transactions"
          }
        },
        eligible: true
      })
    })) as unknown as typeof fetch;

    const result = await refreshSmartWallet({ address, fetcher });

    expect(fetcher).toHaveBeenCalledWith(`/api/smart-wallets/${encodeURIComponent(address)}/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    expect(result).toMatchObject({ ok: true, wallet: { score: 82, performance: { tradeCount30d: 12 } }, eligible: true });
  });
});
