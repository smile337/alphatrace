import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { verifyTelegramInitData } from "../src/index";

function signedInitData(fields: Record<string, string>, botToken: string): string {
  const dataCheckString = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

describe("telegram initData verification", () => {
  it("accepts signed init data and returns parsed user", () => {
    const botToken = "123456:abc";
    const initData = signedInitData(
      {
        auth_date: Math.floor(Date.now() / 1000).toString(),
        query_id: "q1",
        user: JSON.stringify({ id: 42, username: "alice", first_name: "Alice" }),
        start_param: "ref_abcd"
      },
      botToken
    );

    expect(verifyTelegramInitData(initData, botToken)).toMatchObject({
      ok: true,
      user: { id: 42, username: "alice" },
      startParam: "ref_abcd"
    });
  });

  it("rejects tampered init data", () => {
    const botToken = "123456:abc";
    const initData = signedInitData(
      {
        auth_date: Math.floor(Date.now() / 1000).toString(),
        user: JSON.stringify({ id: 42 })
      },
      botToken
    ).replace("42", "43");

    expect(verifyTelegramInitData(initData, botToken)).toMatchObject({
      ok: false,
      reason: "INVALID_HASH"
    });
  });
});
