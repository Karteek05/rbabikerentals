import { getBookingInventoryWindow } from "@/lib/bookings/inventory-window";
import type { Booking, Vehicle } from "@/lib/types/domain";

const ASSIGNMENT_BLOCKING_STATUSES = new Set<Booking["status"]>([
  "confirmed",
  "ongoing",
  "extension_requested",
  "extended"
]);

function windowsOverlap(a: Booking, b: Pick<Booking, "pickup_at" | "drop_at" | "status" | "requested_drop_at">) {
  const aWindow = getBookingInventoryWindow(a);
  const bWindow = getBookingInventoryWindow(b as Booking);
  const aStart = new Date(aWindow.pickupAt).getTime();
  const aEnd = new Date(aWindow.dropAt).getTime();
  const bStart = new Date(bWindow.pickupAt).getTime();
  const bEnd = new Date(bWindow.dropAt).getTime();
  return aStart < bEnd && bStart < aEnd;
}

export function listAssignableUnitsForBooking(
  booking: Pick<Booking, "id" | "vehicle_id" | "pickup_at" | "drop_at" | "status" | "requested_drop_at">,
  vehicles: Vehicle[],
  bookings: Booking[]
) {
  return vehicles.filter((unit) => {
    if (!unit.chassis_number?.trim() || !unit.is_active) return false;
    if (unit.catalog_vehicle_id !== booking.vehicle_id) return false;

    const conflict = bookings.some(
      (other) =>
        other.id !== booking.id &&
        ASSIGNMENT_BLOCKING_STATUSES.has(other.status) &&
        other.assigned_vehicle_id === unit.id &&
        windowsOverlap(other as Booking, booking)
    );
    return !conflict;
  });
}
