import { assertCanTransition } from "@/lib/bookings/state-machine";
import { recordAudit } from "@/lib/audit/service";
import {
  getBookingOrThrow,
  getOpenPaymentOrderForBooking,
  listBookings,
  updateBookingIfStatus,
  updatePaymentOrderByProviderId
} from "@/lib/data/repository";
import type { Booking, Role } from "@/lib/types/domain";
import { ApiException } from "@/lib/utils/errors";

const LIFECYCLE_STATUSES = new Set<Booking["status"]>([
  "confirmed",
  "ongoing",
  "extended",
  "extension_requested"
]);

export async function startBooking(
  bookingId: string,
  actor: { userId: string; role: Role }
) {
  if (actor.role !== "admin") {
    throw new ApiException(403, "forbidden", "Only admin can start a booking.");
  }

  const booking = await getBookingOrThrow(bookingId);
  const startable = new Set<Booking["status"]>(["confirmed", "extended", "extension_requested"]);
  if (!startable.has(booking.status)) {
    throw new ApiException(
      409,
      "invalid_state",
      `Cannot start booking from status ${booking.status}.`
    );
  }

  assertCanTransition(booking.status, "ongoing", "booking.start");

  if (booking.status === "extension_requested") {
    const openOrder = await getOpenPaymentOrderForBooking(booking.id);
    if (openOrder) {
      await updatePaymentOrderByProviderId(openOrder.provider_order_id, {
        status: "failed",
        updated_at: new Date().toISOString()
      });
    }
  }

  const updated = await updateBookingIfStatus(booking.id, booking.status, {
    status: "ongoing",
    requested_drop_at: null,
    updated_at: new Date().toISOString()
  });
  if (!updated) {
    throw new ApiException(409, "booking_state_changed", "Booking status changed before start could be applied.");
  }

  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "booking.start",
    resourceType: "booking",
    resourceId: booking.id,
    metadata: { previous_status: booking.status }
  });

  return updated;
}

export async function completeBooking(
  bookingId: string,
  actor: { userId: string; role: Role }
) {
  if (actor.role !== "admin") {
    throw new ApiException(403, "forbidden", "Only admin can complete a booking.");
  }

  const booking = await getBookingOrThrow(bookingId);
  const completable = new Set<Booking["status"]>(["ongoing", "extended"]);
  if (!completable.has(booking.status)) {
    throw new ApiException(
      409,
      "invalid_state",
      `Cannot complete booking from status ${booking.status}.`
    );
  }

  assertCanTransition(booking.status, "completed", "booking.complete");
  const updated = await updateBookingIfStatus(booking.id, booking.status, {
    status: "completed",
    requested_drop_at: null,
    updated_at: new Date().toISOString()
  });
  if (!updated) {
    throw new ApiException(
      409,
      "booking_state_changed",
      "Booking status changed before completion could be applied."
    );
  }

  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "booking.complete",
    resourceType: "booking",
    resourceId: booking.id,
    metadata: { previous_status: booking.status }
  });

  return updated;
}

export async function advanceBookingLifecycleIfDue(booking: Booking): Promise<Booking> {
  const now = Date.now();

  if (booking.status === "extension_requested") {
    const pickupTs = new Date(booking.pickup_at).getTime();
    if (Number.isFinite(pickupTs) && pickupTs <= now) {
      const openOrder = await getOpenPaymentOrderForBooking(booking.id);
      if (openOrder) {
        await updatePaymentOrderByProviderId(openOrder.provider_order_id, {
          status: "failed",
          updated_at: new Date().toISOString()
        });
      }

      const updated = await updateBookingIfStatus(booking.id, "extension_requested", {
        status: "ongoing",
        requested_drop_at: null,
        updated_at: new Date().toISOString()
      });
      if (updated) {
        return updated;
      }
    }
  }

  if (booking.status === "confirmed") {
    const pickupTs = new Date(booking.pickup_at).getTime();
    if (Number.isFinite(pickupTs) && pickupTs <= now) {
      const updated = await updateBookingIfStatus(booking.id, "confirmed", {
        status: "ongoing",
        updated_at: new Date().toISOString()
      });
      if (updated) {
        return updated;
      }
    }
  }

  if (booking.status === "ongoing" || booking.status === "extended") {
    const dropTs = new Date(booking.drop_at).getTime();
    if (Number.isFinite(dropTs) && dropTs <= now) {
      const updated = await updateBookingIfStatus(booking.id, booking.status, {
        status: "completed",
        requested_drop_at: null,
        updated_at: new Date().toISOString()
      });
      if (updated) {
        return updated;
      }
    }
  }

  return booking;
}

export async function runBookingLifecycleJob() {
  const bookings = await listBookings({ excludeStatuses: ["cancelled", "completed"] });
  const candidates = bookings.filter((booking) => LIFECYCLE_STATUSES.has(booking.status));

  let started = 0;
  let completed = 0;

  for (const booking of candidates) {
    const before = booking.status;
    const after = await advanceBookingLifecycleIfDue(booking);
    if (before === "confirmed" && after.status === "ongoing") {
      started += 1;
    }
    if ((before === "ongoing" || before === "extended") && after.status === "completed") {
      completed += 1;
    }
  }

  return {
    scanned: candidates.length,
    started,
    completed
  };
}
