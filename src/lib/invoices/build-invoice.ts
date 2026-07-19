import { formatBookingReference, getVehicleDisplayName } from "@/lib/fleet/display";
import { COMPANY } from "@/lib/legal/company";
import type { Booking, PaymentOrder, PricingQuote, User } from "@/lib/types/domain";

export type InvoiceLine = {
  label: string;
  amount: number;
};

export type BookingInvoice = {
  invoice_number: string;
  booking_id: string;
  booking_reference: string;
  payment_status: "paid";
  payment_id: string | null;
  payment_order_id: string | null;
  paid_at: string | null;
  booking_status: string;
  customer: {
    name: string;
    email?: string | null;
    phone?: string | null;
  };
  vehicle: {
    catalog_id: string;
    name: string;
    assigned_vehicle_id?: string | null;
  };
  pickup_at: string;
  drop_at: string;
  pickup_zone?: string | null;
  lines: InvoiceLine[];
  total_payable: number;
  amount_paid: number;
  deposit_amount: number;
  km_included: number;
  excess_km_rate: number;
  issued_at: string;
  company: typeof COMPANY;
};

export function formatInvoiceNumber(bookingId: string) {
  return `INV-${formatBookingReference(bookingId)}`;
}

function quoteLines(quote: PricingQuote): InvoiceLine[] {
  const vehicleRental = quote.vehicle_rental_cost ?? quote.base_amount ?? 0;
  const cgst = quote.cgst_amount ?? Math.round((quote.tax_amount ?? 0) / 2);
  const sgst = quote.sgst_amount ?? (quote.tax_amount ?? 0) - cgst;
  const totalCost = quote.total_cost ?? quote.total_payable - (quote.deposit_amount ?? 0);

  const lines: InvoiceLine[] = [{ label: "Vehicle rental", amount: vehicleRental }];
  if ((quote.plan_discount ?? 0) > 0) {
    lines.push({ label: "Plan discount", amount: -quote.plan_discount! });
  }
  if (quote.coupon_discount > 0) {
    lines.push({ label: "Coupon discount", amount: -quote.coupon_discount });
  }
  if (quote.addon_amount > 0) {
    lines.push({ label: "Add-ons", amount: quote.addon_amount });
  }
  lines.push({ label: "CGST (9% included)", amount: cgst });
  lines.push({ label: "SGST (9% included)", amount: sgst });
  lines.push({ label: "Rental subtotal", amount: totalCost });
  if (quote.deposit_amount > 0) {
    lines.push({ label: "Security deposit (refundable)", amount: quote.deposit_amount });
  }
  return lines;
}

export function buildBookingInvoice(input: {
  booking: Booking;
  user: User;
  payment: PaymentOrder | null;
  issuedAt?: string;
}): BookingInvoice {
  const { booking, user, payment } = input;
  const quote = booking.quote;

  return {
    invoice_number: formatInvoiceNumber(booking.id),
    booking_id: booking.id,
    booking_reference: formatBookingReference(booking.id),
    payment_status: "paid",
    payment_id: payment?.provider_payment_id ?? null,
    payment_order_id: payment?.provider_order_id ?? null,
    paid_at: payment?.updated_at ?? booking.updated_at,
    booking_status: booking.status,
    customer: {
      name: user.name,
      email: user.email,
      phone: user.phone
    },
    vehicle: {
      catalog_id: booking.vehicle_id,
      name: getVehicleDisplayName(booking.vehicle_id),
      assigned_vehicle_id: booking.assigned_vehicle_id ?? null
    },
    pickup_at: booking.pickup_at,
    drop_at: booking.drop_at,
    pickup_zone: booking.pickup_zone,
    lines: quoteLines(quote),
    total_payable: quote.total_payable,
    amount_paid: quote.total_payable,
    deposit_amount: quote.deposit_amount ?? 0,
    km_included: quote.km_included,
    excess_km_rate: quote.excess_km_rate,
    issued_at: input.issuedAt ?? new Date().toISOString(),
    company: COMPANY
  };
}
