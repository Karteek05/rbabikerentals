import { describe, expect, it } from "vitest";
import {
  buildBookHref,
  resolveBookingScheduleFromParams
} from "@/lib/bookings/schedule";

describe("booking schedule URL helpers", () => {
  it("carries selected schedule and pickup zone into vehicle booking links", () => {
    const params = new URLSearchParams({
      duration: "monthly",
      pickup_at: "2026-06-20T08:00:00.000Z",
      drop_at: "2026-07-20T08:00:00.000Z",
      pickup_location: "Indiranagar"
    });

    expect(buildBookHref("veh_003", params, "rate_per_month")).toBe(
      "/book/veh_003?duration=monthly&pickup_at=2026-06-20T08%3A00%3A00.000Z&drop_at=2026-07-20T08%3A00%3A00.000Z&pickup_location=Indiranagar"
    );
  });

  it("uses the URL pickup and drop times when creating a booking schedule", () => {
    const params = new URLSearchParams({
      pickup_at: "2026-06-20T08:00:00.000Z",
      drop_at: "2026-06-27T08:00:00.000Z",
      pickup_location: "Koramangala"
    });

    const schedule = resolveBookingScheduleFromParams(
      params,
      "rate_per_week",
      new Date("2026-06-15T08:00:00.000Z")
    );

    expect(schedule.pickupAt).toBe("2026-06-20T08:00:00.000Z");
    expect(schedule.dropAt).toBe("2026-06-27T08:00:00.000Z");
    expect(schedule.pickupZone).toBe("Koramangala");
    expect(schedule.usedFallback).toBe(false);
  });

  it("falls back to a valid future window when URL dates are missing or invalid", () => {
    const schedule = resolveBookingScheduleFromParams(
      new URLSearchParams({ pickup_location: "Whitefield" }),
      "rate_per_day",
      new Date("2026-06-15T08:00:00.000Z")
    );

    expect(schedule.pickupAt).toBe("2026-06-15T09:00:00.000Z");
    expect(schedule.dropAt).toBe("2026-06-30T09:00:00.000Z");
    expect(schedule.pickupZone).toBe("Whitefield");
    expect(schedule.usedFallback).toBe(true);
  });
});
