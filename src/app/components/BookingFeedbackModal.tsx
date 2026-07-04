"use client";

import Icon from "@/app/components/Icon";
import Link from "next/link";
import { formatBookingReference } from "@/lib/fleet/display";

type BookingFeedbackModalProps = {
  open: boolean;
  type: "success" | "error";
  title: string;
  message: string;
  bookingId?: string;
  onClose: () => void;
};

export default function BookingFeedbackModal({
  open,
  type,
  title,
  message,
  bookingId,
  onClose
}: BookingFeedbackModalProps) {
  if (!open) return null;

  const isSuccess = type === "success";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-[0_24px_60px_rgba(0,0,0,0.22)]"
      >
        <div className="text-center">
          <div
            className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
              isSuccess ? "bg-black text-white" : "bg-red-100 text-red-700"
            }`}
          >
            <Icon name={isSuccess ? "checkCircle" : "warning"} className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold text-black">{title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-uber-body-gray">{message}</p>
          {bookingId ? (
            <div className="mt-4 rounded-xl bg-uber-chip-gray px-4 py-3 text-sm font-bold text-black">
              {formatBookingReference(bookingId)}
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {isSuccess ? (
            <Link href="/my-bookings" className="btn-primary w-full justify-center">
              View My Bookings
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className={`w-full rounded-full px-5 py-3 text-sm font-bold ${
              isSuccess ? "btn-secondary" : "bg-black text-white hover:bg-[#222]"
            }`}
          >
            {isSuccess ? "Close" : "Try again"}
          </button>
        </div>
      </div>
    </div>
  );
}
