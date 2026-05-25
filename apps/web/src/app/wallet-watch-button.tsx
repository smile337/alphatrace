"use client";

import { useState } from "react";
import { Bell, Check, LoaderCircle } from "lucide-react";
import type { PlanId } from "@alphatrace/shared";
import { authenticateTelegramWebApp, readTelegramInitData } from "../lib/telegram-auth";
import { addWalletWatch } from "../lib/watchlist-actions";

export function WalletWatchButton(props: { walletAddress: string; planId: PlanId }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  async function handleClick() {
    if (state === "saving" || state === "saved") return;
    setState("saving");

    const auth = await authenticateTelegramWebApp({ initData: readTelegramInitData() });
    const userId = auth.status === "authenticated" ? auth.user.id : "demo_web_user";
    const result = await addWalletWatch({
      userId,
      planId: props.planId,
      walletAddress: props.walletAddress
    });

    setState(result.ok ? "saved" : "failed");
  }

  return (
    <button className={`watch-button ${state}`} onClick={handleClick} type="button" disabled={state === "saving" || state === "saved"}>
      {state === "saving" ? <LoaderCircle size={15} /> : state === "saved" ? <Check size={15} /> : <Bell size={15} />}
      <span>{state === "saving" ? "保存中" : state === "saved" ? "已关注" : state === "failed" ? "重试" : "关注"}</span>
    </button>
  );
}
