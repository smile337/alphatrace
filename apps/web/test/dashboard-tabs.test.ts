import { describe, expect, it } from "vitest";
import { dashboardTabs, defaultDashboardTabId } from "../src/lib/dashboard-tabs";

describe("dashboard tabs", () => {
  it("defines the Mini App as four bottom navigation pages", () => {
    expect(defaultDashboardTabId).toBe("overview");
    expect(dashboardTabs.map((tab) => tab.id)).toEqual(["overview", "wallets", "copy", "subscription"]);
    expect(dashboardTabs.map((tab) => tab.label)).toEqual(["看板", "钱包", "跟单", "订阅"]);
    expect(new Set(dashboardTabs.map((tab) => tab.id)).size).toBe(dashboardTabs.length);
  });
});
