import type { VersionedTransaction } from "@solana/web3.js";

const DEMO_SIGNED_TRANSACTION = "signed_demo_transaction";

export interface SolanaWalletProvider {
  connect?: () => Promise<unknown> | unknown;
  isConnected?: boolean;
  publicKey?: { toBase58?: () => string } | string;
  signTransaction?: (transaction: VersionedTransaction) => Promise<VersionedTransaction> | VersionedTransaction;
}

export interface WalletSigningSource {
  AlphaTraceWallet?: {
    publicKey?: string;
    signTransaction?: (transaction: string) => Promise<string> | string;
  };
  phantom?: {
    solana?: SolanaWalletProvider;
  };
  solana?: SolanaWalletProvider;
}

export type SignTradeOrderResult =
  | { ok: true; signedTransaction: string; source: "wallet" | "demo" }
  | { ok: false; code: "SIGNATURE_REJECTED" };

export type WalletSigningDescription =
  | { available: true; label: "AlphaTrace Wallet"; source: "alphatrace" }
  | { available: true; label: "Solana Wallet"; source: "solana" }
  | { available: true; label: "Phantom Wallet"; source: "phantom" }
  | { available: false; label: "Solana Wallet"; source: "solana" }
  | { available: false; label: "Phantom Wallet"; source: "phantom" }
  | { available: false; label: "Demo Mode"; source: "demo" };

export type ConnectWalletSigningSourceResult =
  | { ok: true; wallet: WalletSigningDescription }
  | { ok: false; code: "WALLET_CONNECT_UNAVAILABLE" | "WALLET_CONNECT_REJECTED" };

export function describeWalletSigningSource(source: WalletSigningSource): WalletSigningDescription {
  if (source.AlphaTraceWallet?.signTransaction) {
    return { available: true, label: "AlphaTrace Wallet", source: "alphatrace" };
  }
  if (source.solana?.signTransaction) {
    if (source.solana.connect && source.solana.isConnected !== true) {
      return { available: false, label: "Solana Wallet", source: "solana" };
    }
    return { available: true, label: "Solana Wallet", source: "solana" };
  }
  if (source.phantom?.solana?.signTransaction) {
    if (source.phantom.solana.connect && source.phantom.solana.isConnected !== true) {
      return { available: false, label: "Phantom Wallet", source: "phantom" };
    }
    return { available: true, label: "Phantom Wallet", source: "phantom" };
  }

  return { available: false, label: "Demo Mode", source: "demo" };
}

export function getWalletPublicKey(source: WalletSigningSource): string | null {
  if (source.AlphaTraceWallet?.publicKey) return source.AlphaTraceWallet.publicKey;
  const publicKey = source.solana?.publicKey ?? source.phantom?.solana?.publicKey;
  if (!publicKey) return null;
  if (typeof publicKey === "string") return publicKey;
  return publicKey.toBase58?.() ?? null;
}

export async function connectWalletSigningSource(source: WalletSigningSource): Promise<ConnectWalletSigningSourceResult> {
  if (source.AlphaTraceWallet?.signTransaction) {
    return { ok: true, wallet: { available: true, label: "AlphaTrace Wallet", source: "alphatrace" } };
  }

  const providerEntry = source.solana?.signTransaction
    ? { provider: source.solana, wallet: { available: true, label: "Solana Wallet", source: "solana" } as const }
    : source.phantom?.solana?.signTransaction
      ? { provider: source.phantom.solana, wallet: { available: true, label: "Phantom Wallet", source: "phantom" } as const }
      : null;

  if (!providerEntry?.provider.connect) {
    return { ok: false, code: "WALLET_CONNECT_UNAVAILABLE" };
  }

  try {
    await providerEntry.provider.connect();
    return { ok: true, wallet: providerEntry.wallet };
  } catch {
    return { ok: false, code: "WALLET_CONNECT_REJECTED" };
  }
}

export async function signTradeOrder(input: {
  transaction: string;
  source?: WalletSigningSource;
}): Promise<SignTradeOrderResult> {
  const source = input.source ?? window;
  const bridgeSignTransaction = source.AlphaTraceWallet?.signTransaction;

  if (bridgeSignTransaction) {
    try {
      const signedTransaction = await bridgeSignTransaction(input.transaction);
      return { ok: true, signedTransaction, source: "wallet" };
    } catch {
      return { ok: false, code: "SIGNATURE_REJECTED" };
    }
  }

  const solanaProvider = source.solana ?? source.phantom?.solana;
  if (!solanaProvider?.signTransaction) {
    return { ok: true, signedTransaction: DEMO_SIGNED_TRANSACTION, source: "demo" };
  }

  try {
    const { VersionedTransaction } = await import("@solana/web3.js");
    const transaction = VersionedTransaction.deserialize(decodeBase64(input.transaction));
    const signedTransaction = await solanaProvider.signTransaction(transaction);
    return { ok: true, signedTransaction: encodeBase64(signedTransaction.serialize()), source: "wallet" };
  } catch {
    return { ok: false, code: "SIGNATURE_REJECTED" };
  }
}

function decodeBase64(value: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "base64");
  }

  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function encodeBase64(value: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value).toString("base64");
  }

  return btoa(String.fromCharCode(...value));
}

declare global {
  interface Window extends WalletSigningSource {}
}
