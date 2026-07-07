import { describe, expect, it } from "vitest";
import {
  buildPricingQuoteFromVehicle,
  computeCancellationBreakup,
  computePricingQuote,
  mergePricingQuotes
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

  it("computes cancellation breakup with non-negative refund", () => {
    const breakup = computeCancellationBreakup({
      totalPayable: 5000,
      pickupAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    });
    expect(breakup.cancellation_charge).toBeGreaterThan(0);
    expect(breakup.refund_amount).toBeGreaterThanOrEqual(0);
  });
});
