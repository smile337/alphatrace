"use client";

import { Activity, Bot, Check, Crown, LoaderCircle, RefreshCw, Repeat2, Search, ShieldCheck, Shuffle, Wallet } from "lucide-react";
import type { SubscriptionPlan } from "@alphatrace/shared";
import { useMemo, useState } from "react";
import { toWalletViewModel, type WalletViewModel } from "../lib/wallet-view";
import { dashboardTabs, defaultDashboardTabId, type DashboardTabId } from "../lib/dashboard-tabs";
import { discoverSmartWallets, importSmartWallet, refreshSmartWallet } from "../lib/smart-wallet-actions";
import { buildSubscriptionUpgradeLink } from "../lib/subscription-links";
import { CopyRuleForm } from "./copy-rule-form";
import { TradeIntentPanel } from "./trade-intent-panel";
import { WalletWatchButton } from "./wallet-watch-button";

const tasks = ["关注 1 个钱包", "邀请 1 人注册", "拉 Bot 进群", "首次完成订阅"];

export function DashboardTabs(props: {
  plans: SubscriptionPlan[];
  wallets: WalletViewModel[];
  activePlan: SubscriptionPlan;
  botUsername: string;
}) {
  const [wallets, setWallets] = useState(props.wallets);
  const [selectedWalletAddress, setSelectedWalletAddress] = useState(props.wallets[0]?.address ?? "");
  const [walletInput, setWalletInput] = useState("");
  const [importState, setImportState] = useState<"idle" | "importing" | "failed">("idle");
  const [importError, setImportError] = useState<string | null>(null);
  const [discoverState, setDiscoverState] = useState<"idle" | "discovering" | "failed">("idle");
  const [refreshingWallet, setRefreshingWallet] = useState<string | null>(null);
  const [bulkRefreshState, setBulkRefreshState] = useState<"idle" | "refreshing">("idle");
  const [expandedWallets, setExpandedWallets] = useState<Set<string>>(() => new Set());
  const selectedWallet = useMemo(
    () => wallets.find((wallet) => wallet.address === selectedWalletAddress) ?? wallets[0] ?? null,
    [selectedWalletAddress, wallets]
  );
  const watchLimit = props.activePlan.walletLimit;
  const todayAlerts = wallets.length * 9;
  const blockedRules = wallets.filter((wallet) => wallet.score < 50).length + 5;

  async function handleImportWallet(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!walletInput.trim() || importState === "importing") return;
    setImportState("importing");
    setImportError(null);

    const result = await importSmartWallet({ address: walletInput.trim() });
    if (!result.ok) {
      setImportState("failed");
      setImportError(describeImportError("code" in result ? result.code : "SMART_WALLET_IMPORT_FAILED"));
      return;
    }
    if (!result.eligible) {
      setImportState("failed");
      setImportError("这是链上真实地址，但近期交易质量未达到聪明钱包阈值，暂不展示或跟单。");
      return;
    }

    const wallet = toWalletViewModel(result.wallet);
    setWallets((current) => [wallet, ...current.filter((candidate) => candidate.address !== wallet.address)]);
    setSelectedWalletAddress(wallet.address);
    setWalletInput("");
    setImportState("idle");
    document.getElementById("tab-copy")?.click();
  }

  async function handleDiscoverWallets() {
    if (discoverState === "discovering") return;
    setDiscoverState("discovering");
    setImportError(null);

    const result = await discoverSmartWallets({ excludeAddresses: wallets.map((wallet) => wallet.address) });
    if (!result.ok) {
      setDiscoverState("failed");
      setImportError(describeDiscoverError("code" in result ? result.code : "SMART_WALLET_DISCOVERY_FAILED"));
      return;
    }
    if (result.wallets.length === 0) {
      setDiscoverState("idle");
      setImportError(result.rejectedCount > 0 ? "发现了真实地址，但本轮没有钱包达到聪明钱包阈值。" : "本轮未发现可展示的真实聪明钱包。");
      return;
    }

    const discoveredWallets = result.wallets.map(toWalletViewModel);
    setWallets((current) => [
      ...discoveredWallets,
      ...current.filter((candidate) => !discoveredWallets.some((wallet) => wallet.address === candidate.address))
    ]);
    setSelectedWalletAddress(discoveredWallets[0].address);
    setDiscoverState("idle");
  }

  function selectWallet(wallet: WalletViewModel) {
    setSelectedWalletAddress(wallet.address);
    document.getElementById("tab-copy")?.click();
  }

  async function refreshWallet(wallet: WalletViewModel) {
    if (refreshingWallet) return;
    setRefreshingWallet(wallet.address);
    setImportError(null);

    const result = await refreshSmartWallet({ address: wallet.address });
    if (!result.ok) {
      setImportError(describeRefreshError("code" in result ? result.code : "SMART_WALLET_REFRESH_FAILED"));
      setRefreshingWallet(null);
      return;
    }
    if (!result.eligible) {
      setWallets((current) => current.filter((candidate) => candidate.address !== wallet.address));
      setSelectedWalletAddress("");
      setImportError("该钱包更新后不再达到聪明钱包阈值，已从榜单移除。");
      setRefreshingWallet(null);
      return;
    }

    const updatedWallet = toWalletViewModel(result.wallet);
    setWallets((current) => current.map((candidate) => (candidate.address === updatedWallet.address ? updatedWallet : candidate)));
    setSelectedWalletAddress(updatedWallet.address);
    setRefreshingWallet(null);
  }

  async function refreshTopWallets() {
    if (bulkRefreshState === "refreshing" || refreshingWallet) return;
    setBulkRefreshState("refreshing");
    setImportError(null);

    const targets = wallets.slice(0, 3);
    const refreshedWallets: WalletViewModel[] = [];
    const removedAddresses = new Set<string>();
    for (const wallet of targets) {
      const result = await refreshSmartWallet({ address: wallet.address });
      if (result.ok && result.eligible) {
        refreshedWallets.push(toWalletViewModel(result.wallet));
      } else {
        removedAddresses.add(wallet.address);
      }
    }

    setWallets((current) =>
      current
        .filter((wallet) => !removedAddresses.has(wallet.address))
        .map((wallet) => refreshedWallets.find((updated) => updated.address === wallet.address) ?? wallet)
    );
    setBulkRefreshState("idle");
  }

  function toggleWalletDetails(address: string) {
    setExpandedWallets((current) => {
      const next = new Set(current);
      if (next.has(address)) next.delete(address);
      else next.add(address);
      return next;
    });
  }

  return (
    <div className="mini-tabs">
      {dashboardTabs.map((tab) => (
        <input
          className="tab-radio"
          defaultChecked={tab.id === defaultDashboardTabId}
          id={`tab-${tab.id}`}
          key={tab.id}
          name="dashboard-tab"
          type="radio"
        />
      ))}

      <div className="tab-pages">
        <section className="tab-page tab-page-overview" aria-labelledby="tab-label-overview">
          <section className="status-grid">
            <div className="metric">
              <Activity size={18} />
              <span>今日异动</span>
              <strong>{todayAlerts}</strong>
            </div>
            <div className="metric">
              <Wallet size={18} />
              <span>关注钱包</span>
              <strong>{wallets.length} / {watchLimit}</strong>
            </div>
            <div className="metric">
              <ShieldCheck size={18} />
              <span>风控拒单</span>
              <strong>{blockedRules}</strong>
            </div>
          </section>

          <section className="panel compact-panel">
            <div className="section-title">
              <h2>当前策略</h2>
              <Crown size={18} />
            </div>
            <div className="overview-summary">
              <div>
                <span>当前计划</span>
                <strong>{props.activePlan.name}</strong>
              </div>
              <div>
                <span>跟单模式</span>
                <strong>{copyModeText(props.activePlan.copyMode)}</strong>
              </div>
              <div>
                <span>执行费率</span>
                <strong>{props.activePlan.executionFeeBps} bps</strong>
              </div>
            </div>
          </section>

          <section className="panel compact-panel">
            <div className="section-title">
              <h2>正在跟随</h2>
              <Repeat2 size={18} />
            </div>
            {selectedWallet ? <WalletSummary wallet={selectedWallet} /> : <EmptyWalletState />}
          </section>
        </section>

        <section className="tab-page tab-page-wallets" aria-labelledby="tab-label-wallets">
          <div className="section-title page-section-title">
            <h2>聪明钱包榜单</h2>
            <div className="wallet-toolbar">
              <button
                className={`text-button discover-button ${discoverState}`}
                disabled={discoverState === "discovering"}
                onClick={handleDiscoverWallets}
                type="button"
              >
                {discoverState === "discovering" ? <LoaderCircle size={16} /> : wallets.length > 0 ? <Shuffle size={16} /> : <Search size={16} />}
                {discoverState === "discovering" ? "发现中" : wallets.length > 0 ? "换一批钱包" : "发现真实钱包"}
              </button>
              {wallets.length > 0 ? (
                <button
                  className={`text-button discover-button ${bulkRefreshState === "refreshing" ? "discovering" : ""}`}
                  disabled={bulkRefreshState === "refreshing"}
                  onClick={refreshTopWallets}
                  type="button"
                >
                  {bulkRefreshState === "refreshing" ? <LoaderCircle size={16} /> : <RefreshCw size={16} />}
                  批量刷新
                </button>
              ) : null}
            </div>
          </div>
          <form className="wallet-import" onSubmit={handleImportWallet}>
            <input
              aria-label="输入 Solana 钱包地址"
              onChange={(event) => setWalletInput(event.target.value)}
              placeholder="粘贴 Solana 聪明钱包地址"
              value={walletInput}
            />
            <button className={`wallet-import-button ${importState}`} disabled={importState === "importing"} type="submit">
              {importState === "importing" ? <LoaderCircle size={15} /> : <Check size={15} />}
              <span>{importState === "importing" ? "分析中" : "导入"}</span>
            </button>
            {importError ? <p className="import-error">{importError}</p> : null}
          </form>
          <div className="wallet-list">
            {wallets.length === 0 ? (
              <EmptyWalletState />
            ) : (
              wallets.map((wallet) => (
                <article className={wallet.address === selectedWallet?.address ? "wallet-row selected" : "wallet-row"} key={wallet.address}>
                  <div className={`score-dot ${wallet.color}`} />
                  <div className="wallet-main">
                    <strong>{wallet.name}</strong>
                    <span>{wallet.shortAddress}</span>
                    <small>{wallet.updatedText}</small>
                  </div>
                  <div className="wallet-stat">
                    <strong>{wallet.score}</strong>
                    <span>{wallet.risk}</span>
                  </div>
                  <div className="wallet-stat">
                    <strong>{wallet.pnl}</strong>
                    <span>{wallet.pnlLabel}</span>
                  </div>
                  <div className="wallet-actions">
                    <button
                      className={`wallet-refresh-button ${refreshingWallet === wallet.address ? "refreshing" : ""}`}
                      disabled={refreshingWallet !== null}
                      onClick={() => refreshWallet(wallet)}
                      type="button"
                    >
                      {refreshingWallet === wallet.address ? <LoaderCircle size={15} /> : <RefreshCw size={15} />}
                      刷新
                    </button>
                    <button className="wallet-refresh-button" onClick={() => toggleWalletDetails(wallet.address)} type="button">
                      详情
                    </button>
                    <WalletWatchButton walletAddress={wallet.address} planId={props.activePlan.id} />
                    {wallet.followAdvice.level !== "avoid" ? (
                      <button className={`copy-wallet-button ${wallet.followAdvice.tone}`} onClick={() => selectWallet(wallet)} type="button">
                        {wallet.followAdvice.actionLabel}
                      </button>
                    ) : null}
                  </div>
                  {expandedWallets.has(wallet.address) ? <WalletPerformance wallet={wallet} /> : null}
                </article>
              ))
            )}
          </div>
        </section>

        <section className="tab-page tab-page-copy" aria-labelledby="tab-label-copy">
          <section className="panel">
            <div className="section-title">
              <h2>跟随的钱包</h2>
              <Wallet size={18} />
            </div>
            {selectedWallet ? <WalletSummary wallet={selectedWallet} /> : <EmptyWalletState />}
          </section>

          {selectedWallet ? (
            <>
              <section className="panel">
                <div className="section-title">
                  <h2>跟单规则</h2>
                  <ShieldCheck size={18} />
                </div>
                <CopyRuleForm walletAddress={selectedWallet.address} plan={props.activePlan} />
              </section>
              <TradeIntentPanel smartWallet={selectedWallet} plan={props.activePlan} />
            </>
          ) : null}
        </section>

        <section className="tab-page tab-page-subscription" aria-labelledby="tab-label-subscription">
          <section className="panel">
            <div className="section-title">
              <h2>订阅</h2>
              <Crown size={18} />
            </div>
            <div className="plan-strip">
              {props.plans.map((plan) => (
                <article className={plan.id === props.activePlan.id ? "plan active" : "plan"} key={plan.id}>
                  <span>{plan.name}</span>
                  <strong>{plan.starsPerMonth === 0 ? "Free" : `${plan.starsPerMonth} Stars`}</strong>
                  <small>{plan.walletLimit} 钱包 · {copyModeText(plan.copyMode)}</small>
                  {plan.id !== "free" ? (
                    <a className="plan-upgrade-link" href={buildSubscriptionUpgradeLink(plan.id, props.botUsername) ?? undefined}>
                      {plan.id === props.activePlan.id ? "续费" : "升级"}
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-title">
              <h2>裂变增长</h2>
              <Bot size={18} />
            </div>
            <div className="growth-grid">
              <div className="kol-box">
                <Bot size={22} />
                <strong>KOL Room</strong>
                <span>新用户 128 · 付费 24 · MRR 23976 Stars</span>
              </div>
              <div className="task-list">
                {tasks.map((task) => (
                  <label key={task}>
                    <input type="checkbox" />
                    <span>{task}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>
        </section>
      </div>

      <nav className="bottom-tabs" aria-label="AlphaTrace sections">
        {dashboardTabs.map((tab) => (
          <label className={`bottom-tab bottom-tab-${tab.id}`} htmlFor={`tab-${tab.id}`} id={`tab-label-${tab.id}`} key={tab.id}>
            {tabIcon(tab.id)}
            <span>{tab.label}</span>
          </label>
        ))}
      </nav>
    </div>
  );
}

function WalletSummary(props: { wallet: WalletViewModel }) {
  return (
    <div className="wallet-summary">
      <div className={`score-dot ${props.wallet.color}`} />
      <div>
        <strong>{props.wallet.name}</strong>
        <span>{props.wallet.shortAddress}</span>
      </div>
      <div>
        <strong>{props.wallet.score}</strong>
        <span>{props.wallet.risk}</span>
      </div>
      <div>
        <strong>{props.wallet.pnl}</strong>
        <span>{props.wallet.pnlLabel}</span>
      </div>
    </div>
  );
}

function WalletPerformance(props: { wallet: WalletViewModel }) {
  return (
    <div className="wallet-performance">
      <section className={`follow-advice ${props.wallet.followAdvice.tone}`}>
        <div>
          <span>跟单建议</span>
          <strong>{props.wallet.followAdvice.label}</strong>
        </div>
        <p>{props.wallet.followAdvice.reason}</p>
      </section>
      <section className="decision-signals" aria-label="钱包判断信号">
        {props.wallet.decisionSignals.map((signal) => (
          <div className={`decision-signal ${signal.tone}`} key={signal.label}>
            <span>{signal.label}</span>
            <strong>{signal.level}</strong>
            <small>{signal.detail}</small>
          </div>
        ))}
      </section>
      <details className="raw-performance">
        <summary>原始明细</summary>
        <div className="raw-performance-grid">
          {props.wallet.performanceRows.map((row) => (
            <div key={row.label}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function EmptyWalletState() {
  return (
    <div className="empty-wallet-state">
      <strong>暂无真实聪明钱包</strong>
      <span>粘贴 Solana 钱包地址后，后端会用 Helius 拉取交易历史并实时评分。</span>
    </div>
  );
}

function describeImportError(code: string): string {
  if (code === "SMART_WALLET_DATA_SOURCE_UNCONFIGURED") return "未配置 HELIUS_API_KEY，无法分析真实链上交易。";
  if (code === "INVALID_SOLANA_WALLET_ADDRESS") return "请输入有效的 Solana 钱包地址。";
  return "导入失败，请稍后重试。";
}

function describeDiscoverError(code: string): string {
  if (code === "SMART_WALLET_DISCOVERY_UNCONFIGURED") return "未配置 Helius 发现源，无法从真实市场交易发现钱包。";
  return "发现失败，请稍后重试。";
}

function describeRefreshError(code: string): string {
  if (code === "SMART_WALLET_DATA_SOURCE_UNCONFIGURED") return "未配置 HELIUS_API_KEY，无法更新钱包。";
  if (code === "INVALID_SOLANA_WALLET_ADDRESS") return "钱包地址无效，无法更新。";
  return "更新失败，请稍后重试。";
}

function copyModeText(mode: SubscriptionPlan["copyMode"]) {
  return mode === "auto" ? "自动" : mode === "confirm" ? "确认" : "提醒";
}

function tabIcon(id: DashboardTabId) {
  if (id === "overview") return <Activity size={18} />;
  if (id === "wallets") return <Wallet size={18} />;
  if (id === "copy") return <Repeat2 size={18} />;
  return <Crown size={18} />;
}
