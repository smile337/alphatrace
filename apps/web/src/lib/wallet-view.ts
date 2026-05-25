export interface SmartWalletApiDto {
  address: string;
  chain: string;
  score: number;
  winRate: number;
  realizedPnl30dUsd: number;
  maxDrawdown30d: number;
  riskLabel: string;
  performance?: SmartWalletPerformanceApiDto;
}

export interface SmartWalletPerformanceApiDto {
  tradeCount30d: number;
  winCount30d: number;
  lossCount30d: number;
  estimatedProfit30dUsd: number;
  decisionProfitUsd?: number | null;
  stablecoinNetFlowUsd?: number;
  costCoveragePct?: number;
  openPositionCount?: number;
  profitConfidence?: "high" | "medium" | "low";
  profitSignal?: "realized" | "cash_flow" | "insufficient_data";
  avgTradeSizeUsd: number;
  largestWinUsd: number;
  largestLossUsd: number;
  lastTradeAt: string | null;
  updatedAt: string;
  dataSource: string;
  profitBasis?: string;
}

export interface WalletViewModel extends SmartWalletApiDto {
  name: string;
  shortAddress: string;
  pnl: string;
  pnlLabel: string;
  risk: string;
  color: "green" | "amber" | "red";
  followAdvice: FollowAdvice;
  decisionSignals: DecisionSignal[];
  performanceRows: Array<{ label: string; value: string }>;
  updatedText: string;
}

export type SignalTone = "green" | "amber" | "red";
export type FollowLevel = "follow" | "trial" | "watch" | "avoid";

export interface FollowAdvice {
  level: FollowLevel;
  label: string;
  actionLabel: string;
  tone: SignalTone;
  reason: string;
}

export interface DecisionSignal {
  label: string;
  level: "强" | "中" | "弱" | "高" | "低";
  tone: SignalTone;
  detail: string;
}

export function toWalletViewModel(wallet: SmartWalletApiDto): WalletViewModel {
  const decisionSignals = buildDecisionSignals(wallet);
  return {
    ...wallet,
    name: riskName(wallet.riskLabel),
    shortAddress: shortenAddress(wallet.address),
    pnl: formatDecisionProfit(wallet),
    pnlLabel: decisionProfitLabel(wallet),
    risk: riskText(wallet.riskLabel),
    color: wallet.score >= 80 ? "green" : wallet.score >= 50 ? "amber" : "red",
    followAdvice: buildFollowAdvice(wallet, decisionSignals),
    decisionSignals,
    performanceRows: buildPerformanceRows(wallet),
    updatedText: formatUpdatedText(wallet.performance?.updatedAt)
  };
}

function shortenAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 7)}...${address.slice(-4)}`;
}

function formatUsdCompact(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${sign}${(absolute / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${sign}${(absolute / 1_000).toFixed(1)}K`;
  return `${sign}${absolute.toFixed(0)}`;
}

function riskName(label: string): string {
  if (label.includes("high_win_rate")) return "稳健套利";
  if (label.includes("active_swap")) return "活跃交易";
  if (label.includes("no_recent")) return "待观察";
  if (label.includes("new_token")) return "新币猎手";
  if (label.includes("high_risk")) return "谨慎观察";
  return "链上钱包";
}

function riskText(label: string): string {
  if (label.includes("high_win_rate")) return "低回撤";
  if (label.includes("active_swap")) return "链上活跃";
  if (label.includes("no_recent")) return "交易不足";
  if (label.includes("new_token")) return "高波动";
  if (label.includes("high_risk")) return "不可自动跟";
  return "待验证";
}

function buildPerformanceRows(wallet: SmartWalletApiDto) {
  const performance = wallet.performance;
  if (!performance) {
    return [
      { label: "收益判断", value: formatDecisionProfit(wallet) },
      { label: "已实现收益", value: formatUsdCompact(wallet.realizedPnl30dUsd) },
      { label: "胜率", value: `${Math.round(wallet.winRate * 100)}%` },
      { label: "最大回撤", value: `${Math.round(wallet.maxDrawdown30d * 100)}%` }
    ];
  }

  return [
    { label: "收益判断", value: formatDecisionProfit(wallet) },
    { label: "可信度", value: confidenceText(performance.profitConfidence) },
    { label: "严格已实现", value: formatUsdCompact(wallet.realizedPnl30dUsd) },
    { label: "报价资产净额", value: formatUsdCompact(performance.stablecoinNetFlowUsd ?? 0) },
    { label: "成本覆盖", value: `${performance.costCoveragePct ?? 0}%` },
    { label: "未闭合仓位", value: `${performance.openPositionCount ?? 0}` },
    { label: "近 30 日交易", value: `${performance.tradeCount30d} 笔` },
    { label: "胜 / 负", value: `${performance.winCount30d} / ${performance.lossCount30d}` },
    { label: "均单", value: formatUsdCompact(performance.avgTradeSizeUsd) },
    { label: "最大盈利", value: formatUsdCompact(performance.largestWinUsd) },
    { label: "最大亏损", value: formatUsdCompact(performance.largestLossUsd) },
    { label: "最后交易", value: formatDate(performance.lastTradeAt) },
    { label: "收益口径", value: performance.profitBasis === "quote_asset_fifo_realized" ? "稳定币/SOL FIFO" : "严格已实现" },
    { label: "数据源", value: performance.dataSource === "helius_enhanced_transactions" ? "Helius 链上交易" : performance.dataSource }
  ];
}

function buildDecisionSignals(wallet: SmartWalletApiDto): DecisionSignal[] {
  const performance = wallet.performance;
  const decisionProfit = typeof performance?.decisionProfitUsd === "number" ? performance.decisionProfitUsd : wallet.realizedPnl30dUsd;
  const closedTrades = (performance?.winCount30d ?? 0) + (performance?.lossCount30d ?? 0);
  const costCoverage = performance?.costCoveragePct ?? 0;
  const openPositions = performance?.openPositionCount ?? 0;
  const quoteNetFlow = performance?.stablecoinNetFlowUsd ?? 0;

  const profitLevel = profitSignalLevel(decisionProfit, closedTrades);
  const credibilityLevel = credibilitySignalLevel(performance?.profitConfidence, costCoverage);
  const riskLevel = riskSignalLevel({ costCoverage, openPositions, quoteNetFlow });

  return [
    {
      label: "盈利能力",
      level: profitLevel.label,
      tone: profitLevel.tone,
      detail: `近 30 日已实现 ${formatUsdCompact(decisionProfit)}，闭合盈利样本 ${closedTrades} 笔。`
    },
    {
      label: "数据可信",
      level: credibilityLevel.label,
      tone: credibilityLevel.tone,
      detail: `链上闭环收益可信，但成本覆盖只有 ${costCoverage}%。`
    },
    {
      label: "仓位风险",
      level: riskLevel.label,
      tone: riskLevel.tone,
      detail: `仍有 ${openPositions} 个未闭合仓位，报价资产净额 ${formatUsdCompact(quoteNetFlow)}。`
    }
  ];
}

function buildFollowAdvice(wallet: SmartWalletApiDto, signals: DecisionSignal[]): FollowAdvice {
  const performance = wallet.performance;
  const decisionProfit = typeof performance?.decisionProfitUsd === "number" ? performance.decisionProfitUsd : wallet.realizedPnl30dUsd;
  const profit = signals[0];
  const credibility = signals[1];
  const risk = signals[2];

  if (decisionProfit <= 0) {
    return {
      level: "avoid",
      label: "不建议跟",
      actionLabel: "继续观察",
      tone: "red",
      reason: "当前没有正向已实现收益，先不要跟单。"
    };
  }

  if (profit.level === "强" && credibility.level === "高" && risk.level === "低") {
    return {
      level: "follow",
      label: "可跟单",
      actionLabel: "跟单此钱包",
      tone: "green",
      reason: "收益、可信度和仓位风险同时达标，可以按限额跟单。"
    };
  }

  if ((profit.level === "强" || profit.level === "中") && credibility.level !== "低" && risk.level !== "高") {
    return {
      level: "trial",
      label: "小额试跟",
      actionLabel: "小额试跟",
      tone: "amber",
      reason: "收益表现可用，但仍需要用小额限额验证。"
    };
  }

  return {
    level: "watch",
    label: "观察",
    actionLabel: "加入观察",
    tone: "amber",
    reason: "收益为正，但闭合样本少、未闭合仓位多，不适合直接重仓跟。"
  };
}

function profitSignalLevel(decisionProfit: number, closedTrades: number): { label: "强" | "中" | "弱"; tone: SignalTone } {
  if (decisionProfit >= 1_000 && closedTrades >= 10) return { label: "强", tone: "green" };
  if (decisionProfit > 0 && closedTrades >= 5) return { label: "中", tone: "amber" };
  return { label: "弱", tone: decisionProfit > 0 ? "amber" : "red" };
}

function credibilitySignalLevel(
  confidence: SmartWalletPerformanceApiDto["profitConfidence"],
  costCoverage: number
): { label: "高" | "中" | "低"; tone: SignalTone } {
  if (confidence === "high" && costCoverage >= 60) return { label: "高", tone: "green" };
  if ((confidence === "high" || confidence === "medium") && costCoverage >= 10) return { label: "中", tone: "amber" };
  return { label: "低", tone: "red" };
}

function riskSignalLevel(input: {
  costCoverage: number;
  openPositions: number;
  quoteNetFlow: number;
}): { label: "高" | "中" | "低"; tone: SignalTone } {
  if (input.openPositions >= 10 || input.quoteNetFlow <= -500 || input.costCoverage < 20) return { label: "高", tone: "red" };
  if (input.openPositions <= 3 && input.quoteNetFlow >= 0 && input.costCoverage >= 60) return { label: "低", tone: "green" };
  return { label: "中", tone: "amber" };
}

function formatDecisionProfit(wallet: SmartWalletApiDto): string {
  const performance = wallet.performance;
  if (!performance) return formatUsdCompact(wallet.realizedPnl30dUsd);
  if (typeof performance.decisionProfitUsd === "number") return formatUsdCompact(performance.decisionProfitUsd);
  return "待判断";
}

function decisionProfitLabel(wallet: SmartWalletApiDto): string {
  const signal = wallet.performance?.profitSignal;
  if (signal === "realized") return "已实现";
  if (signal === "cash_flow") return "资金流";
  return "收益判断";
}

function confidenceText(confidence: SmartWalletPerformanceApiDto["profitConfidence"]): string {
  if (confidence === "high") return "高";
  if (confidence === "medium") return "中";
  return "低";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "暂无";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatUpdatedText(value: string | undefined): string {
  return value ? `更新 ${formatDate(value)}` : "等待更新";
}
