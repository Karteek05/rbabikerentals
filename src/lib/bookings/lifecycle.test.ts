import { describe, expect, it } from "vitest";
import { getBookingInventoryWindow } from "@/lib/bookings/inventory-window";
import { advanceBookingLifecycleIfDue } from "@/lib/bookings/lifecycle";
import { store } from "@/lib/data/store";

describe("booking inventory window", () => {
  it("uses requested_drop_at while extension payment is pending", () => {
    const window = getBookingInventoryWindow({
      id: "booking_test",
      user_id: "cust_001",
      vehicle_id: "veh_001",
      city: "bengaluru",
      status: "extension_requested",
      pickup_at: "2026-07-01T10:00:00.000Z",
      drop_at: "2026-07-02T10:00:00.000Z",
      requested_drop_at: "2026-07-03T10:00:00.000Z",
      quote: {
        base_amount: 750,
        duration_amount: 0,
        addon_amount: 0,
        coupon_discount: 0,
        deposit_amount: 2000,
        tax_amount: 135,
        total_payable: 2885,
        km_included: 120,
        excess_km_rate: 5
      },
      km_limit_bucket: "day",
      km_limit_value: 120,
      created_at: "2026-07-01T09:00:00.000Z",
      updated_at: "2026-07-01T09:00:00.000Z"
    });

    expect(window.dropAt).toBe("2026-07-03T10:00:00.000Z");
  });
});

describe("booking lifecycle", () => {
  it("auto-starts confirmed bookings after pickup time", async () => {
    const bookingId = "booking_lifecycle_start_test";
    const pastPickup = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const futureDrop = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    store.bookings.push({
      id: bookingId,
      user_id: "cust_001",
      vehicle_id: "veh_001",
      city: "bengaluru",
      status: "confirmed",
      pickup_at: pastPickup,
      drop_at: futureDrop,
      quote: {
        base_amount: 750,
        duration_amount: 0,
        addon_amount: 0,
        coupon_discount: 0,
        deposit_amount: 2000,
        tax_amount: 135,
        total_payable: 2885,
        km_included: 120,
        excess_km_rate: 5
      },
      km_limit_bucket: "day",
      km_limit_value: 120,
      created_at: pastPickup,
      updated_at: pastPickup
    });

    const updated = await advanceBookingLifecycleIfDue(
      store.bookings.find((booking) => booking.id === bookingId)!
    );

    expect(updated.status).toBe("ongoing");
    store.bookings = store.bookings.filter((booking) => booking.id !== bookingId);
  });
});
