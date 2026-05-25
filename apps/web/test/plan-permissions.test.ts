import { describe, expect, it } from "vitest";
import { getPlanById } from "@alphatrace/shared";
import { describeCopyRulePermission, describeTradePermission } from "../src/lib/plan-permissions";

describe("Mini App plan permission copy", () => {
  it("prompts free users to upgrade before configuring copy rules", () => {
    expect(describeCopyRulePermission(getPlanById("free"))).toEqual({
      allowed: false,
      message: "Pro 解锁跟单确认，Elite 解锁自动跟单"
    });
  });

  it("describes Pro and Elite copy-trading modes", () => {
    expect(describeCopyRulePermission(getPlanById("pro"))).toEqual({
      allowed: true,
      message: "当前计划支持确认后跟单"
    });
    expect(describeTradePermission(getPlanById("elite"))).toEqual({
      allowed: true,
      message: "当前计划支持自动跟单，仍可手动确认本次交易"
    });
  });
});
