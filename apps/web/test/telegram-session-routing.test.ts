import { describe, expect, it } from "vitest";
import { getAuthenticatedDashboardUrl } from "../src/lib/telegram-session-routing";

describe("Mini App Telegram session routing", () => {
  it("adds the authenticated user id to the dashboard URL", () => {
    expect(
      getAuthenticatedDashboardUrl({
        currentUrl: "https://alpha.example/app",
        auth: {
          status: "authenticated",
          user: { id: "tg_1001", telegramId: 1001, firstName: "Alice" },
          referral: null
        }
      })
    ).toBe("https://alpha.example/app?userId=tg_1001");
  });

  it("does not redirect when the URL already matches the authenticated user", () => {
    expect(
      getAuthenticatedDashboardUrl({
        currentUrl: "https://alpha.example/app?userId=tg_1001",
        auth: {
          status: "authenticated",
          user: { id: "tg_1001", telegramId: 1001 },
          referral: null
        }
      })
    ).toBeNull();
  });

  it("does not redirect when Telegram auth is unavailable", () => {
    expect(
      getAuthenticatedDashboardUrl({
        currentUrl: "https://alpha.example/app",
        auth: { status: "unavailable" }
      })
    ).toBeNull();
  });
});
