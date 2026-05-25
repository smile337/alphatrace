import { NextResponse } from "next/server";

export async function POST(_request: Request, context: { params: Promise<{ address: string }> }) {
  const apiBaseUrl = (process.env.API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
  const { address } = await context.params;
  const response = await fetch(`${apiBaseUrl}/api/smart-wallets/${encodeURIComponent(address)}/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
    cache: "no-store"
  });
  const payload = await response.json();

  return NextResponse.json(payload, { status: response.status });
}
