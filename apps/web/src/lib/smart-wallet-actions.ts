import type { SmartWalletApiDto } from "./wallet-view";

export type ImportSmartWalletResult =
  | { ok: true; wallet: SmartWalletApiDto; eligible: boolean }
  | { ok: false; code: string };

export type DiscoverSmartWalletsResult =
  | { ok: true; wallets: SmartWalletApiDto[]; rejectedCount: number }
  | { ok: false; code: string };

export type RefreshSmartWalletResult =
  | { ok: true; wallet: SmartWalletApiDto; eligible: boolean }
  | { ok: false; code: string };

export async function importSmartWallet(input: {
  address: string;
  fetcher?: typeof fetch;
}): Promise<ImportSmartWalletResult> {
  const fetcher = input.fetcher ?? fetch;
  const response = await fetcher("/api/smart-wallets/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: input.address })
  });
  const payload = await response.json();

  if (!response.ok) {
    return { ok: false, code: String(payload.code ?? "SMART_WALLET_IMPORT_FAILED") };
  }

  return { ok: true, wallet: payload.wallet, eligible: Boolean(payload.eligible) };
}

export async function discoverSmartWallets(input: {
  fetcher?: typeof fetch;
  limit?: number;
  excludeAddresses?: string[];
} = {}): Promise<DiscoverSmartWalletsResult> {
  const fetcher = input.fetcher ?? fetch;
  const response = await fetcher("/api/smart-wallets/discover", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ limit: input.limit ?? 5, excludeAddresses: input.excludeAddresses ?? [] })
  });
  const payload = await response.json();

  if (!response.ok) {
    return { ok: false, code: String(payload.code ?? "SMART_WALLET_DISCOVERY_FAILED") };
  }

  return {
    ok: true,
    wallets: Array.isArray(payload.imported) ? payload.imported : [],
    rejectedCount: Array.isArray(payload.rejected) ? payload.rejected.length : 0
  };
}

export async function refreshSmartWallet(input: {
  address: string;
  fetcher?: typeof fetch;
}): Promise<RefreshSmartWalletResult> {
  const fetcher = input.fetcher ?? fetch;
  const response = await fetcher(`/api/smart-wallets/${encodeURIComponent(input.address)}/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });
  const payload = await response.json();

  if (!response.ok) {
    return { ok: false, code: String(payload.code ?? "SMART_WALLET_REFRESH_FAILED") };
  }

  return { ok: true, wallet: payload.wallet, eligible: Boolean(payload.eligible) };
}
