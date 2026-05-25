import type { PlanId } from "@alphatrace/shared";

export function buildSubscriptionUpgradeLink(planId: PlanId, botUsername: string): string | null {
  if (planId === "free") return null;

  const url = new URL(`https://t.me/${botUsername}`);
  url.searchParams.set("start", `subscribe_${planId}`);
  return url.toString();
}
