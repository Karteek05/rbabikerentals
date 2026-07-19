import { describe, expect, it } from "vitest";
import { assignBookingVehicle, bookingDocumentsVehicleId } from "@/lib/bookings/assignment";
import { store } from "@/lib/data/store";

describe("booking vehicle assignment", () => {
  it("prefers assigned physical bike for customer documents", () => {
    expect(
      bookingDocumentsVehicleId({
        vehicle_id: "veh_001",
        assigned_vehicle_id: "veh_me4jk420ctw009367"
      })
    ).toBe("veh_me4jk420ctw009367");
  });

  it("assigns a chassis unit to a confirmed booking", async () => {
    const bookingId = "booking_assign_test";
    store.bookings.push({
      id: bookingId,
      user_id: "cust_001",
      vehicle_id: "veh_002",
      city: "bengaluru",
      status: "confirmed",
      pickup_at: "2026-08-01T10:00:00.000Z",
      drop_at: "2026-08-05T10:00:00.000Z",
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
      created_at: "2026-08-01T09:00:00.000Z",
      updated_at: "2026-08-01T09:00:00.000Z"
    });
    store.vehicles.push({
      id: "veh_unit_test",
      owner_id: "partner_001",
      city: "bengaluru",
      category: "scooter",
      brand: "Honda",
      model: "Dio",
      chassis_number: "ME4JKTEST0000001",
      catalog_vehicle_id: "veh_002",
      is_active: true,
      deposit_amount: 2000,
      rate_per_hour: 0,
      rate_per_day: 3200,
      rate_per_week: 1600,
      rate_per_month: 6000
    });

    const updated = await assignBookingVehicle(bookingId, "veh_unit_test", {
      userId: "admin_001",
      role: "admin"
    });

    expect(updated.assigned_vehicle_id).toBe("veh_unit_test");
    store.bookings = store.bookings.filter((booking) => booking.id !== bookingId);
    store.vehicles = store.vehicles.filter((vehicle) => vehicle.id !== "veh_unit_test");
  });

  it("rejects a physical unit that is not linked to a fleet model", async () => {
    const bookingId = "booking_assign_unlinked";
    store.bookings.push({
      id: bookingId,
      user_id: "cust_001",
      vehicle_id: "veh_002",
      city: "bengaluru",
      status: "confirmed",
      pickup_at: "2026-08-01T10:00:00.000Z",
      drop_at: "2026-08-05T10:00:00.000Z",
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
      created_at: "2026-08-01T09:00:00.000Z",
      updated_at: "2026-08-01T09:00:00.000Z"
    });
    store.vehicles.push({
      id: "veh_unlinked",
      owner_id: "partner_001",
      city: "bengaluru",
      category: "scooter",
      brand: "Honda",
      model: "Dio",
      chassis_number: "ME4JKUNLINKED001",
      is_active: true,
      deposit_amount: 2000,
      rate_per_hour: 0,
      rate_per_day: 3200,
      rate_per_week: 1600,
      rate_per_month: 6000
    });

    await expect(
      assignBookingVehicle(bookingId, "veh_unlinked", { userId: "admin_001", role: "admin" })
    ).rejects.toMatchObject({ code: "invalid_vehicle" });

    store.bookings = store.bookings.filter((booking) => booking.id !== bookingId);
    store.vehicles = store.vehicles.filter((vehicle) => vehicle.id !== "veh_unlinked");
  });
});
