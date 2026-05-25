import type { CopyMode, PlanId } from "@alphatrace/shared";

export interface CopyRule {
  id: string;
  userId: string;
  walletAddress: string;
  maxSingleTradeUsd: number;
  maxDailyLossUsd: number;
  maxSlippageBps: number;
  blacklist: string[];
  mode: CopyMode;
  emergencyPaused: boolean;
}

export type SaveCopyRuleResult =
  | { ok: true; rule: CopyRule }
  | { ok: false; code: string };

export async function saveCopyRule(input: {
  userId: string;
  planId: PlanId;
  walletAddress: string;
  maxSingleTradeUsd: number;
  maxDailyLossUsd: number;
  maxSlippageBps: number;
  blacklist: string[];
  fetcher?: typeof fetch;
}): Promise<SaveCopyRuleResult> {
  const fetcher = input.fetcher ?? fetch;
  const response = await fetcher("/api/copy-rules", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userId: input.userId,
      planId: input.planId,
      walletAddress: input.walletAddress,
      maxSingleTradeUsd: input.maxSingleTradeUsd,
      maxDailyLossUsd: input.maxDailyLossUsd,
      maxSlippageBps: input.maxSlippageBps,
      blacklist: input.blacklist
    })
  });
  const payload = await response.json();

  if (!response.ok) {
    return { ok: false, code: String(payload.code ?? "COPY_RULE_FAILED") };
  }

  return { ok: true, rule: payload.rule };
}
