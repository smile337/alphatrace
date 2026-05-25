import { NextResponse } from "next/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const apiBaseUrl = (process.env.API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
  const { id } = await context.params;
  const body = await request.text();
  const response = await fetch(`${apiBaseUrl}/api/trade-intents/${encodeURIComponent(id)}/order`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    cache: "no-store"
  });
  const payload = await response.json();

  return NextResponse.json(payload, { status: response.status });
}
