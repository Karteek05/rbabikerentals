import { describe, expect, it } from "vitest";
import { buildBookingInvoice, formatInvoiceNumber } from "@/lib/invoices/build-invoice";
import type { Booking, User } from "@/lib/types/domain";

const user: User = {
  id: "user_1",
  name: "Test Rider",
  role: "customer",
  city: "bengaluru",
  kyc_status: "verified",
  email: "rider@example.com",
  phone: "9876543210"
};

const booking: Booking = {
  id: "booking_34427768abcd",
  user_id: "user_1",
  vehicle_id: "veh_001",
  city: "bengaluru",
  status: "confirmed",
  pickup_at: "2026-07-20T00:30:00.000Z",
  drop_at: "2026-07-27T00:30:00.000Z",
  pickup_zone: "Sarjapur Road",
  quote: {
    base_amount: 1600,
    vehicle_rental_cost: 1600,
    duration_amount: 1600,
    addon_amount: 0,
    coupon_discount: 0,
    deposit_amount: 2000,
    cgst_amount: 122,
    sgst_amount: 122,
    tax_amount: 244,
    total_cost: 1600,
    total_payable: 3600,
    km_included: 900,
    excess_km_rate: 5
  },
  km_limit_bucket: "week",
  km_limit_value: 900,
  created_at: "2026-07-19T12:00:00.000Z",
  updated_at: "2026-07-19T13:00:00.000Z"
};

describe("booking invoice", () => {
  it("formats invoice number from booking reference", () => {
    expect(formatInvoiceNumber(booking.id)).toBe("INV-RBA-34427768");
  });

  it("includes payment and vehicle fields", () => {
    const invoice = buildBookingInvoice({
      booking,
      user,
      payment: {
        id: "payorder_1",
        booking_id: booking.id,
        provider: "razorpay",
        provider_order_id: "order_test_1",
        provider_payment_id: "pay_test_1",
        amount: 3600,
        currency: "INR",
        status: "paid",
        created_at: "2026-07-19T13:00:00.000Z",
        updated_at: "2026-07-19T13:00:00.000Z"
      }
    });

    expect(invoice.payment_status).toBe("paid");
    expect(invoice.payment_id).toBe("pay_test_1");
    expect(invoice.vehicle.catalog_id).toBe("veh_001");
    expect(invoice.total_payable).toBe(3600);
    expect(invoice.customer.name).toBe("Test Rider");
  });
});
