import { Keypair, SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import type { JupiterOrderResponse } from "./app";

export function createDemoJupiterOrder(input: {
  amount: string;
  inputMint: string;
  referralFeeBps: number;
}): JupiterOrderResponse {
  const payer = Keypair.generate();
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
    instructions: [
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: Keypair.generate().publicKey,
        lamports: 1
      })
    ]
  }).compileToV0Message();
  const transaction = new VersionedTransaction(message);

  return {
    requestId: "demo_request",
    transaction: Buffer.from(transaction.serialize()).toString("base64"),
    outAmount: input.amount,
    feeBps: input.referralFeeBps,
    feeMint: input.inputMint
  };
}
