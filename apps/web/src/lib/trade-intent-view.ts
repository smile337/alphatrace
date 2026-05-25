export type TradeIntentPanelStatus = "idle" | "creating" | "ready" | "executing" | "succeeded" | "failed";

export interface TradeIntentExecutionContext {
  requestId: string | null;
  transaction: string | null;
  signature: string | null;
}

export function describeTradeIntentButtonLabel(status: TradeIntentPanelStatus): string {
  switch (status) {
    case "creating":
      return "生成中";
    case "ready":
      return "签名确认";
    case "executing":
      return "确认中";
    case "succeeded":
      return "已确认";
    case "failed":
      return "重新生成交易";
    default:
      return "生成交易";
  }
}

export function clearFailedTradeIntentContext(_context: TradeIntentExecutionContext): TradeIntentExecutionContext {
  return {
    requestId: null,
    transaction: null,
    signature: null
  };
}
