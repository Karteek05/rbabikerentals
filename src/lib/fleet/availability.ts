import { PUBLIC_FLEET, PUBLIC_FLEET_BY_ID } from "@/lib/fleet/catalog";
import { listBookings, listVehicles } from "@/lib/data/repository";
import type { BookingStatus } from "@/lib/types/domain";

export const INVENTORY_HOLDING_STATUSES = new Set<BookingStatus>([
  "pending_kyc",
  "admin_review",
  "payment_pending",
  "confirmed",
  "ongoing",
  "extension_requested",
  "extended"
]);

export function getVehicleStockCapacity(vehicleId: string) {
  return PUBLIC_FLEET_BY_ID[vehicleId]?.stockApprox ?? 1;
}

export function windowsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
) {
  const aStart = new Date(startA).getTime();
  const aEnd = new Date(endA).getTime();
  const bStart = new Date(startB).getTime();
  const bEnd = new Date(endB).getTime();
  return aStart < bEnd && aEnd > bStart;
}

export async function countOverlappingInventoryBookings(
  vehicleId: string,
  pickupAt: string,
  dropAt: string,
  options?: { ignoreBookingId?: string }
) {
  const bookings = await listBookings({
    vehicleId,
    excludeStatuses: ["cancelled", "completed"]
  });

  return bookings.filter((booking) => {
    if (options?.ignoreBookingId && booking.id === options.ignoreBookingId) {
      return false;
    }
    if (!INVENTORY_HOLDING_STATUSES.has(booking.status)) {
      return false;
    }
    return windowsOverlap(booking.pickup_at, booking.drop_at, pickupAt, dropAt);
  }).length;
}

export async function isVehicleAvailableForWindow(
  vehicleId: string,
  pickupAt: string,
  dropAt: string,
  options?: { ignoreBookingId?: string }
) {
  const overlapping = await countOverlappingInventoryBookings(
    vehicleId,
    pickupAt,
    dropAt,
    options
  );
  return overlapping < getVehicleStockCapacity(vehicleId);
}

export async function getFleetAvailability(params: {
  pickupAt: string;
  dropAt: string;
}) {
  const [vehicles, bookings] = await Promise.all([listVehicles(), listBookings()]);
  const vehicleMap = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

  return PUBLIC_FLEET.map((catalogVehicle) => {
    const dbVehicle = vehicleMap.get(catalogVehicle.id);
    const isActive = dbVehicle?.is_active ?? catalogVehicle.is_active;
    const totalUnits = getVehicleStockCapacity(catalogVehicle.id);
    const overlappingBookings = bookings.filter(
      (booking) =>
        booking.vehicle_id === catalogVehicle.id &&
        INVENTORY_HOLDING_STATUSES.has(booking.status) &&
        windowsOverlap(
          booking.pickup_at,
          booking.drop_at,
          params.pickupAt,
          params.dropAt
        )
    ).length;
    const availableUnits = Math.max(0, totalUnits - overlappingBookings);

    return {
      vehicle_id: catalogVehicle.id,
      display_name: `${catalogVehicle.brand} ${catalogVehicle.model}`,
      total_units: totalUnits,
      available_units: availableUnits,
      booked_units: overlappingBookings,
      is_active: isActive,
      is_available: isActive && availableUnits > 0
    };
  });
}
