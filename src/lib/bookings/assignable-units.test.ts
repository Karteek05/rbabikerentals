import { describe, expect, it } from "vitest";
import { listAssignableUnitsForBooking } from "@/lib/bookings/assignable-units";
import { inferCatalogVehicleId, inferFleetUnitFromChassis } from "@/lib/fleet/catalog";
import type { Booking, Vehicle } from "@/lib/types/domain";

describe("inferCatalogVehicleId", () => {
  it("maps customer-facing models to catalog ids", () => {
    expect(inferCatalogVehicleId({ brand: "Honda", model: "Dio 110" })).toBe("veh_002");
    expect(inferCatalogVehicleId({ brand: "Honda", model: "Fleet unit" })).toBe("veh_001");
    expect(inferCatalogVehicleId({ brand: "TVS", model: "Raider", category: "bike" })).toBe("veh_004");
  });
});

describe("inferFleetUnitFromChassis", () => {
  it("maps ME4JK chassis imports to Honda Dio", () => {
    const unit = inferFleetUnitFromChassis("ME4JK420CTW009367");
    expect(unit.brand).toBe("Honda");
    expect(unit.model).toBe("Dio 110");
    expect(inferCatalogVehicleId(unit)).toBe("veh_002");
  });
});

describe("listAssignableUnitsForBooking", () => {
  const units: Vehicle[] = [
    {
      id: "veh_unit_a",
      owner_id: "partner_001",
      city: "bengaluru",
      category: "scooter",
      brand: "Honda",
      model: "Dio",
      chassis_number: "ME4JKAAA",
      catalog_vehicle_id: "veh_002",
      is_active: true,
      deposit_amount: 2000,
      rate_per_hour: 0,
      rate_per_day: 3200,
      rate_per_week: 1600,
      rate_per_month: 6000
    },
    {
      id: "veh_unit_b",
      owner_id: "partner_001",
      city: "bengaluru",
      category: "scooter",
      brand: "Honda",
      model: "Dio",
      chassis_number: "ME4JKBBB",
      catalog_vehicle_id: "veh_002",
      is_active: true,
      deposit_amount: 2000,
      rate_per_hour: 0,
      rate_per_day: 3200,
      rate_per_week: 1600,
      rate_per_month: 6000
    }
  ];

  const booking = {
    id: "booking_new",
    vehicle_id: "veh_002",
    pickup_at: "2026-08-01T10:00:00.000Z",
    drop_at: "2026-08-05T10:00:00.000Z",
    status: "confirmed" as const
  };

  it("returns linked units for the booked model", () => {
    expect(listAssignableUnitsForBooking(booking, units, []).map((unit) => unit.id)).toEqual([
      "veh_unit_a",
      "veh_unit_b"
    ]);
  });

  it("excludes units already assigned to overlapping bookings", () => {
    const bookings = [
      {
        id: "booking_other",
        user_id: "cust_001",
        vehicle_id: "veh_002",
        assigned_vehicle_id: "veh_unit_a",
        city: "bengaluru",
        status: "confirmed",
        pickup_at: "2026-08-02T10:00:00.000Z",
        drop_at: "2026-08-06T10:00:00.000Z",
        quote: {
          base_amount: 1,
          duration_amount: 0,
          addon_amount: 0,
          coupon_discount: 0,
          deposit_amount: 0,
          tax_amount: 0,
          total_payable: 1,
          km_included: 0,
          excess_km_rate: 0
        },
        km_limit_bucket: "day",
        km_limit_value: 1,
        created_at: "2026-08-01T09:00:00.000Z",
        updated_at: "2026-08-01T09:00:00.000Z"
      } satisfies Booking
    ];

    expect(listAssignableUnitsForBooking(booking, units, bookings).map((unit) => unit.id)).toEqual([
      "veh_unit_b"
    ]);
  });
});
