"use client";

import { useParams } from "next/navigation";
import { BookingInvoiceLoader } from "@/components/BookingInvoice";

export default function BookingInvoicePage() {
  const params = useParams<{ id: string }>();
  return <BookingInvoiceLoader bookingId={params.id} />;
}
