import { listBookings } from "@/lib/data/repository";
import { bookingDocumentsVehicleId } from "@/lib/bookings/assignment";
import type { ActorContext } from "@/lib/auth/context";
import type { Booking, BookingStatus, Vehicle, VehicleDocument } from "@/lib/types/domain";
import { ApiException } from "@/lib/utils/errors";

/** Post-payment statuses only — no payment_pending or completed. */
export const CUSTOMER_VEHICLE_DOC_STATUSES: BookingStatus[] = [
  "confirmed",
  "ongoing",
  "extension_requested",
  "extended"
];

export const LOCAL_DOC_PREFIX = "local:";

export function isWithinRentalWindow(
  booking: Pick<Booking, "pickup_at" | "drop_at">,
  now = new Date()
) {
  const start = new Date(booking.pickup_at).getTime();
  const end = new Date(booking.drop_at).getTime();
  const t = now.getTime();
  return t >= start && t <= end;
}

export function isBookingStatusEligibleForVehicleDocs(status: BookingStatus) {
  return CUSTOMER_VEHICLE_DOC_STATUSES.includes(status);
}

export function isBookingEligibleForVehicleDocs(
  booking: Pick<Booking, "status" | "pickup_at" | "drop_at">,
  now = new Date()
) {
  return (
    CUSTOMER_VEHICLE_DOC_STATUSES.includes(booking.status) && isWithinRentalWindow(booking, now)
  );
}

export function parseOptionalExpiresAt(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiException(400, "invalid_expires_at", "expires_at must be a valid date.");
  }
  return parsed.toISOString();
}

export function vehicleDocumentDownloadPath(vehicleId: string, docId: string) {
  return `/api/vehicles/${vehicleId}/documents/${docId}/file`;
}

export function vehicleDocumentViewPath(vehicleId: string, docId: string) {
  return `/documents/${vehicleId}/${docId}`;
}

export function toClientDocument(
  vehicleId: string,
  doc: VehicleDocument,
  options?: { viewOnly?: boolean }
): VehicleDocument {
  const file_url = options?.viewOnly
    ? vehicleDocumentViewPath(vehicleId, doc.id)
    : vehicleDocumentDownloadPath(vehicleId, doc.id);
  return { ...doc, file_url };
}

export function toVehicleDocReference(vehicle: Vehicle) {
  return {
    registration_number: vehicle.registration_number ?? null,
    chassis_number: vehicle.chassis_number ?? null
  };
}

export async function assertVehicleDocumentAccess(actor: ActorContext, vehicle: Vehicle) {
  if (actor.role === "admin") return;
  if (actor.role === "partner_investor" && vehicle.owner_id === actor.userId) return;
  if (actor.role === "customer") {
    const bookings = await listBookings({ userId: actor.userId });
    const allowed = bookings.some(
      (booking) =>
        isBookingEligibleForVehicleDocs(booking) &&
        bookingDocumentsVehicleId(booking) === vehicle.id
    );
    if (allowed) return;
  }
  throw new ApiException(
    403,
    "forbidden",
    "You do not have permission to view documents for this vehicle."
  );
}
