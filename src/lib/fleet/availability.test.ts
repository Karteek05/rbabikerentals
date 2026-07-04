import { describe, expect, it } from "vitest";
import { store } from "@/lib/data/store";
import {
  getVehicleStockCapacity,
  isVehicleAvailableForWindow
} from "@/lib/fleet/availability";

describe("fleet availability capacity", () => {
  it("allows another booking while fleet stock has remaining units", async () => {
    const now = new Date().toISOString();
    const pickup = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const drop = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();

    store.bookings.push({
      id: "booking_capacity_test_1",
      user_id: "cust_001",
      vehicle_id: "veh_001",
      city: "bengaluru",
      status: "payment_pending",
      pickup_at: pickup,
      drop_at: drop,
      quote: {
        base_amount: 1600,
        duration_amount: 0,
        addon_amount: 0,
        coupon_discount: 0,
        deposit_amount: 2000,
        tax_amount: 0,
        total_payable: 3600,
        km_included: 900,
        excess_km_rate: 5
      },
      km_limit_bucket: "week",
      km_limit_value: 1,
      created_at: now,
      updated_at: now
    });

    const available = await isVehicleAvailableForWindow("veh_001", pickup, drop);
    expect(getVehicleStockCapacity("veh_001")).toBe(15);
    expect(available).toBe(true);

    store.bookings = store.bookings.filter(
      (booking) => booking.id !== "booking_capacity_test_1"
    );
  });
});
