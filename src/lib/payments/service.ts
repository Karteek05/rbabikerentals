import crypto from "crypto";
import { assertCanTransition } from "@/lib/bookings/state-machine";
import {
  getBookingOrThrow,
  getLatestAuditEventForResource,
  getLatestPaymentOrderForBooking,
  getOpenPaymentOrderForBooking,
  getUserOrThrow,
  claimPaymentEvent,
  insertPaymentOrder,
  updateBookingIfStatus,
  updatePaymentOrderById,
  updatePaymentOrderByProviderId
} from "@/lib/data/repository";
import {
  createRazorpayOrder,
  createRazorpayRefund,
  fetchCapturedPaymentForOrder,
  fetchRazorpayOrder,
  isRazorpayConfigured,
  verifyRazorpaySignature
} from "@/lib/integrations/razorpay";
import { notifyAdmin, notifyUser, resolveUserNotificationEmail } from "@/lib/notifications/service";
import type { PricingQuote, Role } from "@/lib/types/domain";
import { ApiException } from "@/lib/utils/errors";
import { newId } from "@/lib/utils/ids";

function toClientOrder(params: {
  bookingId: string;
  providerOrderId: string;
  amount: number;
  currency: "INR";
  status: string;
}) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  if (!keyId) {
    throw new ApiException(500, "razorpay_env_missing", "Razorpay keys are not configured.");
  }

  return {
    provider: "razorpay" as const,
    key_id: keyId,
    order_id: params.providerOrderId,
    amount: params.amount,
    currency: params.currency,
    receipt: params.bookingId,
    status: params.status
  };
}

function toUpiFallbackOrder(params: {
  bookingId: string;
  amount: number;
}) {
  return {
    provider: "upi_fallback" as const,
    order_id: null,
    key_id: null,
    amount: params.amount,
    currency: "INR" as const,
    receipt: params.bookingId,
    status: "upi_fallback",
    reason: "razorpay_not_configured"
  };
}

async function waitForFinalizedBooking(bookingId: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const currentBooking = await getBookingOrThrow(bookingId);
    if (currentBooking.status === "confirmed" || currentBooking.status === "extended") {
      return currentBooking;
    }
  }
  return getBookingOrThrow(bookingId);
}

async function finalizeCapturedPayment(params: {
  updatedOrder: NonNullable<Awaited<ReturnType<typeof updatePaymentOrderByProviderId>>>;
  paidAmount?: number;
}) {
  const booking = await getBookingOrThrow(params.updatedOrder.booking_id);

  if (
    typeof params.paidAmount === "number" &&
    params.paidAmount !== params.updatedOrder.amount
  ) {
    throw new ApiException(
      409,
      "payment_amount_mismatch",
      "Captured payment amount does not match the booking order amount."
    );
  }

  if (booking.status === "extended" || booking.status === "confirmed") {
    return booking;
  }

  if (booking.status === "extension_requested") {
    const pendingAudit = await getLatestAuditEventForResource(
      "booking",
      booking.id,
      "booking.extension_pending"
    );
    const metadata = pendingAudit?.metadata as
      | {
          requested_drop_at?: string;
          extension_quote?: PricingQuote;
        }
      | undefined;
    const requestedDropAt = metadata?.requested_drop_at;
    const extensionQuote = metadata?.extension_quote;
    if (!requestedDropAt || !extensionQuote) {
      throw new ApiException(
        409,
        "extension_metadata_missing",
        "Extension payment received but pending extension details were not found."
      );
    }

    assertCanTransition("extension_requested", "extended", "booking.extend.confirm");
    const updatedBooking = await updateBookingIfStatus(booking.id, "extension_requested", {
      status: "extended",
      drop_at: requestedDropAt,
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
    if (!updatedBooking) {
      return waitForFinalizedBooking(booking.id);
    }
    const user = await getUserOrThrow(updatedBooking.user_id);
    const email = await resolveUserNotificationEmail(updatedBooking.user_id, user.email);
    await notifyUser({
      userId: updatedBooking.user_id,
      email,
      templateKey: "payment_confirmed",
      payload: {
        booking_id: updatedBooking.id,
        vehicle_id: updatedBooking.vehicle_id,
        total_payable: updatedBooking.quote.total_payable,
        provider_order_id: params.updatedOrder.provider_order_id
      }
    });
    return updatedBooking;
  }

  if (booking.status !== "payment_pending") {
    throw new ApiException(
      409,
      "invalid_booking_status",
      `Cannot confirm payment for booking in status ${booking.status}.`
    );
  }

  assertCanTransition(booking.status, "confirmed", "payment.webhook.capture");
  const updatedBooking = await updateBookingIfStatus(booking.id, "payment_pending", {
    status: "confirmed",
    updated_at: new Date().toISOString()
  });
  if (!updatedBooking) {
    return waitForFinalizedBooking(booking.id);
  }
  const user = await getUserOrThrow(updatedBooking.user_id);
  const email = await resolveUserNotificationEmail(updatedBooking.user_id, user.email);
  await Promise.all([
    notifyUser({
      userId: updatedBooking.user_id,
      email,
      templateKey: "payment_confirmed",
      payload: {
        booking_id: updatedBooking.id,
        vehicle_id: updatedBooking.vehicle_id,
        total_payable: updatedBooking.quote.total_payable,
        provider_order_id: params.updatedOrder.provider_order_id
      }
    }),
    notifyAdmin({
      templateKey: "admin_payment_confirmed",
      payload: {
        booking_id: updatedBooking.id,
        user_id: updatedBooking.user_id,
        vehicle_id: updatedBooking.vehicle_id,
        total_payable: booking.quote.total_payable,
        provider_order_id: params.updatedOrder.provider_order_id
      }
    })
  ]);

  return updatedBooking;
}

function isCheckoutOrderId(providerOrderId: string) {
  return providerOrderId.startsWith("order_");
}

async function syncOpenPaymentOrderForBooking(bookingId: string) {
  try {
    const openOrder = await getOpenPaymentOrderForBooking(bookingId);
    if (!openOrder || !isCheckoutOrderId(openOrder.provider_order_id)) {
      return null;
    }

    const remoteOrder = await fetchRazorpayOrder(openOrder.provider_order_id);
    const capturedPayment = await fetchCapturedPaymentForOrder(openOrder.provider_order_id);
    if (remoteOrder.status !== "paid" && !capturedPayment) {
      return null;
    }

    if (!capturedPayment) {
      return null;
    }

    const updatedOrder = await updatePaymentOrderByProviderId(openOrder.provider_order_id, {
      provider_payment_id: capturedPayment.id,
      status: "paid",
      updated_at: new Date().toISOString()
    });

    if (!updatedOrder) {
      return null;
    }

    return finalizeCapturedPayment({
      updatedOrder,
      paidAmount: capturedPayment.amount
    });
  } catch (error) {
    console.error("Failed to sync open payment order from Razorpay:", error);
    return null;
  }
}

export async function confirmRazorpayCheckoutPayment(params: {
  bookingId: string;
  orderId: string;
  paymentId: string;
  signature: string;
  actor: { userId: string; role: Role };
}) {
  const booking = await getBookingOrThrow(params.bookingId);
  const ownerAllowed = params.actor.role === "customer" && booking.user_id === params.actor.userId;
  if (!ownerAllowed && params.actor.role !== "admin") {
    throw new ApiException(403, "forbidden", "Not allowed to confirm payment for this booking.");
  }

  if (booking.status === "confirmed" || booking.status === "extended") {
    return { booking, already_confirmed: true as const };
  }

  if (
    !verifyRazorpaySignature({
      orderId: params.orderId,
      paymentId: params.paymentId,
      signature: params.signature
    })
  ) {
    throw new ApiException(401, "invalid_signature", "Invalid Razorpay payment signature.");
  }

  const paymentOrder = await getLatestPaymentOrderForBooking(params.bookingId);
  if (!paymentOrder || paymentOrder.provider_order_id !== params.orderId) {
    throw new ApiException(409, "payment_order_mismatch", "Payment order does not match this booking.");
  }

  let updatedOrder = paymentOrder;
  if (paymentOrder.status === "created") {
    const markedPaid = await updatePaymentOrderByProviderId(params.orderId, {
      provider_payment_id: params.paymentId,
      status: "paid",
      updated_at: new Date().toISOString()
    });
    if (!markedPaid) {
      throw new ApiException(404, "payment_order_not_found", "Payment order was not found.");
    }
    updatedOrder = markedPaid;
  } else if (paymentOrder.status !== "paid") {
    throw new ApiException(
      409,
      "payment_order_unusable",
      "Payment order is not available for confirmation."
    );
  }

  const confirmedBooking = await finalizeCapturedPayment({
    updatedOrder,
    paidAmount: updatedOrder.amount
  });

  if (confirmedBooking.status !== "confirmed" && confirmedBooking.status !== "extended") {
    throw new ApiException(
      409,
      "payment_finalize_pending",
      "Payment was received but booking confirmation is still pending. Please wait a moment and refresh."
    );
  }

  return { booking: confirmedBooking, already_confirmed: false as const };
}

export async function createOrderForBooking(
  bookingId: string,
  actor: { userId: string; role: Role }
) {
  const booking = await getBookingOrThrow(bookingId);
  const ownerAllowed = actor.role === "customer" && booking.user_id === actor.userId;
  if (!ownerAllowed && actor.role !== "admin") {
    throw new ApiException(403, "forbidden", "Not allowed to create a payment order for this booking.");
  }
  if (booking.status !== "payment_pending") {
    throw new ApiException(
      409,
      "invalid_booking_status",
      "Payment order can be created only for payment_pending booking."
    );
  }

  if (isRazorpayConfigured()) {
    await syncOpenPaymentOrderForBooking(bookingId);

    const paidOrder = await getLatestPaymentOrderForBooking(bookingId);
    if (paidOrder?.status === "paid" && isCheckoutOrderId(paidOrder.provider_order_id)) {
      try {
        await finalizeCapturedPayment({
          updatedOrder: paidOrder,
          paidAmount: paidOrder.amount
        });
      } catch (error) {
        console.error("Failed to finalize already-paid payment order:", error);
      }
    }

    const bookingAfterSync = await getBookingOrThrow(bookingId);
    if (bookingAfterSync.status !== "payment_pending") {
      throw new ApiException(
        409,
        "payment_already_completed",
        "Payment is already completed for this booking."
      );
    }

    const latestAfterSync = await getLatestPaymentOrderForBooking(bookingId);
    if (
      latestAfterSync?.status === "paid" &&
      isCheckoutOrderId(latestAfterSync.provider_order_id)
    ) {
      throw new ApiException(
        409,
        "payment_finalize_pending",
        "Payment was received but booking confirmation is still pending. Please wait a moment and refresh, or use the UPI QR below."
      );
    }
  }

  const existingOrder = await getOpenPaymentOrderForBooking(bookingId);
  if (existingOrder && isCheckoutOrderId(existingOrder.provider_order_id)) {
    return toClientOrder({
      bookingId,
      providerOrderId: existingOrder.provider_order_id,
      amount: existingOrder.amount,
      currency: existingOrder.currency,
      status: existingOrder.status
    });
  }

  if (!isRazorpayConfigured()) {
    return toUpiFallbackOrder({
      bookingId,
      amount: booking.quote.total_payable * 100
    });
  }

  const order = await createRazorpayOrder({
    amountInPaise: booking.quote.total_payable * 100,
    receipt: booking.id
  });

  try {
    await insertPaymentOrder({
      id: newId("pay_order"),
      booking_id: booking.id,
      provider: "razorpay",
      provider_order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      status: "created",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof ApiException && error.code === "payment_order_exists") {
      const openOrder = await getOpenPaymentOrderForBooking(bookingId);
      if (openOrder) {
        return toClientOrder({
          bookingId,
          providerOrderId: openOrder.provider_order_id,
          amount: openOrder.amount,
          currency: openOrder.currency,
          status: openOrder.status
        });
      }
    }
    throw error;
  }

  return order;
}

export async function processRazorpayWebhook(params: {
  signature: string | null;
  rawBody: string;
}) {
  if (!params.signature) {
    throw new ApiException(400, "signature_missing", "Missing Razorpay signature.");
  }
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new ApiException(
      500,
      "razorpay_webhook_secret_missing",
      "RAZORPAY_WEBHOOK_SECRET is missing."
    );
  }

  const expected = crypto.createHmac("sha256", secret).update(params.rawBody).digest("hex");
  if (expected !== params.signature) {
    throw new ApiException(401, "invalid_signature", "Invalid Razorpay webhook signature.");
  }

  const payload = JSON.parse(params.rawBody) as {
    event: string;
    created_at?: number;
    payload?: {
      payment?: {
        entity?: {
          id?: string;
          order_id?: string;
          status?: string;
          amount?: number;
        };
      };
      payment_link?: {
        entity?: {
          id?: string;
          reference_id?: string;
          status?: string;
          amount?: number;
        };
      };
    };
  };

  const eventId = `${payload.event}:${payload.payload?.payment?.entity?.id ?? payload.payload?.payment_link?.entity?.id ?? "unknown"}`;
  const payloadHash = crypto.createHash("sha256").update(params.rawBody).digest("hex");

  const claimed = await claimPaymentEvent({
    id: newId("pay_evt"),
    provider: "razorpay",
    provider_event_id: eventId,
    payload_hash: payloadHash,
    created_at: new Date().toISOString()
  });
  if (!claimed) {
    return { processed: false, reason: "duplicate_event" };
  }

  if (payload.event === "payment.captured") {
    const orderId = payload.payload?.payment?.entity?.order_id;
    const paidAmount = payload.payload?.payment?.entity?.amount;
    if (orderId) {
      const updatedOrder = await updatePaymentOrderByProviderId(orderId, {
        provider_payment_id: payload.payload?.payment?.entity?.id,
        status: "paid",
        updated_at: new Date().toISOString()
      });

      if (updatedOrder) {
        await finalizeCapturedPayment({ updatedOrder, paidAmount });
      }
    }
  }

  if (payload.event === "payment_link.paid") {
    const paymentLinkId = payload.payload?.payment_link?.entity?.id;
    const paidAmount = payload.payload?.payment_link?.entity?.amount;
    if (paymentLinkId) {
      const updatedOrder = await updatePaymentOrderByProviderId(paymentLinkId, {
        provider_payment_id: payload.payload?.payment?.entity?.id,
        status: "paid",
        updated_at: new Date().toISOString()
      });

      if (updatedOrder) {
        await finalizeCapturedPayment({ updatedOrder, paidAmount });
      }
    }
  }

  if (payload.event === "payment.failed") {
    const orderId = payload.payload?.payment?.entity?.order_id;
    if (orderId) {
      await updatePaymentOrderByProviderId(orderId, {
        status: "failed",
        updated_at: new Date().toISOString()
      });
    }
  }

  return { processed: true, event: payload.event };
}

export async function issueBookingRefund(params: {
  bookingId: string;
  amountInPaise: number;
  reason?: string;
}) {
  const booking = await getBookingOrThrow(params.bookingId);
  const paymentOrder = await getLatestPaymentOrderForBooking(params.bookingId);
  if (!paymentOrder || paymentOrder.status !== "paid") {
    throw new ApiException(409, "payment_not_refundable", "Booking does not have a paid payment order.");
  }
  if (!paymentOrder.provider_payment_id) {
    throw new ApiException(
      409,
      "payment_id_missing",
      "Razorpay payment id is missing; wait for captured webhook or reconcile before refunding."
    );
  }

  const alreadyRefunded = paymentOrder.refunded_amount ?? 0;
  const maxRefundAmount = paymentOrder.amount - alreadyRefunded;
  if (!Number.isInteger(params.amountInPaise) || params.amountInPaise <= 0) {
    throw new ApiException(400, "invalid_refund_amount", "Refund amount must be a positive integer.");
  }
  if (params.amountInPaise > maxRefundAmount) {
    throw new ApiException(400, "refund_exceeds_payment", "Refund amount exceeds remaining refundable balance.");
  }

  const refund = await createRazorpayRefund({
    paymentId: paymentOrder.provider_payment_id,
    amountInPaise: params.amountInPaise,
    notes: {
      booking_id: booking.id,
      reason: params.reason ?? "booking_refund"
    }
  });

  const totalRefunded = alreadyRefunded + refund.amount;
  const updatedOrder = await updatePaymentOrderById(paymentOrder.id, {
    provider_refund_id: refund.refund_id,
    refunded_amount: totalRefunded,
    status: totalRefunded >= paymentOrder.amount ? "refunded" : "paid",
    updated_at: new Date().toISOString()
  });

  return {
    booking_id: params.bookingId,
    order: updatedOrder,
    refund
  };
}

export async function refundPaymentForBooking(params: {
  bookingId: string;
  amount?: number;
  reason?: string;
  actor: { userId: string; role: Role };
}) {
  if (params.actor.role !== "admin") {
    throw new ApiException(403, "forbidden", "Only admin can create refunds.");
  }

  const paymentOrder = await getLatestPaymentOrderForBooking(params.bookingId);
  if (!paymentOrder) {
    throw new ApiException(409, "payment_not_refundable", "Booking does not have a paid payment order.");
  }
  const alreadyRefunded = paymentOrder.refunded_amount ?? 0;
  const amountInPaise = params.amount ?? paymentOrder.amount - alreadyRefunded;

  return issueBookingRefund({
    bookingId: params.bookingId,
    amountInPaise,
    reason: params.reason
  });
}

export function verifyClientPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  const valid = verifyRazorpaySignature(input);
  if (!valid) {
    throw new ApiException(400, "invalid_signature", "Client payment signature mismatch.");
  }
  return { verified: true };
}
