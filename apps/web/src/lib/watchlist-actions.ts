import type { PlanId } from "@alphatrace/shared";

export interface WalletWatch {
  id: string;
  userId: string;
  walletAddress: string;
  realtime: boolean;
}

export type AddWalletWatchResult =
  | { ok: true; watch: WalletWatch }
  | { ok: false; code: string };

export async function addWalletWatch(input: {
  userId: string;
  planId: PlanId;
  walletAddress: string;
  fetcher?: typeof fetch;
}): Promise<AddWalletWatchResult> {
  const fetcher = input.fetcher ?? fetch;
  const response = await fetcher("/api/watchlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      userId: input.userId,
      planId: input.planId,
      walletAddress: input.walletAddress
    })
  });
  const payload = await response.json();

  if (!response.ok) {
    return { ok: false, code: String(payload.code ?? "WATCHLIST_FAILED") };
  }

  return { ok: true, watch: payload.watch };
}
