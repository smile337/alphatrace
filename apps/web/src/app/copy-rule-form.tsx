"use client";

import { useState } from "react";
import { Check, LoaderCircle, ShieldCheck } from "lucide-react";
import type { SubscriptionPlan } from "@alphatrace/shared";
import { authenticateTelegramWebApp, readTelegramInitData } from "../lib/telegram-auth";
import { saveCopyRule } from "../lib/copy-rule-actions";
import { describeCopyRulePermission } from "../lib/plan-permissions";

export function CopyRuleForm(props: { walletAddress: string; plan: SubscriptionPlan }) {
  const [maxSingleTradeUsd, setMaxSingleTradeUsd] = useState("50");
  const [maxDailyLossUsd, setMaxDailyLossUsd] = useState("100");
  const [maxSlippagePct, setMaxSlippagePct] = useState("3");
  const [status, setStatus] = useState<"idle" | "locked" | "saving" | "saved" | "failed">("idle");
  const permission = describeCopyRulePermission(props.plan);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!permission.allowed) {
      setStatus("locked");
      return;
    }
    setStatus("saving");

    const auth = await authenticateTelegramWebApp({ initData: readTelegramInitData() });
    const userId = auth.status === "authenticated" ? auth.user.id : "demo_web_user";
    const result = await saveCopyRule({
      userId,
      planId: props.plan.id,
      walletAddress: props.walletAddress,
      maxSingleTradeUsd: Number(maxSingleTradeUsd),
      maxDailyLossUsd: Number(maxDailyLossUsd),
      maxSlippageBps: Math.round(Number(maxSlippagePct) * 100),
      blacklist: []
    });

    setStatus(result.ok ? "saved" : "failed");
  }

  return (
    <form className="rule-grid" onSubmit={handleSubmit}>
      <p className={permission.allowed ? "permission-note" : "permission-note locked"} aria-live="polite">
        {status === "locked" ? "当前账号仍是 Free，无法保存跟单规则。请先在订阅页升级到 Pro 或 Elite。" : permission.message}
      </p>
      <label>
        <span>单笔上限</span>
        <input inputMode="decimal" min="1" name="maxSingleTradeUsd" onChange={(event) => setMaxSingleTradeUsd(event.target.value)} type="number" value={maxSingleTradeUsd} />
      </label>
      <label>
        <span>日亏损上限</span>
        <input inputMode="decimal" min="1" name="maxDailyLossUsd" onChange={(event) => setMaxDailyLossUsd(event.target.value)} type="number" value={maxDailyLossUsd} />
      </label>
      <label>
        <span>最大滑点 %</span>
        <input inputMode="decimal" max="50" min="0.1" name="maxSlippagePct" onChange={(event) => setMaxSlippagePct(event.target.value)} step="0.1" type="number" value={maxSlippagePct} />
      </label>
      <button className={`rule-save-button ${status}`} disabled={status === "saving"} type="submit">
        {status === "saving" ? <LoaderCircle size={16} /> : status === "saved" ? <Check size={16} /> : <ShieldCheck size={16} />}
        <span>
          {status === "saving"
            ? "保存中"
            : status === "saved"
              ? "已保存"
              : status === "failed"
                ? "重试保存"
                : permission.allowed
                  ? "保存规则"
                  : "升级后保存"}
        </span>
      </button>
    </form>
  );
}
