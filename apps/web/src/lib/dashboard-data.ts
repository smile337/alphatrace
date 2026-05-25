import { PLANS, getPlanById, type PlanId, type SubscriptionPlan } from "@alphatrace/shared";
import { toWalletViewModel, type SmartWalletApiDto, type WalletViewModel } from "./wallet-view";
export type { SmartWalletApiDto, WalletViewModel };

export interface DashboardData {
  source: "api" | "fallback";
  plans: SubscriptionPlan[];
  activePlan: SubscriptionPlan;
  activeSubscription: {
    userId: string;
    planId: PlanId;
    status: "active" | "free";
    expiresAt: string | null;
  };
  wallets: WalletViewModel[];
}

export async function loadDashboardData(options: {
  apiBaseUrl?: string;
  fetcher?: typeof fetch;
  userId?: string;
} = {}): Promise<DashboardData> {
  const apiBaseUrl = (options.apiBaseUrl ?? process.env.API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
  const fetcher = options.fetcher ?? fetch;
  const userId = options.userId ?? "demo_web_user";

  try {
    const [plansResponse, walletsResponse, subscriptionResponse] = await Promise.all([
      fetcher(`${apiBaseUrl}/api/plans`, { cache: "no-store" }),
      fetcher(`${apiBaseUrl}/api/smart-wallets`, { cache: "no-store" }),
      fetcher(`${apiBaseUrl}/api/subscriptions/active?userId=${encodeURIComponent(userId)}`, { cache: "no-store" })
    ]);

    if (!plansResponse.ok || !walletsResponse.ok || !subscriptionResponse.ok) {
      return fallbackDashboardData();
    }

    const plansPayload = (await plansResponse.json()) as { plans?: SubscriptionPlan[] };
    const walletsPayload = (await walletsResponse.json()) as { wallets?: SmartWalletApiDto[] };
    const subscriptionPayload = (await subscriptionResponse.json()) as {
      subscription?: DashboardData["activeSubscription"];
      plan?: SubscriptionPlan;
    };
    if (!plansPayload.plans?.length || !walletsPayload.wallets || !subscriptionPayload.subscription) {
      return fallbackDashboardData();
    }
    const activePlan =
      plansPayload.plans.find((plan) => plan.id === subscriptionPayload.subscription?.planId) ??
      subscriptionPayload.plan ??
      getPlanById(subscriptionPayload.subscription.planId);

    return {
      source: "api",
      plans: plansPayload.plans,
      activePlan,
      activeSubscription: subscriptionPayload.subscription,
      wallets: walletsPayload.wallets.map(toWalletViewModel)
    };
  } catch {
    return fallbackDashboardData();
  }
}

function fallbackDashboardData(): DashboardData {
  return {
    source: "fallback",
    plans: PLANS,
    activePlan: getPlanById("free"),
    activeSubscription: {
      userId: "demo_web_user",
      planId: "free",
      status: "free",
      expiresAt: null
    },
    wallets: []
  };
}
