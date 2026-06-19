import { describe, expect, it } from "vitest";
import {
  readAccountPayload,
  readBookingsPayload
} from "@/app/profile/profile-data";

describe("profile API payload readers", () => {
  it("unwraps account data from the shared API success envelope", () => {
    const account = readAccountPayload({
      ok: true,
      data: {
        authenticated: true,
        user: {
          id: "user_123",
          role: "customer",
          name: "Jaggu",
          email: "jaggu@example.com",
          phone: null,
          city: "bengaluru",
          kyc_status: "not_started",
          created_at: "2026-06-15T00:00:00.000Z",
          deleted_at: null
        }
      }
    });

    expect(account.authenticated).toBe(true);
    expect(account.user?.name).toBe("Jaggu");
  });

  it("unwraps bookings from the shared API success envelope", () => {
    const bookings = readBookingsPayload({
      ok: true,
      data: {
        bookings: [
          {
            id: "booking_123",
            user_id: "user_123",
            vehicle_id: "veh_001",
            city: "bengaluru",
            status: "confirmed",
            pickup_at: "2026-06-20T08:00:00.000Z",
            drop_at: "2026-06-27T08:00:00.000Z",
            pickup_zone: "Indiranagar",
            pickup_address: null,
            pickup_latitude: null,
            pickup_longitude: null,
            km_limit_bucket: "week",
            km_limit_value: 700,
            quote: {
              base_amount: 1600,
              duration_amount: 0,
              addon_amount: 0,
              coupon_discount: 0,
              tax_amount: 0,
              deposit_amount: 3000,
              total_payable: 4600,
              km_included: 700,
              excess_km_rate: 7
            },
            created_at: "2026-06-15T00:00:00.000Z",
            updated_at: "2026-06-15T00:00:00.000Z"
          }
        ]
      }
    });

    expect(bookings).toHaveLength(1);
    expect(bookings[0].id).toBe("booking_123");
  });
});
