export interface TelegramAuthUser {
  id: string;
  telegramId: number;
  username?: string;
  firstName?: string;
}

export type TelegramAuthResult =
  | { status: "unavailable" }
  | { status: "authenticated"; user: TelegramAuthUser; referral: { startParam: string; bound: boolean } | null }
  | { status: "rejected"; code: string };

export async function authenticateTelegramWebApp(options: {
  initData: string;
  fetcher?: typeof fetch;
}): Promise<TelegramAuthResult> {
  if (!options.initData) return { status: "unavailable" };

  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher("/api/auth/telegram", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initData: options.initData })
  });
  const payload = await response.json();

  if (!response.ok) {
    return { status: "rejected", code: String(payload.code ?? "AUTH_FAILED") };
  }

  return {
    status: "authenticated",
    user: payload.user,
    referral: payload.referral
  };
}

export function readTelegramInitData(source: Window & typeof globalThis = window): string {
  return source.Telegram?.WebApp?.initData ?? "";
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}
