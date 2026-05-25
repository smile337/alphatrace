import type { TelegramAuthResult } from "./telegram-auth";

export function getAuthenticatedDashboardUrl(input: {
  currentUrl: string;
  auth: TelegramAuthResult;
}): string | null {
  if (input.auth.status !== "authenticated") return null;

  const url = new URL(input.currentUrl);
  if (url.searchParams.get("userId") === input.auth.user.id) return null;

  url.searchParams.set("userId", input.auth.user.id);
  return url.toString();
}
