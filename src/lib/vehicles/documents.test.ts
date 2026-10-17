import { afterEach, describe, expect, it } from "vitest";
import {
  CUSTOMER_VEHICLE_DOC_STATUSES,
  assertVehicleDocumentAccess,
  isBookingEligibleForVehicleDocs,
  parseOptionalExpiresAt,
  toClientDocument,
  vehicleDocumentDownloadPath,
  vehicleDocumentViewPath
} from "@/lib/vehicles/documents";
import type { VehicleDocument } from "@/lib/types/domain";
import { store } from "@/lib/data/store";

describe("vehicle documents helpers", () => {
  it("allows document access after payment regardless of rental dates", () => {
    expect(CUSTOMER_VEHICLE_DOC_STATUSES).not.toContain("payment_pending");
    expect(CUSTOMER_VEHICLE_DOC_STATUSES).toContain("completed");
    expect(isBookingEligibleForVehicleDocs({ status: "confirmed" })).toBe(true);
    expect(isBookingEligibleForVehicleDocs({ status: "completed" })).toBe(true);
    expect(isBookingEligibleForVehicleDocs({ status: "payment_pending" })).toBe(false);
  });
  afterEach(() => {
    store.bookings = store.bookings.filter((booking) => booking.id !== "booking_document_access_test");
    store.paymentOrders = store.paymentOrders.filter((order) => order.id !== "payment_document_access_test");
  });

  it("grants the paying customer access before pickup and revokes it after a full refund", async () => {
    const pickup = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const drop = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString();
    const vehicle = { ...store.vehicles[0], id: "veh_document_access_test" };
    const bookingId = "booking_document_access_test";
    store.bookings.push({
      id: bookingId,
      user_id: "cust_001",
      vehicle_id: vehicle.id,
      city: "bengaluru",
      status: "confirmed",
      pickup_at: pickup,
      drop_at: drop,
      quote: {
        base_amount: 100,
        duration_amount: 0,
        addon_amount: 0,
        coupon_discount: 0,
        deposit_amount: 0,
        tax_amount: 0,
        total_payable: 100,
        km_included: 100,
        excess_km_rate: 1
      },
      km_limit_bucket: "day",
      km_limit_value: 100,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    store.paymentOrders.push({
      id: "payment_document_access_test",
      booking_id: bookingId,
      provider: "razorpay",
      provider_order_id: "order_document_access_test",
      amount: 100,
      currency: "INR",
      status: "paid",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    await expect(
      assertVehicleDocumentAccess({ userId: "cust_001", role: "customer" }, vehicle)
    ).resolves.toBeUndefined();

    const payment = store.paymentOrders.find((order) => order.id === "payment_document_access_test");
    if (!payment) throw new Error("test payment fixture missing");
    payment.status = "refunded";
    payment.refunded_amount = 100;
    await expect(
      assertVehicleDocumentAccess({ userId: "cust_001", role: "customer" }, vehicle)
    ).rejects.toMatchObject({ status: 403 });
  });

  it("rejects invalid expires_at values", () => {
    expect(() => parseOptionalExpiresAt("not-a-date")).toThrow(/valid date/i);
    expect(parseOptionalExpiresAt(null)).toBeNull();
    expect(parseOptionalExpiresAt("2026-12-31")).toBeTruthy();
  });

  it("maps customer links to the in-app viewer", () => {
    const doc: VehicleDocument = {
      id: "vdoc_1",
      vehicle_id: "veh_1",
      doc_type: "rc",
      file_url: "https://example.com/rc.pdf",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z"
    };
    expect(toClientDocument("veh_1", doc, { openInViewer: true }).file_url).toBe(
      vehicleDocumentViewPath("veh_1", "vdoc_1")
    );
    expect(toClientDocument("veh_1", doc).file_url).toContain("/file");
    expect(vehicleDocumentDownloadPath("veh_1", "vdoc_1", true)).toBe(
      "/api/vehicles/veh_1/documents/vdoc_1/file?download=1"
    );
  });
});
