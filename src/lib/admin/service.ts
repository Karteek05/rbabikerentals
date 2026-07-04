import { recordAudit } from "@/lib/audit/service";
import { assertCanTransition } from "@/lib/bookings/state-machine";
import { computeCancellationBreakup } from "@/lib/pricing/engine";
import { issueBookingRefund } from "@/lib/payments/service";
import {
  getBookingOrThrow,
  getLatestPaymentOrderForBooking,
  getOpenPaymentOrderForBooking,
  getUserOrThrow,
  insertPaymentOrder,
  listBookings,
  listUsersByIds,
  updateBooking
} from "@/lib/data/repository";
import { createRazorpayOrder, isRazorpayConfigured } from "@/lib/integrations/razorpay";
import { notifyAdmin, notifyUser, resolveUserNotificationEmail } from "@/lib/notifications/service";
import type { Role } from "@/lib/types/domain";
import type { ApproveBookingRequest, RejectBookingRequest } from "@/lib/types/contracts";
import { ApiException } from "@/lib/utils/errors";
import { newId } from "@/lib/utils/ids";
import { getServerAppBaseUrl } from "@/lib/utils/app-url";

function getPaymentUrl(bookingId: string) {
  const baseUrl = getServerAppBaseUrl() ?? "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, "")}/my-bookings?pay=${encodeURIComponent(bookingId)}`;
}

export async function listBookingsForAdmin(filters?: { status?: string }) {
  const bookings = await listBookings({ status: filters?.status });
  const users = await listUsersByIds(bookings.map((booking) => booking.user_id));
  const userMap = new Map(users.map((user) => [user.id, user]));

  return bookings.map((booking) => ({
    ...booking,
    user: userMap.get(booking.user_id) ?? null
  }));
}

export async function approveBooking(
  bookingId: string,
  input: ApproveBookingRequest,
  actor: { userId: string; role: Role }
) {
  if (actor.role !== "admin") {
    throw new ApiException(403, "forbidden", "Only admin can approve bookings.");
  }

  const booking = await getBookingOrThrow(bookingId);
  const approvableFrom = new Set(["pending_kyc", "admin_review"]);
  if (!approvableFrom.has(booking.status)) {
    throw new ApiException(
      409,
      "invalid_state",
      `Cannot approve booking in status ${booking.status}.`
    );
  }

  assertCanTransition(booking.status, "payment_pending", "admin.approve_booking");
  const updated = await updateBooking(booking.id, {
    status: "payment_pending",
    updated_at: new Date().toISOString()
  });
  const user = await getUserOrThrow(updated.user_id);
  const customerEmail = await resolveUserNotificationEmail(user.id, user.email);

  let paymentUrl = getPaymentUrl(updated.id);
  const existingOrder = await getOpenPaymentOrderForBooking(booking.id);

  if (!existingOrder && isRazorpayConfigured()) {
    try {
      const createdOrder = await createRazorpayOrder({
        amountInPaise: booking.quote.total_payable * 100,
        receipt: booking.id
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
      console.error("Failed to create Razorpay order:", error);
    }
  }

  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "admin.booking_approve",
    resourceType: "booking",
    resourceId: booking.id,
    metadata: {
      note: input.note ?? null
    }
  });

  await Promise.all([
    notifyUser({
      userId: updated.user_id,
      email: customerEmail,
      templateKey: "booking_approved_pay_now",
      payload: {
        booking_id: updated.id,
        vehicle_id: updated.vehicle_id,
        total_payable: updated.quote.total_payable,
        payment_url: paymentUrl
      }
    }),
    notifyAdmin({
      templateKey: "admin_booking_approved",
      payload: {
        booking_id: updated.id,
        user_id: updated.user_id,
        total_payable: updated.quote.total_payable
      }
    })
  ]);

  return updated;
}

export async function rejectBooking(
  bookingId: string,
  input: RejectBookingRequest,
  actor: { userId: string; role: Role }
) {
  if (actor.role !== "admin") {
    throw new ApiException(403, "forbidden", "Only admin can reject bookings.");
  }

  const booking = await getBookingOrThrow(bookingId);
  const rejectableFrom = new Set(["pending_kyc", "admin_review", "payment_pending", "confirmed"]);
  if (!rejectableFrom.has(booking.status)) {
    throw new ApiException(
      409,
      "invalid_state",
      `Cannot reject booking in status ${booking.status}.`
    );
  }

  assertCanTransition(booking.status, "cancelled", "admin.reject_booking");
  const breakup = computeCancellationBreakup({
    totalPayable: booking.quote.total_payable,
    pickupAt: booking.pickup_at
  });

  const updated = await updateBooking(booking.id, {
    status: "cancelled",
    cancel_reason: input.reason,
    updated_at: new Date().toISOString()
  });

  if (breakup.refund_amount > 0) {
    const paymentOrder = await getLatestPaymentOrderForBooking(booking.id);
    if (paymentOrder?.status === "paid" && paymentOrder.provider_payment_id) {
      try {
        await issueBookingRefund({
          bookingId: booking.id,
          amountInPaise: breakup.refund_amount * 100,
          reason: input.reason
        });
      } catch (error) {
        console.error("Failed to issue rejection refund:", error);
      }
    }
  }

  await recordAudit({
    actorId: actor.userId,
    actorRole: actor.role,
    action: "admin.booking_reject",
    resourceType: "booking",
    resourceId: booking.id,
    metadata: {
      reason: input.reason
    }
  });

  const user = await getUserOrThrow(updated.user_id);
  await Promise.all([
    notifyUser({
      userId: updated.user_id,
      email: user.email,
      templateKey: "booking_rejected",
      payload: {
        booking_id: updated.id,
        vehicle_id: updated.vehicle_id,
        reason: input.reason
      }
    }),
    notifyAdmin({
      templateKey: "admin_booking_rejected",
      payload: {
        booking_id: updated.id,
        user_id: updated.user_id,
        reason: input.reason
      }
    })
  ]);

  return updated;
}
