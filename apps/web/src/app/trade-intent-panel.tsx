"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, Send } from "lucide-react";
import type { SubscriptionPlan } from "@alphatrace/shared";
import type { WalletViewModel } from "../lib/wallet-view";
import { authenticateTelegramWebApp, readTelegramInitData } from "../lib/telegram-auth";
import { describeTradeIntentExecuteFailure } from "../lib/trade-intent-errors";
import { createTradeIntent, createTradeIntentOrder, executeTradeIntent } from "../lib/trade-intent-actions";
import { runTradeIntentExecution } from "../lib/trade-intent-execution";
import { clearFailedTradeIntentContext, describeTradeIntentButtonLabel, type TradeIntentPanelStatus } from "../lib/trade-intent-view";
import { describeTradePermission } from "../lib/plan-permissions";
import {
  connectWalletSigningSource,
  describeWalletSigningSource,
  getWalletPublicKey,
  signTradeOrder,
  type WalletSigningDescription
} from "../lib/wallet-signing";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export function TradeIntentPanel(props: { smartWallet: WalletViewModel; plan: SubscriptionPlan }) {
  const [status, setStatus] = useState<TradeIntentPanelStatus>("idle");
  const [intentId, setIntentId] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [connectingWallet, setConnectingWallet] = useState(false);
  const [walletConnectAvailable, setWalletConnectAvailable] = useState(false);
  const [walletSource, setWalletSource] = useState<WalletSigningDescription>({
    available: false,
    label: "Demo Mode",
    source: "demo"
  });
  const [walletPublicKey, setWalletPublicKey] = useState<string | null>(null);
  const permission = describeTradePermission(props.plan);

  useEffect(() => {
    function refreshWalletSource() {
      setWalletSource(describeWalletSigningSource(window));
      setWalletPublicKey(getWalletPublicKey(window));
      setWalletConnectAvailable(Boolean(window.solana?.connect || window.phantom?.solana?.connect || window.AlphaTraceWallet?.signTransaction));
    }

    refreshWalletSource();
    window.addEventListener("alphatrace:wallet-ready", refreshWalletSource);
    return () => window.removeEventListener("alphatrace:wallet-ready", refreshWalletSource);
  }, []);

  async function handleConnectWallet() {
    if (connectingWallet) return;
    setConnectingWallet(true);
    setFailureReason(null);

    const result = await connectWalletSigningSource(window);
    if ("code" in result) {
      setFailureReason(result.code === "WALLET_CONNECT_REJECTED" ? "钱包连接被取消" : "未检测到可连接钱包");
      setConnectingWallet(false);
      return;
    }

    setWalletSource(result.wallet);
    setWalletPublicKey(getWalletPublicKey(window));
    setWalletConnectAvailable(false);
    setConnectingWallet(false);
  }

  async function handleCreateOrder() {
    if (status === "creating" || status === "executing") return;
    if (!permission.allowed || !walletPublicKey) return;
    setStatus("creating");
    setIntentId(null);
    setRequestId(null);
    setTransaction(null);
    setSignature(null);
    setFailureReason(null);

    const auth = await authenticateTelegramWebApp({ initData: readTelegramInitData() });
    const userId = auth.status === "authenticated" ? auth.user.id : "demo_web_user";
    const intentResult = await createTradeIntent({
      userId,
      tokenMint: props.smartWallet.address,
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      amount: "1000000",
      amountUsd: 50,
      riskReasons: []
    });

    if (!intentResult.ok) {
      setFailureReason("交易意图创建失败");
      setStatus("failed");
      return;
    }

    const orderResult = await createTradeIntentOrder({
      intentId: intentResult.intent.id,
      planId: props.plan.id,
      taker: walletPublicKey
    });

    if (!orderResult.ok) {
      const errorMessage = "errorMessage" in orderResult ? orderResult.errorMessage : undefined;
      setFailureReason(
        errorMessage?.toLowerCase().includes("insufficient funds")
          ? "余额不足，请连接有 SOL 的钱包后重试"
          : errorMessage
            ? `待签名交易生成失败：${errorMessage}`
            : "待签名交易生成失败"
      );
      setStatus("failed");
      return;
    }

    setIntentId(intentResult.intent.id);
    setRequestId(orderResult.order.requestId);
    setTransaction(orderResult.order.transaction);
    setStatus("ready");
  }

  async function handleExecute() {
    if (!intentId || !transaction || status !== "ready") return;
    setStatus("executing");
    setSignature(null);

    function clearFailedContext() {
      const cleared = clearFailedTradeIntentContext({ requestId, transaction, signature });
      setRequestId(cleared.requestId);
      setTransaction(cleared.transaction);
      setSignature(cleared.signature);
    }

    const execution = await runTradeIntentExecution({
      intentId,
      transaction,
      sign: signTradeOrder,
      execute: executeTradeIntent
    });
    if (!execution.ok) {
      setFailureReason("用户取消签名");
      clearFailedContext();
      setStatus("failed");
      return;
    }

    const executeResult = execution.executeResult;

    if (!executeResult.ok || executeResult.result.status !== "Success") {
      setFailureReason(describeTradeIntentExecuteFailure(executeResult));
      clearFailedContext();
      setStatus("failed");
      return;
    }

    setSignature(executeResult.result.signature ?? executeResult.intent.signature);
    setStatus("succeeded");
  }

  const detailText = signature
    ? `Signature: ${signature}`
    : failureReason
      ? failureReason
      : requestId
        ? `Jupiter request: ${requestId}`
      : !permission.allowed
        ? permission.message
      : !walletPublicKey
        ? "先连接你的 Solana 钱包，系统会用该钱包作为 Jupiter taker。"
        : "先生成待签名交易，再由用户钱包确认。";
  const walletText = walletSource.available
    ? `${walletSource.label} 已就绪${walletPublicKey ? ` · ${walletPublicKey.slice(0, 4)}...${walletPublicKey.slice(-4)}` : ""}`
    : walletSource.source === "demo"
      ? "未连接执行钱包"
      : `${walletSource.label} 可连接`;
  const canConnectWallet = !walletSource.available && walletConnectAvailable;
  const buttonIcon =
    status === "creating" || status === "executing" ? (
      <LoaderCircle size={16} />
    ) : status === "ready" || status === "succeeded" ? (
      <Check size={16} />
    ) : (
      <Send size={16} />
    );
  const buttonLabel = describeTradeIntentButtonLabel(status);

  return (
    <section className="panel">
      <div className="section-title">
        <h2>交易确认</h2>
        <Send size={18} />
      </div>
      <div className="trade-intent-box">
        <div>
          <strong>跟随 {props.smartWallet.name} · 50 USD</strong>
          <span className={walletSource.available ? "wallet-source ready" : "wallet-source demo"}>{walletText}</span>
          <span>{detailText}</span>
        </div>
        <div className="trade-actions">
          {canConnectWallet ? (
            <button
              className={`wallet-connect-button ${connectingWallet ? "connecting" : ""}`}
              disabled={connectingWallet}
              onClick={handleConnectWallet}
              type="button"
            >
              {connectingWallet ? <LoaderCircle size={16} /> : <Check size={16} />}
              <span>{connectingWallet ? "连接中" : "连接钱包"}</span>
            </button>
          ) : null}
          <button
            className={`trade-button ${status}`}
            disabled={status === "creating" || status === "executing" || status === "succeeded" || !permission.allowed || !walletPublicKey}
            onClick={status === "ready" ? handleExecute : handleCreateOrder}
            type="button"
          >
            {buttonIcon}
            <span>{buttonLabel}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
