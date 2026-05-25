import type { PlanId } from "@alphatrace/shared";

export interface TradeIntent {
  id: string;
  userId: string;
  tokenMint: string;
  inputMint: string;
  outputMint: string;
  amount: string;
  amountUsd: number;
  status: string;
  riskReasons: string[];
  jupiterRequestId: string | null;
  signature: string | null;
}

export type CreateTradeIntentResult =
  | { ok: true; intent: TradeIntent }
  | { ok: false; code: string };

export type CreateTradeIntentOrderResult =
  | { ok: true; intent: TradeIntent; order: { requestId: string; transaction: string }; executionFeeBps: number }
  | { ok: false; code: string; errorMessage?: string };

export type ExecuteTradeIntentResult =
  | { ok: true; intent: TradeIntent; result: { status: "Success" | "Failed"; signature?: string; code: number; error?: string } }
  | { ok: false; code: string };

export async function createTradeIntent(input: {
  userId: string;
  tokenMint: string;
  inputMint: string;
  outputMint: string;
  amount: string;
  amountUsd: number;
  riskReasons: string[];
  fetcher?: typeof fetch;
}): Promise<CreateTradeIntentResult> {
  const fetcher = input.fetcher ?? fetch;
  const response = await fetcher("/api/trade-intents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userId: input.userId,
      tokenMint: input.tokenMint,
      inputMint: input.inputMint,
      outputMint: input.outputMint,
      amount: input.amount,
      amountUsd: input.amountUsd,
      riskReasons: input.riskReasons
    })
  });
  const payload = await response.json();
  if (!response.ok) return { ok: false, code: String(payload.code ?? "TRADE_INTENT_FAILED") };
  return { ok: true, intent: payload.intent };
}

export async function createTradeIntentOrder(input: {
  intentId: string;
  planId: PlanId;
  taker: string;
  fetcher?: typeof fetch;
}): Promise<CreateTradeIntentOrderResult> {
  const fetcher = input.fetcher ?? fetch;
  const response = await fetcher(`/api/trade-intents/${input.intentId}/order`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      planId: input.planId,
      taker: input.taker
    })
  });
  const payload = await response.json();
  if (!response.ok) {
    return {
      ok: false,
      code: String(payload.code ?? "TRADE_ORDER_FAILED"),
      errorMessage: typeof payload.errorMessage === "string" ? payload.errorMessage : undefined
    };
  }
  return {
    ok: true,
    intent: payload.intent,
    order: payload.order,
    executionFeeBps: payload.executionFeeBps
  };
}

export async function executeTradeIntent(input: {
  intentId: string;
  signedTransaction: string;
  fetcher?: typeof fetch;
}): Promise<ExecuteTradeIntentResult> {
  const fetcher = input.fetcher ?? fetch;
  const response = await fetcher(`/api/trade-intents/${input.intentId}/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ signedTransaction: input.signedTransaction })
  });
  const payload = await response.json();
  if (!response.ok) return { ok: false, code: String(payload.code ?? "TRADE_EXECUTE_FAILED") };
  return {
    ok: true,
    intent: payload.intent,
    result: payload.result
  };
}
