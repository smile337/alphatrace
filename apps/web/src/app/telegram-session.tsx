"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { authenticateTelegramWebApp, readTelegramInitData, type TelegramAuthResult } from "../lib/telegram-auth";
import { getAuthenticatedDashboardUrl } from "../lib/telegram-session-routing";

export function TelegramSession() {
  const [auth, setAuth] = useState<TelegramAuthResult>({ status: "unavailable" });

  useEffect(() => {
    window.Telegram?.WebApp?.ready?.();
    window.Telegram?.WebApp?.expand?.();

    void authenticateTelegramWebApp({ initData: readTelegramInitData() }).then((result) => {
      setAuth(result);
      const nextUrl = getAuthenticatedDashboardUrl({ currentUrl: window.location.href, auth: result });
      if (nextUrl) window.location.replace(nextUrl);
    });
  }, []);

  return (
    <section className="session-strip" aria-live="polite">
      <ShieldCheck size={16} />
      {auth.status === "authenticated" ? (
        <span>
          Telegram 已验证 · {auth.user.firstName ?? auth.user.username ?? `#${auth.user.telegramId}`}
          {auth.referral?.bound ? " · 邀请已绑定" : ""}
        </span>
      ) : auth.status === "rejected" ? (
        <span>Telegram 验证失败 · {auth.code}</span>
      ) : (
        <span>浏览器预览模式 · 打开 Telegram Mini App 后自动验证</span>
      )}
    </section>
  );
}
