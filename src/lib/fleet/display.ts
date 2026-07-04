import { PUBLIC_FLEET_BY_ID } from "@/lib/fleet/catalog";

export function getVehicleDisplayName(
  vehicleId: string,
  fallback?: { brand?: string; model?: string }
) {
  const catalog = PUBLIC_FLEET_BY_ID[vehicleId];
  if (catalog) {
    return `${catalog.brand} ${catalog.model}`;
  }
  if (fallback?.brand && fallback?.model) {
    return `${fallback.brand} ${fallback.model}`;
  }
  if (fallback?.brand) return fallback.brand;
  return vehicleId;
}

export function formatBookingReference(bookingId: string) {
  const short = bookingId.replace(/^booking_/, "").slice(0, 8).toUpperCase();
  return `RBA-${short}`;
}
