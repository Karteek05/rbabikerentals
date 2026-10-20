import { describe, expect, it } from "vitest";
import {
  buildPricingQuoteFromVehicle,
  computeCancellationBreakup,
  computePricingQuote,
  mergePricingQuotes,
  resolveDurationValueFromWindow
} from "@/lib/pricing/engine";

const sampleVehicle = {
  id: "veh_001",
  owner_id: "partner_001",
  city: "bengaluru" as const,
  category: "scooter" as const,
  brand: "Honda",
  model: "Activa",
  is_active: true,
  deposit_amount: 2000,
  rate_per_hour: 50,
  rate_per_day: 250,
  rate_per_week: 1600,
  rate_per_month: 6000
};

describe("pricing engine", () => {
  it("rejects a rental window that does not match its selected duration", () => {
    let error: unknown;
    try {
      resolveDurationValueFromWindow({
        duration_bucket: "day",
        start_at: "2026-07-14T10:00:00.000Z",
        end_at: "2026-07-15T09:00:00.000Z"
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({
      status: 400,
      code: "duration_window_mismatch"
    });
  });
  it("keeps the original payable amount while adding display breakdown fields", async () => {
    const quote = await computePricingQuote({
      user_id: "cust_001",
      vehicle_id: "veh_001",
      city: "bengaluru",
      duration_bucket: "day",
      duration_value: 1,
      extra_helmet_count: 1,
      coupon_code: "WELCOME5"
    });

    expect(quote.base_amount).toBe(250);
    expect(quote.addon_amount).toBe(50);
    expect(quote.coupon_discount).toBe(15);
    expect(quote.tax_amount).toBe(43);
    expect(quote.total_cost).toBe(285);
    expect(quote.total_payable).toBe(2285);
    expect(quote.deposit_amount).toBe(2000);
    expect(quote.cgst_amount).toBe(22);
    expect(quote.sgst_amount).toBe(21);
    expect(quote.vehicle_rental_cost).toBe(1200);
    expect(quote.plan_discount).toBe(950);
    expect(quote.km_included).toBe(120);
    expect(quote.excess_km_rate).toBe(5);
  });

  it("derives list daily rate from weekly rate when hourly rate is zero", () => {
    const quote = buildPricingQuoteFromVehicle(
      {
        id: "veh_001",
        owner_id: "partner_001",
        city: "bengaluru",
        category: "scooter",
        brand: "Honda",
        model: "Activa",
        is_active: true,
        deposit_amount: 2000,
        rate_per_hour: 0,
        rate_per_day: 3200,
        rate_per_week: 1600,
        rate_per_month: 6000
      },
      {
        duration_bucket: "week",
        duration_value: 1
      }
    );

    expect(quote.vehicle_rental_cost).toBe(1600);
    expect(quote.plan_discount).toBe(0);
    expect(quote.total_payable).toBe(3600);
  });

  it("does not change weekly package payable totals", () => {
    const quote = buildPricingQuoteFromVehicle(sampleVehicle, {
      duration_bucket: "week",
      duration_value: 1
    });

    expect(quote.base_amount).toBe(1600);
    expect(quote.tax_amount).toBe(244);
    expect(quote.total_cost).toBe(1600);
    expect(quote.total_payable).toBe(3600);
    expect(quote.plan_discount).toBeGreaterThan(0);
  });
  it("does not apply legacy promotions without a configured coupon rate", () => {
    const input = { duration_bucket: "week" as const, duration_value: 1, coupon_code: "WELCOME5" };
    expect(buildPricingQuoteFromVehicle(sampleVehicle, input).coupon_discount).toBe(0);
    expect(buildPricingQuoteFromVehicle(sampleVehicle, input, 0.1).coupon_discount).toBe(160);
  });

  it.each([
    ["hour", 2, 120, 20],
    ["day", 1, 350, 130],
    ["week", 1, 1400, 950],
    ["day", 15, 350, 1950],
    ["month", 1, 5100, 3100]
  ] as const)("uses configured %s rental pricing and mileage", (bucket, count, expectedBase, expectedKm) => {
    const quote = buildPricingQuoteFromVehicle(
      {
        ...sampleVehicle,
        deposit_amount: 2600,
        rate_per_hour: 60,
        rate_per_day: 350,
        rate_per_week: 1400,
        rate_per_month: 5100,
        included_km_per_hour: 10,
        included_km_per_day: 130,
        included_km_per_week: 950,
        included_km_per_month: 3100,
        excess_km_rate: 8
      },
      {
        duration_bucket: bucket,
        duration_value: count
      }
    );

    expect(quote.base_amount).toBe(expectedBase);
    expect(quote.deposit_amount).toBe(2600);
    expect(quote.km_included).toBe(expectedKm);
    expect(quote.excess_km_rate).toBe(8);
    expect(quote.total_payable).toBeGreaterThan(2600);
  });

  it("merges extension quotes without changing payable math", () => {
    const base = buildPricingQuoteFromVehicle(sampleVehicle, {
      duration_bucket: "week",
      duration_value: 1
    });
    const extension = buildPricingQuoteFromVehicle(sampleVehicle, {
      duration_bucket: "day",
      duration_value: 1
    });

    const merged = mergePricingQuotes(base, {
      ...extension,
      deposit_amount: 0,
      total_payable: extension.total_cost ?? 0
    });

    expect(merged.total_payable).toBe(base.total_payable + (extension.total_cost ?? 0));
    expect(merged.total_cost).toBe((base.total_cost ?? 0) + (extension.total_cost ?? 0));
  });

  it("computes cancellation breakup with non-negative refund", async () => {
    const breakup = await computeCancellationBreakup({
      totalPayable: 5000,
      pickupAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    });
    expect(breakup.cancellation_charge).toBeGreaterThan(0);
    expect(breakup.refund_amount).toBeGreaterThanOrEqual(0);
  });
});
