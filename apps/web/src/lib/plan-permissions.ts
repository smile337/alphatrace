import type { SubscriptionPlan } from "@alphatrace/shared";

export interface PlanPermissionDescription {
  allowed: boolean;
  message: string;
}

export function describeCopyRulePermission(plan: SubscriptionPlan): PlanPermissionDescription {
  if (plan.copyMode === "alerts") {
    return {
      allowed: false,
      message: "Pro 解锁跟单确认，Elite 解锁自动跟单"
    };
  }
  if (plan.copyMode === "confirm") {
    return {
      allowed: true,
      message: "当前计划支持确认后跟单"
    };
  }
  return {
    allowed: true,
    message: "当前计划支持自动跟单"
  };
}

export function describeTradePermission(plan: SubscriptionPlan): PlanPermissionDescription {
  if (plan.copyMode === "alerts") {
    return {
      allowed: false,
      message: "Pro 解锁跟单确认，Elite 解锁自动跟单"
    };
  }
  if (plan.copyMode === "confirm") {
    return {
      allowed: true,
      message: "当前计划支持确认后跟单"
    };
  }
  return {
    allowed: true,
    message: "当前计划支持自动跟单，仍可手动确认本次交易"
  };
}
