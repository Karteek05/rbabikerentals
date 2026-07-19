"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import type { BookingInvoice } from "@/lib/invoices/build-invoice";

function rupees(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata"
  });
}

type Props = {
  invoice: BookingInvoice;
  backHref?: string;
  showActions?: boolean;
};

export default function BookingInvoiceView({
  invoice,
  backHref = "/my-bookings",
  showActions = true
}: Props) {
  return (
    <div className="booking-invoice-shell min-h-screen bg-[color:var(--color-paper)]">
      {showActions ? (
        <header className="booking-invoice-toolbar flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-line)] bg-white px-4 py-3">
          <Link href={backHref} className="btn-secondary btn-sm inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <button
            type="button"
            className="btn-primary btn-sm inline-flex items-center gap-2"
            onClick={() => window.print()}
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
        </header>
      ) : null}

      <article className="booking-invoice mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="booking-invoice-card rounded-[var(--radius-lg)] border border-[color:var(--color-line)] bg-white p-6 sm:p-8">
          <div className="flex flex-col gap-6 border-b border-[color:var(--color-line)] pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-muted)]">
                Tax invoice / receipt
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-[color:var(--color-ink)]">
                {invoice.company.brand}
              </h1>
              <p className="mt-1 text-sm text-[color:var(--color-copy)]">
                {invoice.company.city}, {invoice.company.state}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--color-muted)]">
                Receipt no.
              </p>
              <p className="mt-1 font-mono text-sm font-bold text-[color:var(--color-ink)]">
                {invoice.invoice_number}
              </p>
              <span className="mt-3 inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-800">
                {invoice.payment_status}
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <section>
              <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--color-muted)]">
                Billed to
              </p>
              <p className="mt-2 font-semibold text-[color:var(--color-ink)]">{invoice.customer.name}</p>
              {invoice.customer.email ? (
                <p className="mt-1 text-sm text-[color:var(--color-copy)]">{invoice.customer.email}</p>
              ) : null}
              {invoice.customer.phone ? (
                <p className="mt-1 text-sm text-[color:var(--color-copy)]">{invoice.customer.phone}</p>
              ) : null}
            </section>
            <section className="sm:text-right">
              <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--color-muted)]">
                Booking & payment
              </p>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between gap-4 sm:justify-end">
                  <dt className="text-[color:var(--color-muted)]">Booking ref</dt>
                  <dd className="font-semibold text-[color:var(--color-ink)]">{invoice.booking_reference}</dd>
                </div>
                <div className="flex justify-between gap-4 sm:justify-end">
                  <dt className="text-[color:var(--color-muted)]">Booking ID</dt>
                  <dd className="font-mono text-xs font-semibold text-[color:var(--color-ink)]">
                    {invoice.booking_id}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 sm:justify-end">
                  <dt className="text-[color:var(--color-muted)]">Paid on</dt>
                  <dd className="font-semibold text-[color:var(--color-ink)]">
                    {invoice.paid_at ? formatWhen(invoice.paid_at) : "—"}
                  </dd>
                </div>
                {invoice.payment_id ? (
                  <div className="flex justify-between gap-4 sm:justify-end">
                    <dt className="text-[color:var(--color-muted)]">Payment ID</dt>
                    <dd className="font-mono text-xs font-semibold text-[color:var(--color-ink)]">
                      {invoice.payment_id}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>
          </div>

          <section className="mt-8 rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--color-muted)]">
              Vehicle
            </p>
            <p className="mt-2 text-lg font-bold text-[color:var(--color-ink)]">{invoice.vehicle.name}</p>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <p>
                <span className="text-[color:var(--color-muted)]">Catalog ID: </span>
                <span className="font-semibold text-[color:var(--color-ink)]">{invoice.vehicle.catalog_id}</span>
              </p>
              {invoice.vehicle.assigned_vehicle_id ? (
                <p>
                  <span className="text-[color:var(--color-muted)]">Assigned unit: </span>
                  <span className="font-mono text-xs font-semibold text-[color:var(--color-ink)]">
                    {invoice.vehicle.assigned_vehicle_id}
                  </span>
                </p>
              ) : null}
              <p>
                <span className="text-[color:var(--color-muted)]">Pickup: </span>
                <span className="font-semibold text-[color:var(--color-ink)]">
                  {formatWhen(invoice.pickup_at)}
                </span>
              </p>
              <p>
                <span className="text-[color:var(--color-muted)]">Drop: </span>
                <span className="font-semibold text-[color:var(--color-ink)]">
                  {formatWhen(invoice.drop_at)}
                </span>
              </p>
              {invoice.pickup_zone ? (
                <p className="sm:col-span-2">
                  <span className="text-[color:var(--color-muted)]">Pickup zone: </span>
                  <span className="font-semibold text-[color:var(--color-ink)]">{invoice.pickup_zone}</span>
                </p>
              ) : null}
            </div>
          </section>

          <div className="mt-8 overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)]">
            <table className="w-full text-sm">
              <thead className="bg-[color:var(--color-paper)] text-left text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 font-bold">Description</th>
                  <th className="px-4 py-3 text-right font-bold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((line) => (
                  <tr key={line.label} className="border-t border-[color:var(--color-line)]">
                    <td className="px-4 py-3 text-[color:var(--color-copy)]">{line.label}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[color:var(--color-ink)]">
                      {rupees(line.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-[color:var(--color-line)] bg-[color:var(--color-paper)]">
                <tr>
                  <td className="px-4 py-4 text-sm font-bold text-[color:var(--color-ink)]">Total payable</td>
                  <td className="px-4 py-4 text-right text-lg font-black text-[color:var(--color-ink)]">
                    {rupees(invoice.total_payable)}
                  </td>
                </tr>
                <tr className="border-t border-[color:var(--color-line)]">
                  <td className="px-4 py-3 text-sm font-bold text-[color:var(--color-ink)]">Amount paid</td>
                  <td className="px-4 py-3 text-right font-bold text-green-700">
                    {rupees(invoice.amount_paid)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="mt-4 text-xs text-[color:var(--color-muted)]">
            Includes {invoice.km_included} km · ₹{invoice.excess_km_rate}/km extra. GST is included in rental
            fares as per vehicle fare rules. Security deposit is refundable subject to handover inspection.
          </p>

          <footer className="mt-8 border-t border-[color:var(--color-line)] pt-4 text-xs text-[color:var(--color-muted)]">
            <p>
              Issued {formatWhen(invoice.issued_at)} · {invoice.company.supportEmail} ·{" "}
              {invoice.company.website}
            </p>
            <p className="mt-1">Booking status: {invoice.booking_status}</p>
          </footer>
        </div>
      </article>
    </div>
  );
}

export function BookingInvoiceLoader({ bookingId, backHref }: { bookingId: string; backHref?: string }) {
  const [invoice, setInvoice] = useState<BookingInvoice | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/bookings/${bookingId}/invoice`, { credentials: "include" })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.ok || !json.data?.invoice) {
          setError(json?.error?.message ?? "Could not load invoice.");
          return;
        }
        setInvoice(json.data.invoice as BookingInvoice);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load invoice.");
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-semibold text-red-800">{error}</p>
          <Link href={backHref ?? "/my-bookings"} className="btn-secondary btn-sm mt-4 inline-flex">
            Back to bookings
          </Link>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-sm text-[color:var(--color-muted)]">
        Loading invoice…
      </div>
    );
  }

  return <BookingInvoiceView invoice={invoice} backHref={backHref} />;
}
