import type { ExecuteTradeIntentResult } from "./trade-intent-actions";
import type { SignTradeOrderResult } from "./wallet-signing";

export type TradeOrderSigner = (input: { transaction: string }) => Promise<SignTradeOrderResult>;
export type TradeIntentExecutor = (input: { intentId: string; signedTransaction: string }) => Promise<ExecuteTradeIntentResult>;

export type RunTradeIntentExecutionResult =
  | { ok: true; executeResult: ExecuteTradeIntentResult }
  | { ok: false; stage: "signing"; code: "SIGNATURE_REJECTED" };

export async function runTradeIntentExecution(input: {
  intentId: string;
  transaction: string;
  sign: TradeOrderSigner;
  execute: TradeIntentExecutor;
}): Promise<RunTradeIntentExecutionResult> {
  const signatureResult = await input.sign({ transaction: input.transaction });
  if (signatureResult.ok === false) {
    return { ok: false, stage: "signing", code: signatureResult.code };
  }

  const executeResult = await input.execute({
    intentId: input.intentId,
    signedTransaction: signatureResult.signedTransaction
  });
  return { ok: true, executeResult };
}
