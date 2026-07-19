"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Booking } from "@/lib/types/domain";
import {
  canShowVehicleDocsSection,
  isBookingEligibleForVehicleDocs,
  isBeforeRentalWindow,
  isWithinRentalWindow
} from "@/lib/vehicles/documents";

type Doc = {
  id: string;
  doc_type: string;
  file_url: string;
  expires_at?: string | null;
};

type VehicleRef = {
  registration_number?: string | null;
  chassis_number?: string | null;
};

type Props = {
  bookingId: string;
  vehicleId: string;
  assignedVehicleId?: string | null;
  bookingStatus: string;
  pickupAt: string;
  dropAt: string;
  compact?: boolean;
};

export default function VehicleDocsPanel({
  assignedVehicleId,
  bookingStatus,
  pickupAt,
  dropAt,
  compact
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [vehicleRef, setVehicleRef] = useState<VehicleRef | null>(null);
  const [error, setError] = useState("");

  const eligible = isBookingEligibleForVehicleDocs({
    status: bookingStatus as Booking["status"],
    pickup_at: pickupAt,
    drop_at: dropAt
  });
  const canPreview = canShowVehicleDocsSection({
    status: bookingStatus as Booking["status"],
    pickup_at: pickupAt,
    drop_at: dropAt
  });
  const beforePickup = isBeforeRentalWindow({ pickup_at: pickupAt });
  const docsVehicleId = assignedVehicleId ?? null;

  const loadDocs = useCallback(async () => {
    if (!docsVehicleId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/vehicles/${docsVehicleId}/documents`, { credentials: "include" });
      const json = await res.json();
      if (!json.ok) {
        setDocs([]);
        setError(json?.error?.message ?? "Could not load documents.");
        return;
      }
      setDocs(json.data.documents ?? []);
      setVehicleRef(json.data.vehicle ?? null);
    } catch {
      setDocs([]);
      setError("Could not load documents.");
    } finally {
      setLoading(false);
    }
  }, [docsVehicleId]);

  useEffect(() => {
    if (!open || !docsVehicleId || !eligible) return;
    setDocs([]);
    setVehicleRef(null);
    void loadDocs();
  }, [open, docsVehicleId, eligible, loadDocs]);

  if (!canPreview) return null;

  function toggle() {
    setOpen((current) => !current);
  }

  const pickupLabel = new Date(pickupAt).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });

  const hasRc = docs.some((d) => d.doc_type === "rc");
  const reg = vehicleRef?.registration_number;
  const chassis = vehicleRef?.chassis_number;

  return (
    <div className={compact ? "mt-3" : "mt-4"}>
      <button type="button" className="btn-secondary btn-sm" onClick={toggle}>
        {open ? "Hide vehicle papers" : "Vehicle papers (RC, insurance)"}
      </button>
      {open ? (
        <div className="mt-3 rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-white)] p-4">
          {!docsVehicleId ? (
            <p className="text-sm text-[color:var(--color-copy)]">
              Your physical bike is assigned at handover. Insurance, RC, and invoice will show here
              once that is done.
            </p>
          ) : beforePickup && !isWithinRentalWindow({ pickup_at: pickupAt, drop_at: dropAt }) ? (
            <p className="text-sm text-[color:var(--color-copy)]">
              RC, insurance, and invoice unlock at pickup ({pickupLabel}). Your assigned bike is
              ready — documents appear when the rental starts.
            </p>
          ) : (
            <>
              {!hasRc && (reg || chassis) ? (
                <div className="mb-3 text-sm text-[color:var(--color-copy)]">
                  <p className="font-semibold text-[color:var(--color-ink)]">Vehicle reference (RC pending)</p>
                  {reg ? <p>Registration: {reg}</p> : null}
                  {chassis ? <p>Chassis: {chassis}</p> : null}
                </div>
              ) : null}
              {loading ? <p className="text-sm text-[color:var(--color-muted)]">Loading…</p> : null}
              {error ? <p className="text-sm text-red-700">{error}</p> : null}
              {!loading && !error && docs.length === 0 ? (
                <p className="text-sm text-[color:var(--color-muted)]">No documents uploaded yet.</p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="min-w-[180px] rounded-[var(--radius-sm)] border border-[color:var(--color-line)] p-3"
                  >
                    <p className="text-sm font-bold uppercase text-[color:var(--color-ink)]">{doc.doc_type}</p>
                    <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                      {doc.expires_at
                        ? `Expires ${new Date(doc.expires_at).toLocaleDateString("en-IN")}`
                        : "No expiry"}
                    </p>
                    <Link href={doc.file_url} className="btn-primary btn-sm mt-2 inline-block w-full text-center">
                      View
                    </Link>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
