import { getBookingInventoryWindow } from "@/lib/bookings/inventory-window";
import { recordAudit } from "@/lib/audit/service";
import {
  getBookingOrThrow,
  getVehicleOrThrow,
  listBookings,
  updateBooking
} from "@/lib/data/repository";
import type { Booking, Role } from "@/lib/types/domain";
import { ApiException } from "@/lib/utils/errors";

const ASSIGNABLE_STATUSES = new Set<Booking["status"]>([
  "confirmed",
  "ongoing",
  "extension_requested",
  "extended"
]);

function windowsOverlap(a: Booking, b: Booking) {
  const aWindow = getBookingInventoryWindow(a);
  const bWindow = getBookingInventoryWindow(b);
  const aStart = new Date(aWindow.pickupAt).getTime();
  const aEnd = new Date(aWindow.dropAt).getTime();
  const bStart = new Date(bWindow.pickupAt).getTime();
  const bEnd = new Date(bWindow.dropAt).getTime();
  return aStart < bEnd && bStart < aEnd;
}

export function bookingDocumentsVehicleId(
  booking: Pick<Booking, "vehicle_id" | "assigned_vehicle_id">
) {
  return booking.assigned_vehicle_id ?? booking.vehicle_id;
}

export async function assignBookingVehicle(
  bookingId: string,
  assignedVehicleId: string,
  actor: { userId: string; role: Role }
) {
  if (actor.role !== "admin") {
    throw new ApiException(403, "forbidden", "Only admin can assign a physical bike.");
  }

  const booking = await getBookingOrThrow(bookingId);
  if (!ASSIGNABLE_STATUSES.has(booking.status)) {
    throw new ApiException(
      409,
      "invalid_state",
      `Cannot assign a bike while booking is ${booking.status}.`
    );
  }

  const unit = await getVehicleOrThrow(assignedVehicleId);
  if (!unit.chassis_number?.trim()) {
    throw new ApiException(
      400,
      "invalid_vehicle",
      "Assign a physical unit that has a chassis number."
    );
  }

  if (!unit.catalog_vehicle_id?.trim()) {
    throw new ApiException(
      400,
      "invalid_vehicle",
      "Assign a physical unit that is linked to a fleet model."
    );
  }

  if (unit.catalog_vehicle_id !== booking.vehicle_id) {
    throw new ApiException(
      409,
      "catalog_mismatch",
      "This physical bike belongs to a different fleet model than the booking."
    );
  }

  const activeBookings = await listBookings({
    excludeStatuses: ["cancelled", "completed"]
  });
  const conflict = activeBookings.some(
    (other) =>
      other.id !== booking.id &&
      other.assigned_vehicle_id === assignedVehicleId &&
      windowsOverlap(other, booking)
  );
  if (conflict) {
    throw new ApiException(
      409,
      "unit_unavailable",
      "This physical bike is already assigned for an overlapping rental."
    );
  }

  const now = new Date().toISOString();
  const updated = await updateBooking(booking.id, {
    assigned_vehicle_id: assignedVehicleId,
    assigned_at: now,
    updated_at: now
  });

  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "booking.assign_vehicle",
    resourceType: "booking",
    resourceId: booking.id,
    metadata: {
      catalog_vehicle_id: booking.vehicle_id,
      assigned_vehicle_id: assignedVehicleId
    }
  });

  return updated;
}
