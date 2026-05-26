export type TradeIntentPanelStatus = "idle" | "creating" | "ready" | "executing" | "succeeded" | "failed";

export interface TradeIntentExecutionContext {
  requestId: string | null;
  transaction: string | null;
  signature: string | null;
}

export interface TradeIntentBlockerInput {
  permissionAllowed: boolean;
  permissionMessage: string;
  walletPublicKey: string | null;
  walletConnectAvailable: boolean;
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

export function describeTradeIntentBlocker(input: TradeIntentBlockerInput): string | null {
  if (!input.permissionAllowed) return input.permissionMessage;
  if (input.walletPublicKey) return null;
  if (input.walletConnectAvailable) return "请先连接钱包，再生成待签名交易。";
  return "当前环境没有检测到可签名的钱包。请在支持 Solana 钱包的浏览器/移动端打开，或接入 AlphaTrace 钱包桥。";
}
