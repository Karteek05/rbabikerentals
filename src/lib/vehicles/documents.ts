import {
  getLatestPaidPaymentOrderForBooking,
  listBookings
} from "@/lib/data/repository";
import { bookingDocumentsVehicleId } from "@/lib/bookings/assignment";
import type { ActorContext } from "@/lib/auth/context";
import type { BookingStatus, Vehicle, VehicleDocument } from "@/lib/types/domain";
import { ApiException } from "@/lib/utils/errors";

/** Booking states that can follow successful payment. The API additionally verifies the payment record. */
export const CUSTOMER_VEHICLE_DOC_STATUSES: BookingStatus[] = [
  "confirmed",
  "ongoing",
  "extension_requested",
  "extended",
  "completed",
  "cancelled"
];

export const LOCAL_DOC_PREFIX = "local:";

export function isBookingEligibleForVehicleDocs(booking: { status: BookingStatus }) {
  return CUSTOMER_VEHICLE_DOC_STATUSES.includes(booking.status);
}

export function parseOptionalExpiresAt(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiException(400, "invalid_expires_at", "expires_at must be a valid date.");
  }
  return parsed.toISOString();
}

export function vehicleDocumentDownloadPath(vehicleId: string, docId: string, download = false) {
  const path = `/api/vehicles/${vehicleId}/documents/${docId}/file`;
  return download ? `${path}?download=1` : path;
}

export function vehicleDocumentViewPath(vehicleId: string, docId: string) {
  return `/documents/${vehicleId}/${docId}`;
}

export function toClientDocument(
  vehicleId: string,
  doc: VehicleDocument,
  options?: { openInViewer?: boolean }
): VehicleDocument {
  const file_url = options?.openInViewer
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
    const matchingBookings = bookings.filter(
      (booking) => bookingDocumentsVehicleId(booking) === vehicle.id
    );
    const paidOrders = await Promise.all(
      matchingBookings.map((booking) => getLatestPaidPaymentOrderForBooking(booking.id))
    );
    if (paidOrders.some(Boolean)) return;
  }
  throw new ApiException(
    403,
    "forbidden",
    "You do not have permission to view documents for this vehicle."
  );
}
