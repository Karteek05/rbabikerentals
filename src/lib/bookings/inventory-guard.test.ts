import { describe, expect, it } from "vitest";
import { insertBookingWithCapacityGuard } from "@/lib/bookings/inventory-guard";
import { store } from "@/lib/data/store";
import type { Booking } from "@/lib/types/domain";

function makeBooking(id: string, vehicleId: string, pickupAt: string, dropAt: string): Booking {
  const quote = {
    base_amount: 1600,
    duration_amount: 1600,
    addon_amount: 0,
    coupon_discount: 0,
    deposit_amount: 2000,
    tax_amount: 0,
    total_payable: 3600,
    km_included: 900,
    excess_km_rate: 5
  };

  return {
    id,
    user_id: "cust_inventory_test",
    vehicle_id: vehicleId,
    city: "bengaluru",
    status: "payment_pending",
    pickup_at: pickupAt,
    drop_at: dropAt,
    quote,
    km_limit_bucket: "week",
    km_limit_value: 900,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

describe("insertBookingWithCapacityGuard", () => {
  it("rejects bookings that would exceed fleet capacity", async () => {
    const vehicleId = "veh_002";
    const pickupAt = "2026-07-04T12:00:00.000Z";
    const dropAt = "2026-07-11T12:00:00.000Z";

    store.bookings = Array.from({ length: 5 }, (_, index) =>
      makeBooking(`booking_capacity_${index}`, vehicleId, pickupAt, dropAt)
    );

    await expect(
      insertBookingWithCapacityGuard(
        makeBooking("booking_capacity_overflow", vehicleId, pickupAt, dropAt)
      )
    ).rejects.toMatchObject({ code: "vehicle_unavailable" });
  });
});
