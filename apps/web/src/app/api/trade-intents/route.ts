import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const apiBaseUrl = (process.env.API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
  const body = await request.text();
  const response = await fetch(`${apiBaseUrl}/api/trade-intents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    cache: "no-store"
  });
  const payload = await response.json();

  return NextResponse.json(payload, { status: response.status });
}

export async function GET(request: Request) {
  const apiBaseUrl = (process.env.API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
  const url = new URL(request.url);
  const response = await fetch(`${apiBaseUrl}/api/trade-intents?${url.searchParams.toString()}`, {
    cache: "no-store"
  });
  const payload = await response.json();

  return NextResponse.json(payload, { status: response.status });
}
