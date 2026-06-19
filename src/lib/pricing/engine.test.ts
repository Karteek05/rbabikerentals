import { describe, expect, it } from "vitest";
import { computePricingQuote, computeCancellationBreakup } from "@/lib/pricing/engine";

describe("pricing engine", () => {
  it("computes quote for a day booking", async () => {
    const quote = await computePricingQuote({
      user_id: "cust_001",
      vehicle_id: "veh_001",
      city: "bengaluru",
      duration_bucket: "day",
      duration_value: 1,
      extra_helmet_count: 1,
      coupon_code: "WELCOME5"
    });

    expect(quote.total_payable).toBeGreaterThan(0);
    expect(quote.deposit_amount).toBe(2000);
    expect(quote.km_included).toBe(120);
    expect(quote.excess_km_rate).toBe(5);
  });

  it("computes cancellation breakup with non-negative refund", () => {
    const breakup = computeCancellationBreakup({
      totalPayable: 5000,
      pickupAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    });
    expect(breakup.cancellation_charge).toBeGreaterThan(0);
    expect(breakup.refund_amount).toBeGreaterThanOrEqual(0);
  });
});

