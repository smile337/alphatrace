import type { JupiterClient } from "./app";
import { createDemoJupiterOrder } from "./demo-jupiter";

export interface JupiterHttpClientConfig {
  baseUrl?: string;
  apiKey?: string;
  referralAccount?: string;
}

export type JupiterOrderHttpInput = Parameters<JupiterClient["order"]>[0] & {
  referralAccount?: string;
};

export function buildJupiterOrderSearchParams(input: JupiterOrderHttpInput): URLSearchParams {
  const params = new URLSearchParams({
    inputMint: input.inputMint,
    outputMint: input.outputMint,
    amount: input.amount,
    taker: input.taker
  });

  if (input.referralAccount) {
    params.set("referralAccount", input.referralAccount);
    params.set("referralFee", String(input.referralFeeBps));
  }

  return params;
}

export function createJupiterHttpClient(config: JupiterHttpClientConfig = {}): JupiterClient {
  return {
    async order(input) {
      const baseUrl = config.baseUrl ?? "https://api.jup.ag/swap/v2";
      if (!config.apiKey) {
        return createDemoJupiterOrder(input);
      }

      const params = buildJupiterOrderSearchParams({
        ...input,
        referralAccount: config.referralAccount
      });
      const response = await fetch(`${baseUrl}/order?${params}`, {
        headers: { "x-api-key": config.apiKey }
      });
      if (!response.ok) {
        throw new Error(`Jupiter order failed: ${response.status} ${await response.text()}`);
      }
      return (await response.json()) as Awaited<ReturnType<JupiterClient["order"]>>;
    },

    async execute(input) {
      const baseUrl = config.baseUrl ?? "https://api.jup.ag/swap/v2";
      if (!config.apiKey) {
        return { status: "Success", signature: "demo_signature", code: 0 };
      }

      const response = await fetch(`${baseUrl}/execute`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": config.apiKey
        },
        body: JSON.stringify(input)
      });
      if (!response.ok) {
        throw new Error(`Jupiter execute failed: ${response.status} ${await response.text()}`);
      }
      return (await response.json()) as Awaited<ReturnType<JupiterClient["execute"]>>;
    }
  };
}
