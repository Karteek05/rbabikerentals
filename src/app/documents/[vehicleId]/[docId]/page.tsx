"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function VehicleDocumentViewPage() {
  const params = useParams<{ vehicleId: string; docId: string }>();
  const vehicleId = params.vehicleId;
  const docId = params.docId;
  const src = `/api/vehicles/${vehicleId}/documents/${docId}/file`;

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--color-paper)]">
      <header className="flex items-center justify-between gap-3 border-b border-[color:var(--color-line)] bg-white px-4 py-3">
        <Link href="/profile" className="btn-secondary btn-sm inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <p className="text-sm font-semibold text-[color:var(--color-copy)]">
          View only — show to authorities if asked
        </p>
      </header>
      <iframe
        title="Vehicle document"
        src={src}
        className="min-h-0 flex-1 w-full border-0"
      />
    </div>
  );
}
