import type { SmartWalletAnalyzer } from "./app";
import {
  analyzeSmartWalletFromTransactions,
  assertSolanaAddress,
  extractCandidateWallets,
  WSOL_MINT,
  type HeliusEnhancedTransaction
} from "./smart-wallet-analysis";
import type { SmartWalletDto } from "./app";

export interface HeliusSmartWalletAnalyzerConfig {
  apiKey?: string;
  baseUrl?: string;
  priceBaseUrl?: string;
  limit?: number;
  discoveryAddresses?: string[];
  discoveryTransactionLimit?: number;
  discoveryCandidateLimit?: number;
}

const DEFAULT_DISCOVERY_ADDRESSES = [
  "So11111111111111111111111111111111111111112",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
];

export function createHeliusSmartWalletAnalyzer(config: HeliusSmartWalletAnalyzerConfig): SmartWalletAnalyzer | undefined {
  if (!config.apiKey) return undefined;
  const baseUrl = (config.baseUrl ?? "https://api-mainnet.helius-rpc.com").replace(/\/$/, "");
  const priceBaseUrl = (config.priceBaseUrl ?? "https://lite-api.jup.ag/price/v3").replace(/\/$/, "");
  const limit = config.limit ?? 100;
  const apiKey = config.apiKey;
  const discoveryAddresses = config.discoveryAddresses ?? DEFAULT_DISCOVERY_ADDRESSES;
  const discoveryTransactionLimit = config.discoveryTransactionLimit ?? 20;
  const discoveryCandidateLimit = config.discoveryCandidateLimit ?? 30;
  const inFlight = new Map<string, Promise<SmartWalletDto>>();

  return {
    async analyzeWallet(address) {
      const walletAddress = assertSolanaAddress(address);
      const existing = inFlight.get(walletAddress);
      if (existing) return existing;

      const analysis = analyzeWalletFromHelius({ baseUrl, priceBaseUrl, apiKey, limit, walletAddress }).finally(() => {
        inFlight.delete(walletAddress);
      });
      inFlight.set(walletAddress, analysis);
      return analysis;
    },

    async discoverCandidateWallets(input = {}) {
      const requestedLimit = Math.max(1, Math.min(input.limit ?? discoveryCandidateLimit, discoveryCandidateLimit));
      const candidates: string[] = [];
      const seen = new Set(input.excludeAddresses ?? []);

      for (const address of discoveryAddresses) {
        const transactions = await fetchHeliusTransactions({
          baseUrl,
          apiKey,
          limit: discoveryTransactionLimit,
          address: assertSolanaAddress(address)
        });
        for (const candidate of extractCandidateWallets(transactions, requestedLimit)) {
          if (seen.has(candidate)) continue;
          seen.add(candidate);
          candidates.push(candidate);
          if (candidates.length >= requestedLimit) return candidates;
        }
      }

      return candidates;
    }
  };
}

async function analyzeWalletFromHelius(input: {
  baseUrl: string;
  priceBaseUrl: string;
  apiKey: string;
  limit: number;
  walletAddress: string;
}) {
  const { baseUrl, priceBaseUrl, apiKey, limit, walletAddress } = input;
  const [transactions, quotePricesUsd] = await Promise.all([
    fetchHeliusTransactions({ baseUrl, apiKey, limit, address: walletAddress }),
    fetchQuotePricesUsd({ priceBaseUrl })
  ]);
  return analyzeSmartWalletFromTransactions({ address: walletAddress, transactions, quotePricesUsd });
}

async function fetchHeliusTransactions(input: {
  baseUrl: string;
  apiKey: string;
  limit: number;
  address: string;
}): Promise<HeliusEnhancedTransaction[]> {
  const { baseUrl, apiKey, limit, address } = input;
  const url = `${baseUrl}/v0/addresses/${address}/transactions?api-key=${encodeURIComponent(apiKey)}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Helius wallet analysis failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as HeliusEnhancedTransaction[];
}

async function fetchQuotePricesUsd(input: { priceBaseUrl: string }): Promise<Record<string, number>> {
  try {
    const response = await fetch(`${input.priceBaseUrl}?ids=${encodeURIComponent(WSOL_MINT)}`);
    if (!response.ok) return {};
    const payload = (await response.json()) as Record<string, { usdPrice?: number }>;
    const solPrice = payload[WSOL_MINT]?.usdPrice;
    return typeof solPrice === "number" && Number.isFinite(solPrice) && solPrice > 0 ? { [WSOL_MINT]: solPrice } : {};
  } catch {
    return {};
  }
}
