import crypto from "crypto";
import {
  getBookingOrThrow,
  getLatestPaymentOrderForBooking,
  getOpenPaymentOrderForBooking,
  getUserOrThrow,
  hasProcessedPaymentEvent,
  insertPaymentEvent,
  insertPaymentOrder,
  updateBooking,
  updatePaymentOrderById,
  updatePaymentOrderByProviderId
} from "@/lib/data/repository";
import {
  createRazorpayOrder,
  createRazorpayRefund,
  isRazorpayConfigured,
  verifyRazorpaySignature
} from "@/lib/integrations/razorpay";
import { notifyAdmin, notifyUser } from "@/lib/notifications/service";
import type { Role } from "@/lib/types/domain";
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

  const existingOrder = await getOpenPaymentOrderForBooking(bookingId);
  if (existingOrder) {
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
        };
      };
      payment_link?: {
        entity?: {
          id?: string;
          reference_id?: string;
          status?: string;
        };
      };
    };
  };

  const eventId = `${payload.event}:${payload.payload?.payment?.entity?.id ?? "unknown"}`;
  if (await hasProcessedPaymentEvent(eventId)) {
    return { processed: false, reason: "duplicate_event" };
  }

  await insertPaymentEvent({
    id: newId("pay_evt"),
    provider: "razorpay",
    provider_event_id: eventId,
    payload_hash: crypto.createHash("sha256").update(params.rawBody).digest("hex"),
    created_at: new Date().toISOString()
  });

  if (payload.event === "payment.captured") {
    const orderId = payload.payload?.payment?.entity?.order_id;
    if (orderId) {
      const updatedOrder = await updatePaymentOrderByProviderId(orderId, {
        provider_payment_id: payload.payload?.payment?.entity?.id,
        status: "paid",
        updated_at: new Date().toISOString()
      });

      if (updatedOrder) {
        const booking = await getBookingOrThrow(updatedOrder.booking_id);
        const updatedBooking = await updateBooking(updatedOrder.booking_id, {
          status: "confirmed",
          updated_at: new Date().toISOString()
        });
        const user = await getUserOrThrow(updatedBooking.user_id);
        await Promise.all([
          notifyUser({
            userId: updatedBooking.user_id,
            email: user.email,
            templateKey: "payment_confirmed",
            payload: {
              booking_id: updatedBooking.id,
              vehicle_id: updatedBooking.vehicle_id,
              total_payable: updatedBooking.quote.total_payable,
              provider_order_id: updatedOrder.provider_order_id
            }
          }),
          notifyAdmin({
            templateKey: "admin_payment_confirmed",
            payload: {
              booking_id: updatedBooking.id,
              user_id: updatedBooking.user_id,
              vehicle_id: updatedBooking.vehicle_id,
              total_payable: booking.quote.total_payable,
              provider_order_id: updatedOrder.provider_order_id
            }
          })
        ]);
      }
    }
  }

  if (payload.event === "payment_link.paid") {
    const paymentLinkId = payload.payload?.payment_link?.entity?.id;
    if (paymentLinkId) {
      const updatedOrder = await updatePaymentOrderByProviderId(paymentLinkId, {
        provider_payment_id: payload.payload?.payment?.entity?.id,
        status: "paid",
        updated_at: new Date().toISOString()
      });

      if (updatedOrder) {
        const booking = await getBookingOrThrow(updatedOrder.booking_id);
        const updatedBooking = await updateBooking(updatedOrder.booking_id, {
          status: "confirmed",
          updated_at: new Date().toISOString()
        });
        const user = await getUserOrThrow(updatedBooking.user_id);
        await Promise.all([
          notifyUser({
            userId: updatedBooking.user_id,
            email: user.email,
            templateKey: "payment_confirmed",
            payload: {
              booking_id: updatedBooking.id,
              vehicle_id: updatedBooking.vehicle_id,
              total_payable: updatedBooking.quote.total_payable,
              provider_order_id: updatedOrder.provider_order_id
            }
          }),
          notifyAdmin({
            templateKey: "admin_payment_confirmed",
            payload: {
              booking_id: updatedBooking.id,
              user_id: updatedBooking.user_id,
              vehicle_id: updatedBooking.vehicle_id,
              total_payable: booking.quote.total_payable,
              provider_order_id: updatedOrder.provider_order_id
            }
          })
        ]);
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

export async function refundPaymentForBooking(params: {
  bookingId: string;
  amount?: number;
  reason?: string;
  actor: { userId: string; role: Role };
}) {
  if (params.actor.role !== "admin") {
    throw new ApiException(403, "forbidden", "Only admin can create refunds.");
  }

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

  const maxRefundAmount = paymentOrder.amount;
  const requestedAmount = params.amount ?? maxRefundAmount;
  if (!Number.isInteger(requestedAmount) || requestedAmount <= 0) {
    throw new ApiException(400, "invalid_refund_amount", "Refund amount must be a positive integer.");
  }
  if (requestedAmount > maxRefundAmount) {
    throw new ApiException(400, "refund_exceeds_payment", "Refund amount exceeds paid amount.");
  }

  const refund = await createRazorpayRefund({
    paymentId: paymentOrder.provider_payment_id,
    amountInPaise: requestedAmount,
    notes: {
      booking_id: booking.id,
      reason: params.reason ?? "admin_refund"
    }
  });

  const updatedOrder = await updatePaymentOrderById(paymentOrder.id, {
    provider_refund_id: refund.refund_id,
    refunded_amount: refund.amount,
    status: "refunded",
    updated_at: new Date().toISOString()
  });

  return {
    booking_id: params.bookingId,
    order: updatedOrder,
    refund
  };
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
