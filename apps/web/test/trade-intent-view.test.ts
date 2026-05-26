import { describe, expect, it } from "vitest";
import { clearFailedTradeIntentContext, describeTradeIntentBlocker, describeTradeIntentButtonLabel } from "../src/lib/trade-intent-view";

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

  it("explains why a trade action is blocked instead of leaving the button inert", () => {
    expect(
      describeTradeIntentBlocker({
        permissionAllowed: false,
        permissionMessage: "Pro 解锁跟单确认，Elite 解锁自动跟单",
        walletPublicKey: null,
        walletConnectAvailable: false
      })
    ).toBe("Pro 解锁跟单确认，Elite 解锁自动跟单");

    expect(
      describeTradeIntentBlocker({
        permissionAllowed: true,
        permissionMessage: "当前计划支持确认后跟单",
        walletPublicKey: null,
        walletConnectAvailable: false
      })
    ).toBe("当前环境没有检测到可签名的钱包。请在支持 Solana 钱包的浏览器/移动端打开，或接入 AlphaTrace 钱包桥。");

    expect(
      describeTradeIntentBlocker({
        permissionAllowed: true,
        permissionMessage: "当前计划支持确认后跟单",
        walletPublicKey: null,
        walletConnectAvailable: true
      })
    ).toBe("请先连接钱包，再生成待签名交易。");

    expect(
      describeTradeIntentBlocker({
        permissionAllowed: true,
        permissionMessage: "当前计划支持确认后跟单",
        walletPublicKey: "wallet_public_key",
        walletConnectAvailable: false
      })
    ).toBeNull();
  });
});
