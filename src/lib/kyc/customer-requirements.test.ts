import { describe, expect, it } from "vitest";
import {
  buildCustomerRequirements,
  requirementsNeedKycAction
} from "@/lib/kyc/customer-requirements";

describe("customer requirements", () => {
  it("marks payment complete for confirmed bookings", () => {
    const items = buildCustomerRequirements({
      kycStatus: "not_started",
      aadhaarVerified: false,
      dlVerified: false,
      paymentComplete: true
    });

    expect(items.find((item) => item.id === "payment")?.state).toBe("complete");
  });

  it("flags missing identity docs for action", () => {
    const items = buildCustomerRequirements({
      kycStatus: "not_started",
      aadhaarVerified: false,
      dlVerified: false,
      paymentComplete: true
    });

    expect(requirementsNeedKycAction(items)).toBe(true);
  });

  it("does not require kyc action when both docs are verified", () => {
    const items = buildCustomerRequirements({
      kycStatus: "verified",
      aadhaarVerified: true,
      dlVerified: true,
      paymentComplete: true
    });

    expect(requirementsNeedKycAction(items)).toBe(false);
  });
});
