import type { ActorContext } from "@/lib/auth/context";
import {
  getBookingOrThrow,
  getLatestPaidPaymentOrderForBooking,
  getUserOrThrow
} from "@/lib/data/repository";
import { buildBookingInvoice } from "@/lib/invoices/build-invoice";
import type { BookingStatus } from "@/lib/types/domain";
import { ApiException } from "@/lib/utils/errors";

const INVOICE_STATUSES = new Set<BookingStatus>([
  "confirmed",
  "ongoing",
  "extended",
  "completed"
]);

export async function getBookingInvoice(bookingId: string, actor: ActorContext) {
  const booking = await getBookingOrThrow(bookingId);

  if (actor.role === "customer" && booking.user_id !== actor.userId) {
    throw new ApiException(403, "forbidden", "You can view only your own invoices.");
  }

  if (!INVOICE_STATUSES.has(booking.status)) {
    throw new ApiException(
      404,
      "invoice_unavailable",
      "Invoice is available after payment is complete."
    );
  }

  const [user, payment] = await Promise.all([
    getUserOrThrow(booking.user_id),
    getLatestPaidPaymentOrderForBooking(bookingId)
  ]);

  return buildBookingInvoice({ booking, user, payment });
}
