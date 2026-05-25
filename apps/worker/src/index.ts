import { processWalletTradeEvent } from "./processor";

const demo = processWalletTradeEvent({
  event: {
    walletAddress: "SmartWallet111111111111111111111111111111111",
    tokenMint: "Token111111111111111111111111111111111111111",
    side: "buy",
    amountUsd: 50,
    liquidityUsd: 100_000,
    expectedSlippageBps: 120,
    walletScore: 84
  },
  rules: []
});

console.log("AlphaTrace worker ready", demo);
