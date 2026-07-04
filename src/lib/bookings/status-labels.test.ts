import { describe, expect, it } from "vitest";
import { formatBookingStatus } from "@/lib/bookings/status-labels";

describe("formatBookingStatus", () => {
  it("hides legacy kyc wording in user-facing labels", () => {
    expect(formatBookingStatus("pending_kyc")).toBe("Pending review");
    expect(formatBookingStatus("admin_review")).toBe("Under review");
  });
});
