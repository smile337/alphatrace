import { describe, expect, it, vi } from "vitest";
import { Keypair, SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { connectWalletSigningSource, describeWalletSigningSource, signTradeOrder } from "../src/lib/wallet-signing";

describe("Mini App wallet signing", () => {
  it("describes the preferred wallet signing source", () => {
    const signTransaction = async () => "signed_tx";

    expect(describeWalletSigningSource({ AlphaTraceWallet: { signTransaction } })).toEqual({
      available: true,
      label: "AlphaTrace Wallet",
      source: "alphatrace"
    });
    expect(describeWalletSigningSource({ solana: { signTransaction: async (transaction) => transaction } })).toEqual({
      available: true,
      label: "Solana Wallet",
      source: "solana"
    });
    expect(describeWalletSigningSource({ phantom: { solana: { signTransaction: async (transaction) => transaction } } })).toEqual({
      available: true,
      label: "Phantom Wallet",
      source: "phantom"
    });
    expect(describeWalletSigningSource({})).toEqual({
      available: false,
      label: "Demo Mode",
      source: "demo"
    });
  });

  it("describes connectable injected wallets as unavailable until connected", () => {
    expect(
      describeWalletSigningSource({
        solana: {
          connect: async () => ({ publicKey: "wallet_public_key" }),
          signTransaction: async (transaction) => transaction
        }
      })
    ).toEqual({
      available: false,
      label: "Solana Wallet",
      source: "solana"
    });
  });

  it("connects injected Solana wallets before signing", async () => {
    const connect = vi.fn(async () => ({ publicKey: "wallet_public_key" }));
    const signTransaction = async (transaction: VersionedTransaction) => transaction;

    const result = await connectWalletSigningSource({
      solana: { connect, signTransaction }
    });

    expect(connect).toHaveBeenCalledOnce();
    expect(result).toEqual({
      ok: true,
      wallet: { available: true, label: "Solana Wallet", source: "solana" }
    });
  });

  it("connects Phantom when it is the available injected wallet", async () => {
    const connect = vi.fn(async () => ({ publicKey: "wallet_public_key" }));
    const signTransaction = async (transaction: VersionedTransaction) => transaction;

    const result = await connectWalletSigningSource({
      phantom: { solana: { connect, signTransaction } }
    });

    expect(connect).toHaveBeenCalledOnce();
    expect(result).toEqual({
      ok: true,
      wallet: { available: true, label: "Phantom Wallet", source: "phantom" }
    });
  });

  it("reports wallet connection rejection", async () => {
    const result = await connectWalletSigningSource({
      solana: {
        connect: async () => {
          throw new Error("rejected");
        },
        signTransaction: async (transaction) => transaction
      }
    });

    expect(result).toEqual({ ok: false, code: "WALLET_CONNECT_REJECTED" });
  });

  it("signs order transactions through an injected wallet bridge", async () => {
    const signTransaction = vi.fn(async (transaction: string) => `signed_${transaction}`);

    const result = await signTradeOrder({
      transaction: "unsigned_tx",
      source: { AlphaTraceWallet: { signTransaction } }
    });

    expect(signTransaction).toHaveBeenCalledWith("unsigned_tx");
    expect(result).toEqual({ ok: true, signedTransaction: "signed_unsigned_tx", source: "wallet" });
  });

  it("uses a demo signature when no wallet bridge is available", async () => {
    const result = await signTradeOrder({
      transaction: "unsigned_tx",
      source: {}
    });

    expect(result).toEqual({ ok: true, signedTransaction: "signed_demo_transaction", source: "demo" });
  });

  it("signs base64 Jupiter transactions through an injected Solana provider", async () => {
    const signer = Keypair.generate();
    const transaction = createUnsignedTransfer(signer);
    const serializedTransaction = Buffer.from(transaction.serialize()).toString("base64");
    const signTransaction = vi.fn(async (walletTransaction: VersionedTransaction) => {
      walletTransaction.sign([signer]);
      return walletTransaction;
    });

    const result = await signTradeOrder({
      transaction: serializedTransaction,
      source: { solana: { signTransaction } }
    });

    expect(signTransaction).toHaveBeenCalledOnce();
    expect(result.ok).toBe(true);
    if (result.ok) {
      const signedTransaction = VersionedTransaction.deserialize(Buffer.from(result.signedTransaction, "base64"));
      expect(Buffer.from(signedTransaction.signatures[0]).equals(Buffer.alloc(64))).toBe(false);
      expect(result.source).toBe("wallet");
    }
  });

  it("reports rejected wallet signatures without falling back to demo execution", async () => {
    const result = await signTradeOrder({
      transaction: "unsigned_tx",
      source: {
        AlphaTraceWallet: {
          signTransaction: async () => {
            throw new Error("rejected");
          }
        }
      }
    });

    expect(result).toEqual({ ok: false, code: "SIGNATURE_REJECTED" });
  });
});

function createUnsignedTransfer(signer: Keypair) {
  const message = new TransactionMessage({
    payerKey: signer.publicKey,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
    instructions: [
      SystemProgram.transfer({
        fromPubkey: signer.publicKey,
        toPubkey: Keypair.generate().publicKey,
        lamports: 1
      })
    ]
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
