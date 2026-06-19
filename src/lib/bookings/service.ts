import { assertCanTransition } from "@/lib/bookings/state-machine";
import { recordAudit } from "@/lib/audit/service";
import { getSupabaseServiceClient } from "@/lib/db/supabase-client";
import { sendBookingConfirmationEmail, sendBookingApprovedEmail, sendBookingRejectedEmail } from "@/lib/notifications/service";
import {
  assertBengaluruCity,
  getBookingOrThrow,
  getKycRecordOrThrow,
  getUserOrThrow,
  getVehicleOrThrow,
  insertBooking,
  insertDamageIncident,
  insertPaymentOrder,
  insertVehicleBlock,
  listBookings,
  listVehicleBlocks,
  upsertKycRecord,
  updateBooking
} from "@/lib/data/repository";
import { createRazorpayOrder, createRazorpayPaymentLink } from "@/lib/integrations/razorpay";
import {
  computeCancellationBreakup,
  computePricingQuote,
  resolveDurationValueFromWindow
} from "@/lib/pricing/engine";
import type {
  CancelBookingRequest,
  CreateBookingRequest,
  ExtendBookingRequest,
  QuoteRequest
} from "@/lib/types/contracts";
import type { KycRecord, PricingQuote, Role } from "@/lib/types/domain";
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
  let kyc: KycRecord;
  try {
    kyc = await getKycRecordOrThrow(input.user_id);
  } catch (error) {
    if (!(error instanceof ApiException) || error.code !== "kyc_not_found") {
      throw error;
    }
    kyc = await upsertKycRecord({
      user_id: input.user_id,
      status: "not_started",
      provider: "setu_digilocker",
      aadhaar_verified: false,
      dl_verified: false,
      needs_manual_review: false,
      updated_at: new Date().toISOString()
    });
  }
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
    await hasVehicleBookingOverlap(input.vehicle_id, input.pickup_at, input.drop_at)
  ) {
    throw new ApiException(
      409,
      "vehicle_unavailable",
      "Vehicle is already booked for requested time."
    );
  }

  const booking = await insertBooking({
    id: newId("booking"),
    user_id: input.user_id,
    vehicle_id: input.vehicle_id,
    city: "bengaluru",
    status:
      kyc.status === "verified" ? ("payment_pending" as const) : ("pending_kyc" as const),
    pickup_at: input.pickup_at,
    drop_at: input.drop_at,
    quote,
    coupon_code: input.coupon_code,
    km_limit_bucket: input.km_limit_bucket,
    km_limit_value: input.km_limit_value,
    created_at: now,
    updated_at: now
  });

  let paymentOrder: Awaited<ReturnType<typeof createRazorpayOrder>> | null = null;

  if (booking.status === "payment_pending") {
    try {
      const createdOrder = await createRazorpayOrder({
        amountInPaise: booking.quote.total_payable * 100,
        receipt: booking.id
      });
      paymentOrder = createdOrder;
      await insertPaymentOrder({
        id: newId("pay_order"),
        booking_id: booking.id,
        provider: "razorpay",
        provider_order_id: createdOrder.order_id,
        amount: createdOrder.amount,
        currency: "INR",
        status: "created",
        created_at: now,
        updated_at: now
      });
    } catch {
      paymentOrder = null;
    }
  }

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
    payment_order: paymentOrder
  };
}

export async function extendBooking(
  bookingId: string,
  input: ExtendBookingRequest,
  actor: { userId: string; role: Role }
) {
  const booking = await getBookingOrThrow(bookingId);
  const ownerAllowed = actor.role === "customer" && booking.user_id === actor.userId;
  if (!ownerAllowed && actor.role !== "admin") {
    throw new ApiException(403, "forbidden", "Not allowed to extend this booking.");
  }

  if (booking.status !== "ongoing" && booking.status !== "extended") {
    throw new ApiException(
      409,
      "invalid_state",
      "Booking can be extended only from ongoing or extended status."
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
    await hasVehicleBookingOverlap(
      booking.vehicle_id,
      booking.drop_at,
      input.requested_drop_at,
      booking.id
    )
  ) {
    throw new ApiException(
      409,
      "vehicle_unavailable",
      "Vehicle has another booking in requested extension period."
    );
  }

  assertCanTransition(booking.status, "extension_requested", "booking.extend.request");

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
    total_payable: additionalQuote.total_payable - additionalQuote.deposit_amount
  };

  assertCanTransition("extension_requested", "extended", "booking.extend.confirm");
  const updated = await updateBooking(booking.id, {
    status: "extended",
    drop_at: input.requested_drop_at,
    quote: {
      ...booking.quote,
      base_amount: booking.quote.base_amount + extensionQuote.base_amount,
      duration_amount: booking.quote.duration_amount + extensionQuote.duration_amount,
      addon_amount: booking.quote.addon_amount + extensionQuote.addon_amount,
      coupon_discount: booking.quote.coupon_discount + extensionQuote.coupon_discount,
      tax_amount: booking.quote.tax_amount + extensionQuote.tax_amount,
      total_payable: booking.quote.total_payable + extensionQuote.total_payable,
      km_included: booking.quote.km_included + extensionQuote.km_included,
      excess_km_rate: booking.quote.excess_km_rate
    },
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
      additional_payable: extensionQuote.total_payable
    }
  });

  return {
    booking_id: updated.id,
    status: updated.status,
    additional_quote: extensionQuote
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
    "payment_pending",
    "confirmed",
    "ongoing",
    "extended"
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
    updated_at: new Date().toISOString()
  });

  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "booking.cancel",
    resourceType: "booking",
    resourceId: booking.id,
    metadata: {
      reason: input.reason,
      cancellation_charge: breakup.cancellation_charge,
      refund_amount: breakup.refund_amount
    }
  });

  return {
    booking_id: updated.id,
    status: updated.status,
    cancellation_charge: breakup.cancellation_charge,
    refund_amount: breakup.refund_amount,
    charge_rate: breakup.charge_rate
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

async function hasVehicleBookingOverlap(
  vehicleId: string,
  windowStart: string,
  windowEnd: string,
  ignoreBookingId?: string
) {
  const start = new Date(windowStart).getTime();
  const end = new Date(windowEnd).getTime();
  const bookings = await listBookings({
    vehicleId,
    excludeStatuses: ["cancelled", "completed"]
  });
  return bookings.some((booking) => {
    if (booking.id === ignoreBookingId) return false;
    const bookingStart = new Date(booking.pickup_at).getTime();
    const bookingEnd = new Date(booking.drop_at).getTime();
    return start < bookingEnd && end > bookingStart;
  });
}

export async function approveBooking(
  bookingId: string,
  actor: { userId: string; role: Role }
) {
  if (actor.role !== "admin") {
    throw new ApiException(403, "forbidden", "Only admin can approve bookings.");
  }

  const booking = await getBookingOrThrow(bookingId);
  
  if (booking.status !== "pending_kyc" && (booking.status as string) !== "admin_review") {
    throw new ApiException(400, "invalid_state", "Booking must be in pending_kyc state to be approved.");
  }

  const user = await getUserOrThrow(booking.user_id);
  
  const supabase = getSupabaseServiceClient();
  const { data: authUser } = await supabase.from("user").select("email").eq("id", user.id).single();
  
  const paymentLinkData = await createRazorpayPaymentLink({
    amountInPaise: booking.quote.total_payable * 100,
    receipt: booking.id,
    description: `Payment for booking ${booking.id}`,
    customer: {
      name: user.name,
      email: authUser?.email,
    }
  });

  const updated = await updateBooking(booking.id, {
    status: "payment_pending",
    updated_at: new Date().toISOString()
  });

  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "booking.approve",
    resourceType: "booking",
    resourceId: booking.id,
    metadata: {
      payment_link_id: paymentLinkData.id
    }
  });

  try {
    if (authUser?.email) {
      await sendBookingApprovedEmail(authUser.email, booking, paymentLinkData.short_url);
    }
  } catch (e) {
    console.error("Failed to send booking approval email:", e);
  }

  return updated;
}

export async function rejectBooking(
  bookingId: string,
  actor: { userId: string; role: Role }
) {
  if (actor.role !== "admin") {
    throw new ApiException(403, "forbidden", "Only admin can reject bookings.");
  }

  const booking = await getBookingOrThrow(bookingId);
  
  if (booking.status !== "pending_kyc" && (booking.status as string) !== "admin_review") {
    throw new ApiException(400, "invalid_state", "Booking must be in pending_kyc state to be rejected.");
  }

  const updated = await updateBooking(booking.id, {
    status: "cancelled",
    cancel_reason: "kyc_rejected",
    updated_at: new Date().toISOString()
  });

  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "booking.reject",
    resourceType: "booking",
    resourceId: booking.id,
    metadata: {
      reason: "kyc_rejected"
    }
  });

  try {
    const supabase = getSupabaseServiceClient();
    const { data: authUser } = await supabase.from("user").select("email").eq("id", booking.user_id).single();
    if (authUser?.email) {
      await sendBookingRejectedEmail(authUser.email, booking);
    }
  } catch (e) {
    console.error("Failed to send booking rejection email:", e);
  }

  return updated;
}
