import { describe, expect, it } from "vitest";
import { isApprovedPartner } from "@/lib/auth/partner-access";
import type { User } from "@/lib/types/domain";

const baseUser: User = {
  id: "user_1",
  name: "Test Partner",
  role: "customer",
  city: "bengaluru",
  kyc_status: "not_started"
};

describe("isApprovedPartner", () => {
  it("returns false for pending customer applications", () => {
    expect(
      isApprovedPartner({
        ...baseUser,
        partner_application_status: "pending"
      })
    ).toBe(false);
  });

  it("returns true for approved partner_investor", () => {
    expect(
      isApprovedPartner({
        ...baseUser,
        role: "partner_investor",
        partner_application_status: "approved"
      })
    ).toBe(true);
  });

  it("treats legacy partners with null status as approved", () => {
    expect(
      isApprovedPartner({
        ...baseUser,
        role: "partner_investor",
        partner_application_status: null
      })
    ).toBe(true);
  });
});
