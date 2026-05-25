import { describe, expect, it } from "vitest";
import { getPlanById, getPlanLimits, PLANS } from "../src/index";

describe("subscription plans", () => {
  it("sets Pro as the main paid plan at 999 Stars", () => {
    expect(getPlanById("pro")).toMatchObject({
      id: "pro",
      starsPerMonth: 999,
      walletLimit: 20,
      realtimeAlerts: true,
      copyMode: "confirm"
    });
  });

  it("keeps automatic copy trading behind Elite or KOL Room", () => {
    expect(getPlanLimits("free").copyMode).toBe("alerts");
    expect(getPlanLimits("pro").copyMode).toBe("confirm");
    expect(getPlanLimits("elite").copyMode).toBe("auto");
    expect(getPlanLimits("kol_room").copyMode).toBe("auto");
  });

  it("uses the approved Stars ladder", () => {
    expect(PLANS.map((plan) => [plan.id, plan.starsPerMonth])).toEqual([
      ["free", 0],
      ["pro", 999],
      ["elite", 2499],
      ["kol_room", 9999]
    ]);
  });
});
