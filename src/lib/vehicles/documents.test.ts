import { describe, expect, it } from "vitest";
import {
  CUSTOMER_VEHICLE_DOC_STATUSES,
  isBookingEligibleForVehicleDocs,
  isBookingStatusEligibleForVehicleDocs,
  isWithinRentalWindow,
  parseOptionalExpiresAt,
  toClientDocument,
  vehicleDocumentViewPath
} from "@/lib/vehicles/documents";
import type { Booking, VehicleDocument } from "@/lib/types/domain";

const baseBooking = {
  status: "confirmed",
  pickup_at: "2026-07-01T00:00:00.000Z",
  drop_at: "2026-07-10T00:00:00.000Z"
} satisfies Pick<Booking, "status" | "pickup_at" | "drop_at">;

describe("vehicle documents helpers", () => {
  it("allows docs only after payment and during the rental window", () => {
    expect(CUSTOMER_VEHICLE_DOC_STATUSES).not.toContain("payment_pending");
    expect(CUSTOMER_VEHICLE_DOC_STATUSES).not.toContain("completed");

    const during = new Date("2026-07-05T12:00:00.000Z");
    expect(isWithinRentalWindow(baseBooking, during)).toBe(true);
    expect(isBookingEligibleForVehicleDocs(baseBooking, during)).toBe(true);

    const after = new Date("2026-07-11T00:00:00.000Z");
    expect(isBookingEligibleForVehicleDocs(baseBooking, after)).toBe(false);

    const unpaid = { ...baseBooking, status: "payment_pending" as const };
    expect(isBookingEligibleForVehicleDocs(unpaid, during)).toBe(false);
    expect(isBookingStatusEligibleForVehicleDocs("confirmed")).toBe(true);
    expect(isBookingStatusEligibleForVehicleDocs("completed")).toBe(false);
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
    expect(toClientDocument("veh_1", doc, { viewOnly: true }).file_url).toBe(
      vehicleDocumentViewPath("veh_1", "vdoc_1")
    );
    expect(toClientDocument("veh_1", doc).file_url).toContain("/file");
  });
});
