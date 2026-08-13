import { afterEach, describe, expect, it } from "vitest";
import { approveBooking } from "@/lib/admin/service";
import { createBooking } from "@/lib/bookings/service";
import { store } from "@/lib/data/store";

describe("direct payment booking flow", () => {
  afterEach(() => {
    store.notificationJobs = [];
  });

  it("creates payment-ready bookings immediately", async () => {
    const baseTime = Date.now();
    const start = new Date(baseTime + 10 * 24 * 60 * 60 * 1000).toISOString();
    const end = new Date(baseTime + 11 * 24 * 60 * 60 * 1000).toISOString();

    const booking = await createBooking(
      {
        user_id: "cust_001",
        vehicle_id: "veh_003",
        city: "bengaluru",
        pickup_at: start,
        drop_at: end,
        pickup_zone: "Indiranagar",
        duration_bucket: "day",
        duration_value: 1,
        km_limit_bucket: "day",
        km_limit_value: 120,
        customer_profile: {
          legal_name: "Rahul Customer",
          email: "rahul@example.com",
          mobile: "+919876543210",
          pan_number: "ABCDE1234F",
          date_of_birth: "1996-01-15",
          cibil_consent: true
        }
      },
      { userId: "cust_001", role: "customer" }
    );

    expect(booking.status).toBe("payment_pending");
    expect(booking.payment_order).toBeNull();

    expect(store.notificationJobs.map((job) => job.template_key)).toContain(
      "booking_submitted_admin"
    );

  });

  it("allows admin to approve a booking that is still pending KYC", async () => {
    const bookingId = `booking_pending_kyc_${Date.now()}`;
    const baseTime = Date.now();

    store.bookings.push({
      id: bookingId,
      user_id: "cust_002",
      vehicle_id: "veh_002",
      city: "bengaluru",
      status: "pending_kyc",
      pickup_at: new Date(baseTime + 12 * 24 * 60 * 60 * 1000).toISOString(),
      drop_at: new Date(baseTime + 13 * 24 * 60 * 60 * 1000).toISOString(),
      pickup_zone: "Indiranagar",
      pickup_address: null,
      pickup_latitude: null,
      pickup_longitude: null,
      km_limit_bucket: "day",
      km_limit_value: 120,
      quote: {
        base_amount: 1600,
        duration_amount: 1600,
        addon_amount: 0,
        coupon_discount: 0,
        tax_amount: 288,
        deposit_amount: 2000,
        total_payable: 3888,
        km_included: 120,
        excess_km_rate: 4
      },
      created_at: new Date(baseTime).toISOString(),
      updated_at: new Date(baseTime).toISOString()
    });

    const approved = await approveBooking(
      bookingId,
      { note: "manual approval without KYC for current ops" },
      { userId: "admin_001", role: "admin" }
    );

    expect(approved.status).toBe("payment_pending");
  });
});
