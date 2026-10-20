"use client";

import { CheckCircle2, Circle } from "lucide-react";
import VehicleDocsPanel from "@/components/VehicleDocsPanel";

type Props = {
  bookingId: string;
  vehicleId: string;
  assignedVehicleId?: string | null;
  bookingStatus: string;
  pickupAt: string;
  dropAt: string;
};

const POST_PAYMENT_STATUSES = new Set([
  "confirmed",
  "ongoing",
  "extended",
  "extension_requested"
]);

const ACTIVE_STATUSES = new Set([
  "payment_pending",
  ...POST_PAYMENT_STATUSES
]);

export default function BookingRequirementsPanel({
  bookingId,
  vehicleId,
  assignedVehicleId,
  bookingStatus,
  pickupAt,
  dropAt
}: Props) {
  if (!ACTIVE_STATUSES.has(bookingStatus)) return null;

  const paymentComplete = POST_PAYMENT_STATUSES.has(bookingStatus);

  return (
    <div className="mt-4 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-paper)] p-4">
      <div className="mb-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--color-muted)]">
          For your ride
        </p>
        <p className="mt-1 text-sm text-[color:var(--color-copy)]">
          {paymentComplete
            ? "Bring your original valid driving licence when you pick up the vehicle."
            : "Complete the payment from My Bookings to confirm your ride."}
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-[color:var(--color-line)] bg-white px-3 py-2.5">
        {paymentComplete ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-700" aria-hidden />
        ) : (
          <Circle className="h-4 w-4 shrink-0 text-[color:var(--color-muted)]" aria-hidden />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[color:var(--color-ink)]">Booking payment</p>
          <p className="mt-0.5 text-xs text-[color:var(--color-copy)]">
            {paymentComplete ? "Payment complete" : "Payment pending"}
          </p>
        </div>
      </div>

      {paymentComplete ? (
        <VehicleDocsPanel
          bookingId={bookingId}
          vehicleId={vehicleId}
          assignedVehicleId={assignedVehicleId}
          bookingStatus={bookingStatus}
          pickupAt={pickupAt}
          dropAt={dropAt}
          compact
        />
      ) : null}
    </div>
  );
}
