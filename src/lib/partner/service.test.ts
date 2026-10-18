import { describe, expect, it } from "vitest";
import type { Booking, BookingStatus, Vehicle, VehicleBlockWindow } from "@/lib/types/domain";
import {
  deriveVehiclePosition,
  filterBookingsByDateRange,
  filterBookingsByTab,
  getPartnerRevenue,
  isBlockActive,
  maskPartnerName
} from "@/lib/partner/service";
import { store } from "@/lib/data/store";

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
describe("investor reporting date boundaries", () => {
  it("includes the full selected Bengaluru calendar day and excludes the next one", () => {
    const bookings = [
      {
        ...makeBooking("confirmed"),
        id: "booking_reporting_before_day",
        created_at: "2026-07-13T18:29:59.999Z"
      },
      {
        ...makeBooking("confirmed"),
        id: "booking_reporting_day_start",
        created_at: "2026-07-13T18:30:00.000Z"
      },
      {
        ...makeBooking("confirmed"),
        id: "booking_reporting_day_end",
        created_at: "2026-07-14T18:29:59.999Z"
      },
      {
        ...makeBooking("confirmed"),
        id: "booking_reporting_next_day",
        created_at: "2026-07-14T18:30:00.000Z"
      }
    ];

    expect(
      filterBookingsByDateRange(bookings, "2026-07-14", "2026-07-14").map(
        (booking) => booking.id
      )
    ).toEqual(["booking_reporting_day_start", "booking_reporting_day_end"]);
  });
});
describe("investor revenue analytics", () => {
  it("scopes vehicle totals to the assigned investor and includes completed rentals", async () => {
    const investorVehicleId = "veh_investor_revenue_test";
    const otherVehicleId = "veh_other_investor_revenue_test";
    const completedBooking = {
      ...makeBooking("completed"),
      id: "booking_investor_revenue_test",
      vehicle_id: investorVehicleId,
      created_at: "2026-07-31T20:00:00.000Z"
    };
    const pendingBooking = {
      ...makeBooking("payment_pending"),
      id: "booking_investor_pending_test",
      vehicle_id: investorVehicleId
    };
    const otherBooking = {
      ...makeBooking("completed"),
      id: "booking_other_investor_revenue_test",
      vehicle_id: otherVehicleId
    };
    store.vehicles.push(
      makeVehicle({ id: investorVehicleId, owner_id: "partner_001" }),
      makeVehicle({ id: otherVehicleId, owner_id: "partner_other" })
    );
    store.bookings.push(completedBooking, pendingBooking, otherBooking);

    try {
      const revenue = await getPartnerRevenue("partner_001");
      expect(revenue.totals.gross_revenue).toBe(completedBooking.quote.total_payable);
      expect(revenue.by_period).toEqual([
        {
          period: "2026-08",
          revenue: completedBooking.quote.total_payable,
          bookings: 1
        }
      ]);
      expect(revenue.totals.pending_revenue).toBe(pendingBooking.quote.total_payable);
      expect(revenue.vehicle_wise).toEqual([
        {
          vehicle_id: investorVehicleId,
          vehicle_label: "Test Scooter",
          registration_number: null,
          booking_count: 2,
          revenue: completedBooking.quote.total_payable
        }
      ]);
    } finally {
      store.vehicles = store.vehicles.filter(
        (vehicle) => vehicle.id !== investorVehicleId && vehicle.id !== otherVehicleId
      );
      store.bookings = store.bookings.filter(
        (booking) =>
          booking.id !== completedBooking.id &&
          booking.id !== pendingBooking.id &&
          booking.id !== otherBooking.id
      );
    }
  });
});
