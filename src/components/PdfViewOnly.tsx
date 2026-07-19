"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  data: ArrayBuffer;
  mimeType: string;
};

export default function PdfViewOnly({ data, mimeType }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<{ getPage: (n: number) => Promise<unknown> } | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isImage = mimeType.startsWith("image/");

  useEffect(() => {
    if (isImage) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    pdfRef.current = null;
    setPageCount(0);
    setPageNum(1);

    async function loadPdf() {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const pdf = await pdfjs.getDocument({ data: data.slice(0) }).promise;
        if (cancelled) return;
        pdfRef.current = pdf;
        setPageCount(pdf.numPages);
        setPageNum(1);
      } catch {
        if (!cancelled) {
          setError("Could not render this document for view-only display.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPdf();
    return () => {
      cancelled = true;
    };
  }, [data, isImage]);

  useEffect(() => {
    if (isImage || !pdfRef.current || !canvasRef.current || pageCount === 0) return;

    let cancelled = false;

    async function renderPage() {
      const canvas = canvasRef.current;
      const pdf = pdfRef.current;
      if (!canvas || !pdf) return;

      try {
        const page = (await pdf.getPage(pageNum)) as {
          getViewport: (opts: { scale: number }) => { height: number; width: number };
          render: (opts: {
            canvasContext: CanvasRenderingContext2D;
            viewport: { height: number; width: number };
          }) => { promise: Promise<void> };
        };
        const viewport = page.getViewport({ scale: 1.35 });
        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport }).promise;
      } catch {
        if (!cancelled) {
          setError("Could not render this page.");
        }
      }
    }

    void renderPage();
    return () => {
      cancelled = true;
    };
  }, [pageNum, pageCount, isImage]);

  if (isImage) {
    return <ImageViewOnly data={data} mimeType={mimeType} />;
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-[color:var(--color-muted)]">
        Preparing document…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm font-semibold text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="pdf-view-only flex min-h-0 flex-1 flex-col" onContextMenu={(event) => event.preventDefault()}>
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--color-line)] bg-white px-4 py-2">
        <button
          type="button"
          className="btn-secondary btn-sm inline-flex items-center gap-1"
          disabled={pageNum <= 1}
          onClick={() => setPageNum((current) => Math.max(1, current - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>
        <p className="text-sm font-semibold text-[color:var(--color-ink)]">
          Page {pageNum} of {pageCount}
        </p>
        <button
          type="button"
          className="btn-secondary btn-sm inline-flex items-center gap-1"
          disabled={pageNum >= pageCount}
          onClick={() => setPageNum((current) => Math.min(pageCount, current + 1))}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-1 justify-center overflow-auto bg-[color:var(--color-paper-2)] p-4">
        <canvas ref={canvasRef} className="max-w-full bg-white shadow-sm" />
      </div>
    </div>
  );
}

function ImageViewOnly({ data, mimeType }: { data: ArrayBuffer; mimeType: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const blob = new Blob([data], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);
    setSrc(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [data, mimeType]);

  if (!src) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-[color:var(--color-muted)]">
        Preparing document…
      </div>
    );
  }

  return (
    <div
      className="pdf-view-only flex flex-1 items-center justify-center overflow-auto p-4"
      onContextMenu={(event) => event.preventDefault()}
    >
      <img
        src={src}
        alt="Vehicle document"
        className="max-h-full max-w-full object-contain"
        draggable={false}
      />
    </div>
  );
}
