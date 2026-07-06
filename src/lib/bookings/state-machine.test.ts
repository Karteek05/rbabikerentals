import { describe, expect, it } from "vitest";
import { assertCanTransition } from "@/lib/bookings/state-machine";

describe("booking state machine", () => {
  it("allows confirmed to ongoing", () => {
    expect(() =>
      assertCanTransition("confirmed", "ongoing", "pickup_start")
    ).not.toThrow();
  });

  it("allows admin to open payment from KYC pending or admin review", () => {
    expect(() =>
      assertCanTransition("pending_kyc", "admin_review", "kyc_verified")
    ).not.toThrow();
    expect(() =>
      assertCanTransition("admin_review", "payment_pending", "admin_approve")
    ).not.toThrow();
    expect(() =>
      assertCanTransition("pending_kyc", "payment_pending", "admin_approve_without_kyc")
    ).not.toThrow();
  });

  it("allows confirmed and extended to request extension", () => {
    expect(() =>
      assertCanTransition("confirmed", "extension_requested", "booking.extend.request")
    ).not.toThrow();
    expect(() =>
      assertCanTransition("extended", "extension_requested", "booking.extend.request")
    ).not.toThrow();
  });

  it("allows extension_requested to resume as ongoing", () => {
    expect(() =>
      assertCanTransition("extension_requested", "ongoing", "booking.resume_after_pickup")
    ).not.toThrow();
  });

  it("blocks completed to ongoing", () => {
    expect(() =>
      assertCanTransition("completed", "ongoing", "invalid_reopen")
    ).toThrow();
  });
});
