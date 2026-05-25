import { describe, expect, it, vi } from "vitest";
import { addWalletWatch } from "../src/lib/watchlist-actions";

describe("Mini App watchlist actions", () => {
  it("posts wallet watches through the same-origin proxy", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        watch: {
          id: "watch_1",
          userId: "tg_1001",
          walletAddress: "SmartWallet111111111111111111111111111111111",
          realtime: true
        }
      })
    })) as unknown as typeof fetch;

    const result = await addWalletWatch({
      userId: "tg_1001",
      planId: "pro",
      walletAddress: "SmartWallet111111111111111111111111111111111",
      fetcher
    });

    expect(fetcher).toHaveBeenCalledWith("/api/watchlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "tg_1001",
        planId: "pro",
        walletAddress: "SmartWallet111111111111111111111111111111111"
      })
    });
    expect(result).toEqual({
      ok: true,
      watch: {
        id: "watch_1",
        userId: "tg_1001",
        walletAddress: "SmartWallet111111111111111111111111111111111",
        realtime: true
      }
    });
  });

  it("returns API errors without throwing", async () => {
    const result = await addWalletWatch({
      userId: "tg_1001",
      planId: "free",
      walletAddress: "SmartWallet111111111111111111111111111111111",
      fetcher: vi.fn(async () => ({
        ok: false,
        json: async () => ({ code: "WALLET_LIMIT_EXCEEDED" })
      })) as unknown as typeof fetch
    });

    expect(result).toEqual({ ok: false, code: "WALLET_LIMIT_EXCEEDED" });
  });
});
