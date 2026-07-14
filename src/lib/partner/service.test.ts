import { describe, expect, it } from "vitest";
import type { Booking, BookingStatus, Vehicle, VehicleBlockWindow } from "@/lib/types/domain";
import {
  deriveVehiclePosition,
  filterBookingsByTab,
  isBlockActive,
  maskPartnerName
} from "@/lib/partner/service";

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "veh_test",
    owner_id: "partner_001",
    city: "bengaluru",
    category: "scooter",
    brand: "Test",
    model: "Scooter",
    is_active: true,
    deposit_amount: 1000,
    rate_per_hour: 50,
    rate_per_day: 400,
    rate_per_week: 2000,
    rate_per_month: 6000,
    ...overrides
  };
}

function makeBooking(status: BookingStatus): Booking {
  return {
    id: `booking_${status}`,
    user_id: "cust_001",
    vehicle_id: "veh_test",
    city: "bengaluru",
    status,
    pickup_at: "2026-07-14T10:00:00.000Z",
    drop_at: "2026-07-15T10:00:00.000Z",
    quote: {
      base_amount: 400,
      duration_amount: 0,
      addon_amount: 0,
      coupon_discount: 0,
      deposit_amount: 1000,
      tax_amount: 0,
      total_payable: 1400,
      km_included: 100,
      excess_km_rate: 5
    },
    km_limit_bucket: "day",
    km_limit_value: 1,
    created_at: "2026-07-14T08:00:00.000Z",
    updated_at: "2026-07-14T08:00:00.000Z"
  };
}

describe("isBlockActive", () => {
  const block: VehicleBlockWindow = {
    id: "block_1",
    vehicle_id: "veh_test",
    starts_at: "2026-07-14T08:00:00.000Z",
    ends_at: "2026-07-14T18:00:00.000Z",
    reason: "maintenance",
    created_by: "admin_001",
    created_at: "2026-07-14T07:00:00.000Z"
  };

  it("returns true when now is inside the block window", () => {
    expect(isBlockActive(block, new Date("2026-07-14T12:00:00.000Z"))).toBe(true);
  });

  it("returns false before or after the block window", () => {
    expect(isBlockActive(block, new Date("2026-07-14T07:59:59.000Z"))).toBe(false);
    expect(isBlockActive(block, new Date("2026-07-14T18:00:01.000Z"))).toBe(false);
  });
});

describe("deriveVehiclePosition", () => {
  it("returns halt when an active block exists", () => {
    expect(deriveVehiclePosition(makeVehicle(), makeBooking("ongoing"), true)).toBe("halt");
  });

  it("returns idle for inactive vehicles without active bookings", () => {
    expect(deriveVehiclePosition(makeVehicle({ is_active: false }), null, false)).toBe("idle");
  });

  it("maps active booking statuses to running or waiting", () => {
    expect(deriveVehiclePosition(makeVehicle(), makeBooking("ongoing"), false)).toBe("running");
    expect(deriveVehiclePosition(makeVehicle(), makeBooking("extended"), false)).toBe("running");
    expect(deriveVehiclePosition(makeVehicle(), makeBooking("confirmed"), false)).toBe("waiting");
  });

  it("returns idle when no active booking applies", () => {
    expect(deriveVehiclePosition(makeVehicle(), null, false)).toBe("idle");
    expect(deriveVehiclePosition(makeVehicle(), makeBooking("completed"), false)).toBe("idle");
  });
});

describe("maskPartnerName", () => {
  it("masks each word while keeping first and last characters", () => {
    expect(maskPartnerName("Ravi Kumar")).toBe("R**i K***r");
  });

  it("handles short names and empty input", () => {
    expect(maskPartnerName("Jo")).toBe("J*");
    expect(maskPartnerName("   ")).toBe("—");
  });
});

describe("filterBookingsByTab", () => {
  const bookings = [
    makeBooking("confirmed"),
    makeBooking("ongoing"),
    makeBooking("completed"),
    makeBooking("cancelled")
  ];

  it("returns all bookings for the all tab", () => {
    expect(filterBookingsByTab(bookings, "all")).toHaveLength(4);
  });

  it("filters upcoming, ongoing, completed, and cancelled tabs", () => {
    expect(filterBookingsByTab(bookings, "upcoming").map((booking) => booking.status)).toEqual([
      "confirmed"
    ]);
    expect(filterBookingsByTab(bookings, "ongoing").map((booking) => booking.status)).toEqual([
      "ongoing"
    ]);
    expect(filterBookingsByTab(bookings, "completed").map((booking) => booking.status)).toEqual([
      "completed"
    ]);
    expect(filterBookingsByTab(bookings, "cancelled").map((booking) => booking.status)).toEqual([
      "cancelled"
    ]);
  });
});
