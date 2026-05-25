import type { ExecuteTradeIntentResult } from "./trade-intent-actions";

const EXECUTE_ERROR_MESSAGES: Record<string, string> = {
  JUPITER_EXECUTE_FAILED: "Jupiter 执行失败，请稍后重试",
  TRADE_INTENT_ALREADY_SUBMITTED: "交易已提交，请等待确认",
  INVALID_SIGNED_TRANSACTION: "钱包签名无效，请重新生成交易",
  TRADE_INTENT_NOT_READY: "交易状态已变化，请重新生成交易"
};

export function describeTradeIntentExecuteFailure(result: ExecuteTradeIntentResult): string {
  if (result.ok === false) {
    return EXECUTE_ERROR_MESSAGES[result.code] ?? "交易执行失败，请稍后重试";
  }

  if (result.result.status === "Failed" && result.result.error) {
    const commonMessage = describeCommonJupiterError(result.result.error);
    if (commonMessage) return commonMessage;
    return `Jupiter 执行失败：${result.result.error}`;
  }

  return "交易执行失败，请稍后重试";
}

function describeCommonJupiterError(error: string): string | null {
  const normalized = error.toLowerCase();
  if (normalized.includes("slippage")) {
    return "滑点超出设置，请提高滑点或重新生成报价";
  }
  if (normalized.includes("blockhash") || normalized.includes("expired") || normalized.includes("transaction too old")) {
    return "交易已过期，请重新生成交易";
  }
  if (normalized.includes("insufficient funds") || normalized.includes("insufficient lamports")) {
    return "余额不足，请检查钱包 SOL 和代币余额";
  }
  if (normalized.includes("simulation") || normalized.includes("simulate")) {
    return "交易模拟失败，请调整参数后重试";
  }
  return null;
}
