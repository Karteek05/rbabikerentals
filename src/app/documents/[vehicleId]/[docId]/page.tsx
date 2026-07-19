"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import PdfViewOnly from "@/components/PdfViewOnly";

type LoadedFile = {
  data: ArrayBuffer;
  mimeType: string;
};

export default function VehicleDocumentViewPage() {
  const params = useParams<{ vehicleId: string; docId: string }>();
  const vehicleId = params.vehicleId;
  const docId = params.docId;
  const src = `/api/vehicles/${vehicleId}/documents/${docId}/file`;
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setFile(null);
    setLoading(true);
    setError("");

    async function loadDocument() {
      try {
        const res = await fetch(src, {
          credentials: "include",
          headers: { "X-RBA-Document-Viewer": "1" }
        });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error?.message ?? "Could not load document.");
        }
        const data = await res.arrayBuffer();
        const mimeType = res.headers.get("content-type") ?? "application/pdf";
        if (cancelled) return;
        setFile({ data, mimeType });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load document.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDocument();
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--color-paper)]">
      <header className="booking-invoice-toolbar flex items-center justify-between gap-3 border-b border-[color:var(--color-line)] bg-white px-4 py-3">
        <Link href="/profile" className="btn-secondary btn-sm inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <p className="text-sm font-semibold text-[color:var(--color-copy)]">View only</p>
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-[color:var(--color-muted)]">
          Loading document…
        </div>
      ) : null}

      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm font-semibold text-red-700">{error}</p>
          <button type="button" className="btn-secondary btn-sm" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      ) : null}

      {file ? <PdfViewOnly data={file.data} mimeType={file.mimeType} /> : null}
    </div>
  );
}
