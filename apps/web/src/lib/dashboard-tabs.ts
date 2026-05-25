export type DashboardTabId = "overview" | "wallets" | "copy" | "subscription";

export interface DashboardTab {
  id: DashboardTabId;
  label: string;
}

export const defaultDashboardTabId: DashboardTabId = "overview";

export const dashboardTabs: DashboardTab[] = [
  { id: "overview", label: "看板" },
  { id: "wallets", label: "钱包" },
  { id: "copy", label: "跟单" },
  { id: "subscription", label: "订阅" }
];
