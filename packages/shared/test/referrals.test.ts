import { describe, expect, it } from "vitest";
import {
  bindReferral,
  calculateKolCommission,
  createReferralCode,
  grantFirstPaymentRewards
} from "../src/index";

describe("referral growth rules", () => {
  it("creates stable personal and KOL referral links", () => {
    expect(createReferralCode("user_123", "personal", "AlphaTraceBot")).toMatchObject({
      ownerUserId: "user_123",
      kind: "personal",
      startParam: expect.stringMatching(/^ref_/),
      link: expect.stringContaining("https://t.me/AlphaTraceBot?startapp=ref_")
    });

    expect(createReferralCode("kol_123", "kol", "AlphaTraceBot").startParam).toMatch(/^kol_/);
  });

  it("rejects self-invites and duplicate attribution", () => {
    const first = bindReferral({
      invitedUserId: "b",
      inviterUserId: "a",
      existingAttribution: null
    });
    expect(first.status).toBe("bound");

    expect(
      bindReferral({
        invitedUserId: "a",
        inviterUserId: "a",
        existingAttribution: null
      }).status
    ).toBe("rejected_self_invite");

    expect(
      bindReferral({
        invitedUserId: "b",
        inviterUserId: "c",
        existingAttribution: first.attribution
      }).status
    ).toBe("already_bound");
  });

  it("grants first-payment rewards without multi-level payouts", () => {
    const result = grantFirstPaymentRewards({
      invitedUserId: "b",
      inviterUserId: "a",
      paidPlanId: "pro",
      invitedPaidCountAfterPayment: 3,
      alreadyRewarded: false
    });

    expect(result.rewards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: "a", type: "pro_days", amount: 7 }),
        expect.objectContaining({ userId: "b", type: "pro_trial_days", amount: 3 }),
        expect.objectContaining({ userId: "a", type: "pro_days", amount: 14 })
      ])
    );
    expect(result.multiLevelRewards).toEqual([]);
  });

  it("calculates one-level KOL commission", () => {
    expect(calculateKolCommission({ source: "subscription", amountStars: 999 })).toMatchObject({
      amountStars: 200,
      rateBps: 2000
    });
    expect(calculateKolCommission({ source: "trade_fee", amountStars: 1000, rateBps: 1500 })).toMatchObject({
      amountStars: 150,
      rateBps: 1500
    });
  });
});
