import type { BookingStatus } from "@/lib/types/domain";
import { ApiException } from "@/lib/utils/errors";

const transitions: Record<BookingStatus, BookingStatus[]> = {
  draft: ["pending_kyc", "admin_review"],
  pending_kyc: ["admin_review", "payment_pending", "cancelled"],
  admin_review: ["payment_pending", "cancelled"],
  payment_pending: ["confirmed", "cancelled"],
  confirmed: ["ongoing", "extension_requested", "extended", "cancelled"],
  ongoing: ["extension_requested", "extended", "completed", "cancelled"],
  extension_requested: ["extended", "ongoing", "cancelled"],
  extended: ["ongoing", "extension_requested", "completed", "cancelled"],
  completed: [],
  cancelled: []
};

export function assertCanTransition(
  from: BookingStatus,
  to: BookingStatus,
  action: string
) {
  if (!transitions[from].includes(to)) {
    throw new ApiException(
      409,
      "invalid_booking_transition",
      `Cannot move booking from ${from} to ${to} during ${action}.`
    );
  }
}

