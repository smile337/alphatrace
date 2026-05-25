import { describe, expect, it, vi } from "vitest";
import { authenticateTelegramWebApp } from "../src/lib/telegram-auth";

describe("Mini App Telegram auth client", () => {
  it("skips auth when Telegram initData is unavailable", async () => {
    const fetcher = vi.fn();

    const result = await authenticateTelegramWebApp({ initData: "", fetcher: fetcher as unknown as typeof fetch });

    expect(result).toEqual({ status: "unavailable" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("posts initData to the same-origin auth proxy", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        user: { id: "tg_1001", telegramId: 1001, username: "alice", firstName: "Alice" },
        referral: { startParam: "ref_demo", bound: true }
      })
    })) as unknown as typeof fetch;

    const result = await authenticateTelegramWebApp({ initData: "query=1", fetcher });

    expect(fetcher).toHaveBeenCalledWith("/api/auth/telegram", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData: "query=1" })
    });
    expect(result).toMatchObject({
      status: "authenticated",
      user: { username: "alice" },
      referral: { startParam: "ref_demo" }
    });
  });

  it("returns rejected when the auth proxy rejects initData", async () => {
    const result = await authenticateTelegramWebApp({
      initData: "bad=1",
      fetcher: vi.fn(async () => ({
        ok: false,
        json: async () => ({ code: "INVALID_HASH" })
      })) as unknown as typeof fetch
    });

    expect(result).toEqual({ status: "rejected", code: "INVALID_HASH" });
  });
});
