const BOOKING_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_kyc: "Pending review",
  admin_review: "Under review",
  payment_pending: "Payment pending",
  confirmed: "Confirmed",
  ongoing: "Ongoing",
  extension_requested: "Extension requested",
  extended: "Extended",
  completed: "Completed",
  cancelled: "Cancelled"
};

export function formatBookingStatus(status: string) {
  if (BOOKING_STATUS_LABELS[status]) {
    return BOOKING_STATUS_LABELS[status];
  }

  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
