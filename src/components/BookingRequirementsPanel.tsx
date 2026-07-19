"use client";

import Link from "next/link";
import { CheckCircle2, Circle, Clock3 } from "lucide-react";
import type { KycStatus } from "@/lib/types/domain";
import {
  buildCustomerRequirements,
  requirementsNeedKycAction,
  type CustomerRequirementState
} from "@/lib/kyc/customer-requirements";
import VehicleDocsPanel from "@/components/VehicleDocsPanel";

type Props = {
  bookingId: string;
  vehicleId: string;
  assignedVehicleId?: string | null;
  bookingStatus: string;
  pickupAt: string;
  dropAt: string;
  kycStatus?: KycStatus;
  aadhaarVerified?: boolean;
  dlVerified?: boolean;
  returnTo?: string;
};

const POST_PAYMENT_STATUSES = new Set([
  "confirmed",
  "ongoing",
  "extended",
  "extension_requested"
]);

const ACTIVE_STATUSES = new Set([
  "pending_kyc",
  "admin_review",
  "payment_pending",
  ...POST_PAYMENT_STATUSES
]);

function RequirementIcon({ state }: { state: CustomerRequirementState }) {
  if (state === "complete") {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-green-700" aria-hidden />;
  }
  if (state === "pending") {
    return <Clock3 className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />;
  }
  return <Circle className="h-4 w-4 shrink-0 text-[color:var(--color-muted)]" aria-hidden />;
}

export default function BookingRequirementsPanel({
  bookingId,
  vehicleId,
  assignedVehicleId,
  bookingStatus,
  pickupAt,
  dropAt,
  kycStatus = "not_started",
  aadhaarVerified = false,
  dlVerified = false,
  returnTo = "/my-bookings"
}: Props) {
  if (!ACTIVE_STATUSES.has(bookingStatus)) return null;

  const paymentComplete = POST_PAYMENT_STATUSES.has(bookingStatus);
  const requirements = buildCustomerRequirements({
    kycStatus,
    aadhaarVerified,
    dlVerified,
    paymentComplete
  });
  const needsKyc = requirementsNeedKycAction(requirements);

  return (
    <div className="mt-4 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-paper)] p-4">
      <div className="mb-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--color-muted)]">
          Required for your ride
        </p>
        <p className="mt-1 text-sm text-[color:var(--color-copy)]">
          Complete identity verification and keep originals ready at pickup.
        </p>
      </div>

      <ul className="grid gap-2">
        {requirements.map((item) => (
          <li
            key={item.id}
            className="flex items-start gap-3 rounded-lg border border-[color:var(--color-line)] bg-white px-3 py-2.5"
          >
            <RequirementIcon state={item.state} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[color:var(--color-ink)]">{item.label}</p>
              <p className="mt-0.5 text-xs text-[color:var(--color-copy)]">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      {needsKyc ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Link href={`/kyc?return=${encodeURIComponent(returnTo)}`} className="btn-primary btn-sm">
            Verify with DigiLocker
          </Link>
          <p className="text-xs text-[color:var(--color-muted)]">
            Carry your original driving licence at handover.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-[color:var(--color-muted)]">
          Carry your original driving licence and Aadhaar at pickup.
        </p>
      )}

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
