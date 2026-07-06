import type { Booking } from "@/lib/types/domain";

export function getBookingInventoryWindow(booking: Booking) {
  if (booking.status === "extension_requested" && booking.requested_drop_at) {
    return {
      pickupAt: booking.pickup_at,
      dropAt: booking.requested_drop_at
    };
  }

  return {
    pickupAt: booking.pickup_at,
    dropAt: booking.drop_at
  };
}
