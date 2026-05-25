import { describe, expect, it } from "vitest";
import { clearFailedTradeIntentContext, describeTradeIntentButtonLabel } from "../src/lib/trade-intent-view";

describe("Mini App trade intent view state", () => {
  it("uses explicit action labels for each trade intent status", () => {
    expect(describeTradeIntentButtonLabel("idle")).toBe("生成交易");
    expect(describeTradeIntentButtonLabel("creating")).toBe("生成中");
    expect(describeTradeIntentButtonLabel("ready")).toBe("签名确认");
    expect(describeTradeIntentButtonLabel("executing")).toBe("确认中");
    expect(describeTradeIntentButtonLabel("succeeded")).toBe("已确认");
    expect(describeTradeIntentButtonLabel("failed")).toBe("重新生成交易");
  });

  it("clears stale Jupiter context after execution failure", () => {
    expect(
      clearFailedTradeIntentContext({
        requestId: "req_1",
        transaction: "base64tx",
        signature: "sig_1"
      })
    ).toEqual({
      requestId: null,
      transaction: null,
      signature: null
    });
  });
});
