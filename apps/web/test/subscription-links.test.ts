import { describe, expect, it } from "vitest";
import { buildSubscriptionUpgradeLink } from "../src/lib/subscription-links";

describe("Mini App subscription links", () => {
  it("builds Telegram bot deep links for paid plan upgrades", () => {
    expect(buildSubscriptionUpgradeLink("pro", "AlphaTraceBot")).toBe("https://t.me/AlphaTraceBot?start=subscribe_pro");
    expect(buildSubscriptionUpgradeLink("elite", "AlphaTraceBot")).toBe("https://t.me/AlphaTraceBot?start=subscribe_elite");
    expect(buildSubscriptionUpgradeLink("kol_room", "AlphaTraceBot")).toBe("https://t.me/AlphaTraceBot?start=subscribe_kol_room");
  });

  it("does not build an upgrade link for the free plan", () => {
    expect(buildSubscriptionUpgradeLink("free", "AlphaTraceBot")).toBeNull();
  });
});
