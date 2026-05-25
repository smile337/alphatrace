import { PauseCircle } from "lucide-react";
import { loadDashboardData } from "../lib/dashboard-data";
import { DashboardTabs } from "./dashboard-tabs";
import { TelegramSession } from "./telegram-session";

export const dynamic = "force-dynamic";

export default async function HomePage(props: {
  searchParams?: Promise<{ userId?: string }> | { userId?: string };
}) {
  const searchParams = await props.searchParams;
  const userId = typeof searchParams?.userId === "string" ? searchParams.userId : undefined;
  const { plans, wallets, source, activePlan } = await loadDashboardData({ userId });
  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? "AlphaTraceBot";

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">AlphaTrace · {source === "api" ? "Live API" : "Demo data"}</p>
          <h1>聪明钱包控制台</h1>
        </div>
        <button className="icon-button" aria-label="Emergency pause">
          <PauseCircle size={22} />
        </button>
      </section>

      <TelegramSession />

      <DashboardTabs plans={plans} wallets={wallets} activePlan={activePlan} botUsername={botUsername} />
    </main>
  );
}
