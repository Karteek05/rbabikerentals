import { assertCanTransition } from "@/lib/bookings/state-machine";
import { advanceBookingLifecycleIfDue } from "@/lib/bookings/lifecycle";
import { recordAudit } from "@/lib/audit/service";
import { getSupabaseServiceClient } from "@/lib/db/supabase-client";
import { sendBookingConfirmationEmail } from "@/lib/notifications/service";
import { insertBookingWithCapacityGuard } from "@/lib/bookings/inventory-guard";
import {
  assertBengaluruCity,
  getBookingOrThrow,
  getLatestPaymentOrderForBooking,
  getUserOrThrow,
  getVehicleOrThrow,
  insertDamageIncident,
  insertPaymentOrder,
  insertVehicleBlock,
  listBookings,
  listVehicleBlocks,
  updateBooking,
  updatePaymentOrderByProviderId
} from "@/lib/data/repository";
import { createRazorpayOrder, isRazorpayConfigured } from "@/lib/integrations/razorpay";
import { refundBookingAmount } from "@/lib/payments/service";
import { isVehicleAvailableForWindow } from "@/lib/fleet/availability";
import {
  computeCancellationBreakup,
  computePricingQuote,
  mergePricingQuotes,
  resolveDurationValueFromWindow
} from "@/lib/pricing/engine";
import type {
  CancelBookingRequest,
  CreateBookingRequest,
  ExtendBookingRequest,
  QuoteRequest
} from "@/lib/types/contracts";
import type { Booking, PricingQuote, Role } from "@/lib/types/domain";
import { ApiException } from "@/lib/utils/errors";
import { newId } from "@/lib/utils/ids";

export async function createBooking(
  input: CreateBookingRequest,
  actor: { userId: string; role: Role }
) {
  assertBengaluruCity(input.city);

  if (actor.role !== "customer" && actor.role !== "admin") {
    throw new ApiException(403, "forbidden", "Only customer or admin can create booking.");
  }
  if (actor.role === "customer" && actor.userId !== input.user_id) {
    throw new ApiException(403, "forbidden", "Customer can create booking only for self.");
  }

  const user = await getUserOrThrow(input.user_id);
  const vehicle = await getVehicleOrThrow(input.vehicle_id);
  const pickupTs = new Date(input.pickup_at).getTime();
  const dropTs = new Date(input.drop_at).getTime();

  if (!Number.isFinite(pickupTs) || !Number.isFinite(dropTs) || pickupTs >= dropTs) {
    throw new ApiException(
      400,
      "invalid_booking_window",
      "Pickup time must be before drop time."
    );
  }

  if (vehicle.city !== "bengaluru") {
    throw new ApiException(
      400,
      "unsupported_city",
      "Vehicle is not available in Bengaluru."
    );
  }

  const resolvedDurationValue = resolveDurationValueFromWindow({
    duration_bucket: input.duration_bucket,
    start_at: input.pickup_at,
    end_at: input.drop_at
  });

  const quoteInput: QuoteRequest = {
    user_id: input.user_id,
    vehicle_id: input.vehicle_id,
    city: input.city,
    duration_bucket: input.duration_bucket,
    duration_value: resolvedDurationValue,
    extra_helmet_count: input.extra_helmet_count,
    coupon_code: input.coupon_code
  };
  const quote = await computePricingQuote(quoteInput);
  const now = new Date().toISOString();

  if (await isVehicleBlockedDuring(input.vehicle_id, input.pickup_at, input.drop_at)) {
    throw new ApiException(
      409,
      "vehicle_blocked",
      "Vehicle has a maintenance/block window in requested time."
    );
  }
  if (
    !(await isVehicleAvailableForWindow(
      input.vehicle_id,
      input.pickup_at,
      input.drop_at
    ))
  ) {
    throw new ApiException(
      409,
      "vehicle_unavailable",
      "Vehicle has no free units left for the requested time."
    );
  }

  const booking = await insertBookingWithCapacityGuard({
    id: newId("booking"),
    user_id: input.user_id,
    vehicle_id: input.vehicle_id,
    city: "bengaluru",
    status: "admin_review",
    pickup_at: input.pickup_at,
    drop_at: input.drop_at,
    pickup_zone: input.pickup_zone,
    pickup_address: input.pickup_address,
    quote,
    coupon_code: input.coupon_code,
    km_limit_bucket: input.km_limit_bucket,
    km_limit_value: input.km_limit_value,
    created_at: now,
    updated_at: now
  });

  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "booking.create",
    resourceType: "booking",
    resourceId: booking.id,
    metadata: {
      user_id: user.id,
      vehicle_id: vehicle.id,
      initial_status: booking.status
    }
  });

  try {
    const supabase = getSupabaseServiceClient();
    const { data: authUser } = await supabase.from("user").select("email").eq("id", user.id).single();
    if (authUser?.email) {
      await sendBookingConfirmationEmail(authUser.email, booking);
    }
  } catch (e) {
    console.error("Failed to send booking confirmation email:", e);
  }

  return {
    ...booking,
    payment_order: null
  };
}

export async function extendBooking(
  bookingId: string,
  input: ExtendBookingRequest,
  actor: { userId: string; role: Role }
) {
  let booking = await getBookingOrThrow(bookingId);
  const ownerAllowed = actor.role === "customer" && booking.user_id === actor.userId;
  if (!ownerAllowed && actor.role !== "admin") {
    throw new ApiException(403, "forbidden", "Not allowed to extend this booking.");
  }

  if (booking.status === "confirmed") {
    const advanced = await advanceBookingLifecycleIfDue(booking);
    if (advanced.status !== booking.status) {
      booking = advanced;
    }
  }

  const extendableStatuses = new Set(["ongoing", "extended"]);
  if (!extendableStatuses.has(booking.status)) {
    throw new ApiException(
      409,
      "invalid_state",
      "Booking can be extended only once the ride has started (ongoing or extended status)."
    );
  }

  if (new Date(input.requested_drop_at).getTime() <= new Date(booking.drop_at).getTime()) {
    throw new ApiException(
      400,
      "invalid_extension_time",
      "Extended drop time must be after current drop time."
    );
  }

  if (
    await isVehicleBlockedDuring(
      booking.vehicle_id,
      booking.drop_at,
      input.requested_drop_at
    )
  ) {
    throw new ApiException(
      409,
      "vehicle_blocked",
      "Vehicle has a block or maintenance window for requested extension."
    );
  }
  if (
    !(await isVehicleAvailableForWindow(
      booking.vehicle_id,
      booking.drop_at,
      input.requested_drop_at,
      { ignoreBookingId: booking.id }
    ))
  ) {
    throw new ApiException(
      409,
      "vehicle_unavailable",
      "Vehicle has another booking in requested extension period."
    );
  }

  const resolvedExtensionDurationValue = resolveDurationValueFromWindow({
    duration_bucket: input.duration_bucket,
    start_at: booking.drop_at,
    end_at: input.requested_drop_at
  });

  const additionalQuote = await computePricingQuote({
    user_id: booking.user_id,
    vehicle_id: booking.vehicle_id,
    city: booking.city,
    duration_bucket: input.duration_bucket,
    duration_value: resolvedExtensionDurationValue
  });

  const extensionQuote: PricingQuote = {
    ...additionalQuote,
    deposit_amount: 0,
    total_payable: additionalQuote.total_cost ?? additionalQuote.total_payable
  };

  const extensionAmountPaise = extensionQuote.total_payable * 100;
  let paymentOrder: Awaited<ReturnType<typeof createRazorpayOrder>> | null = null;

  if (extensionAmountPaise > 0 && !isRazorpayConfigured()) {
    throw new ApiException(
      503,
      "payment_unavailable",
      "Extension payment is unavailable right now. Please contact support."
    );
  }

  const requiresPayment = isRazorpayConfigured() && extensionAmountPaise > 0;

  if (requiresPayment) {
    assertCanTransition(booking.status, "extension_requested", "booking.extend.request");

    let createdOrder: Awaited<ReturnType<typeof createRazorpayOrder>>;
    try {
      createdOrder = await createRazorpayOrder({
        amountInPaise: extensionAmountPaise,
        receipt: `ext_${booking.id}`
      });
      await insertPaymentOrder({
        id: newId("pay_order"),
        booking_id: booking.id,
        provider: "razorpay",
        provider_order_id: createdOrder.order_id,
        amount: createdOrder.amount,
        currency: "INR",
        status: "created",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      throw error;
    }

    let updated: Booking;
    try {
      updated = await updateBooking(booking.id, {
        status: "extension_requested",
        requested_drop_at: input.requested_drop_at,
        updated_at: new Date().toISOString()
      });

      await recordAudit({
        actorId: actor.userId,
        actorRole: actor.role,
        action: "booking.extension_pending",
        resourceType: "booking",
        resourceId: booking.id,
        metadata: {
          requested_drop_at: input.requested_drop_at,
          additional_payable: extensionQuote.total_payable,
          extension_quote: extensionQuote
        }
      });
    } catch (error) {
      await updatePaymentOrderByProviderId(createdOrder.order_id, {
        status: "failed",
        updated_at: new Date().toISOString()
      });
      throw error;
    }

    paymentOrder = createdOrder;

    await recordAudit({
      actorId: actor.userId,
      actorRole: actor.role,
      action: "booking.extend",
      resourceType: "booking",
      resourceId: booking.id,
      metadata: {
        requested_drop_at: input.requested_drop_at,
        additional_payable: extensionQuote.total_payable
      }
    });

    return {
      booking_id: updated.id,
      status: updated.status,
      additional_quote: extensionQuote,
      payment_order: paymentOrder
    };
  }

  assertCanTransition(booking.status, "extension_requested", "booking.extend.request");
  await updateBooking(booking.id, {
    status: "extension_requested",
    requested_drop_at: input.requested_drop_at,
    updated_at: new Date().toISOString()
  });

  assertCanTransition("extension_requested", "extended", "booking.extend.confirm");
  const updated = await updateBooking(booking.id, {
    status: "extended",
    drop_at: input.requested_drop_at,
    requested_drop_at: null,
    quote: mergePricingQuotes(booking.quote, extensionQuote),
    updated_at: new Date().toISOString()
  });

  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "booking.extend",
    resourceType: "booking",
    resourceId: booking.id,
    metadata: {
      requested_drop_at: input.requested_drop_at,
      additional_payable: extensionQuote.total_payable,
      payment_bypassed: true
    }
  });

  return {
    booking_id: updated.id,
    status: updated.status,
    additional_quote: extensionQuote,
    payment_order: null
  };
}

export async function cancelBooking(
  bookingId: string,
  input: CancelBookingRequest,
  actor: { userId: string; role: Role }
) {
  const booking = await getBookingOrThrow(bookingId);
  const ownerAllowed = actor.role === "customer" && booking.user_id === actor.userId;
  if (!ownerAllowed && actor.role !== "admin") {
    throw new ApiException(403, "forbidden", "Not allowed to cancel this booking.");
  }

  const cancellableStates = new Set([
    "pending_kyc",
    "admin_review",
    "payment_pending",
    "confirmed",
    "ongoing",
    "extended",
    "extension_requested"
  ]);
  if (!cancellableStates.has(booking.status)) {
    throw new ApiException(
      409,
      "invalid_state",
      `Cannot cancel booking from status ${booking.status}.`
    );
  }

  assertCanTransition(booking.status, "cancelled", "booking.cancel");
  const breakup = computeCancellationBreakup({
    totalPayable: booking.quote.total_payable,
    pickupAt: booking.pickup_at
  });

  const updated = await updateBooking(booking.id, {
    status: "cancelled",
    cancel_reason: input.reason,
    requested_drop_at: null,
    updated_at: new Date().toISOString()
  });

  let refundIssued = false;
  if (breakup.refund_amount > 0) {
    try {
      await refundBookingAmount({
        bookingId: booking.id,
        amountInPaise: breakup.refund_amount * 100,
        reason: input.reason
      });
      refundIssued = true;
    } catch (error) {
      console.error("Failed to issue cancellation refund:", error);
    }
  }

  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "booking.cancel",
    resourceType: "booking",
    resourceId: booking.id,
    metadata: {
      reason: input.reason,
      cancellation_charge: breakup.cancellation_charge,
      refund_amount: breakup.refund_amount,
      refund_issued: refundIssued
    }
  });

  return {
    booking_id: updated.id,
    status: updated.status,
    cancellation_charge: breakup.cancellation_charge,
    refund_amount: breakup.refund_amount,
    charge_rate: breakup.charge_rate,
    refund_issued: refundIssued
  };
}

export async function reportDamageIncident(input: {
  bookingId: string;
  actorId: string;
  actorRole: Role;
  description: string;
  photoUrls: string[];
}) {
  const booking = await getBookingOrThrow(input.bookingId);
  if (
    input.actorRole === "customer" &&
    booking.user_id !== input.actorId
  ) {
    throw new ApiException(403, "forbidden", "Customer can report only own booking incident.");
  }

  const incident = await insertDamageIncident({
    id: newId("incident"),
    booking_id: booking.id,
    vehicle_id: booking.vehicle_id,
    reported_by: input.actorId,
    description: input.description,
    photo_urls: input.photoUrls,
    created_at: new Date().toISOString()
  });

  // Auto-block for 24h pending review.
  await insertVehicleBlock({
    id: newId("block"),
    vehicle_id: booking.vehicle_id,
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    reason: "auto_block_damage_incident",
    created_by: input.actorId,
    created_at: new Date().toISOString()
  });

  await recordAudit({
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: "booking.damage_report",
    resourceType: "booking",
    resourceId: booking.id,
    metadata: { incident_id: incident.id }
  });

  return incident;
}

async function isVehicleBlockedDuring(
  vehicleId: string,
  windowStart: string,
  windowEnd: string
) {
  const start = new Date(windowStart).getTime();
  const end = new Date(windowEnd).getTime();
  const blocks = await listVehicleBlocks(vehicleId);

  return blocks.some((block) => {
    const blockStart = new Date(block.starts_at).getTime();
    const blockEnd = new Date(block.ends_at).getTime();
    return start < blockEnd && end > blockStart;
  });
}
