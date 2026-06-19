"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrderForBooking = createOrderForBooking;
exports.processRazorpayWebhook = processRazorpayWebhook;
exports.refundPaymentForBooking = refundPaymentForBooking;
exports.verifyClientPaymentSignature = verifyClientPaymentSignature;
const crypto_1 = __importDefault(require("crypto"));
const repository_1 = require("../../lib/data/repository");
const razorpay_1 = require("../../lib/integrations/razorpay");
const errors_1 = require("../../lib/utils/errors");
const ids_1 = require("../../lib/utils/ids");
function toClientOrder(params) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!keyId) {
        throw new errors_1.ApiException(500, "razorpay_env_missing", "Razorpay keys are not configured.");
    }
    return {
        provider: "razorpay",
        key_id: keyId,
        order_id: params.providerOrderId,
        amount: params.amount,
        currency: params.currency,
        receipt: params.bookingId,
        status: params.status
    };
}
async function createOrderForBooking(bookingId, actor) {
    const booking = await (0, repository_1.getBookingOrThrow)(bookingId);
    const ownerAllowed = actor.role === "customer" && booking.user_id === actor.userId;
    if (!ownerAllowed && actor.role !== "admin") {
        throw new errors_1.ApiException(403, "forbidden", "Not allowed to create a payment order for this booking.");
    }
    if (booking.status !== "payment_pending") {
        throw new errors_1.ApiException(409, "invalid_booking_status", "Payment order can be created only for payment_pending booking.");
    }
    const existingOrder = await (0, repository_1.getOpenPaymentOrderForBooking)(bookingId);
    if (existingOrder) {
        return toClientOrder({
            bookingId,
            providerOrderId: existingOrder.provider_order_id,
            amount: existingOrder.amount,
            currency: existingOrder.currency,
            status: existingOrder.status
        });
    }
    const order = await (0, razorpay_1.createRazorpayOrder)({
        amountInPaise: booking.quote.total_payable * 100,
        receipt: booking.id
    });
    try {
        await (0, repository_1.insertPaymentOrder)({
            id: (0, ids_1.newId)("pay_order"),
            booking_id: booking.id,
            provider: "razorpay",
            provider_order_id: order.order_id,
            amount: order.amount,
            currency: order.currency,
            status: "created",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
    }
    catch (error) {
        if (error instanceof errors_1.ApiException && error.code === "payment_order_exists") {
            const openOrder = await (0, repository_1.getOpenPaymentOrderForBooking)(bookingId);
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
async function processRazorpayWebhook(params) {
    if (!params.signature) {
        throw new errors_1.ApiException(400, "signature_missing", "Missing Razorpay signature.");
    }
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
        throw new errors_1.ApiException(500, "razorpay_webhook_secret_missing", "RAZORPAY_WEBHOOK_SECRET is missing.");
    }
    const expected = crypto_1.default.createHmac("sha256", secret).update(params.rawBody).digest("hex");
    if (expected !== params.signature) {
        throw new errors_1.ApiException(401, "invalid_signature", "Invalid Razorpay webhook signature.");
    }
    const payload = JSON.parse(params.rawBody);
    const eventId = `${payload.event}:${payload.payload?.payment?.entity?.id ?? "unknown"}`;
    if (await (0, repository_1.hasProcessedPaymentEvent)(eventId)) {
        return { processed: false, reason: "duplicate_event" };
    }
    await (0, repository_1.insertPaymentEvent)({
        id: (0, ids_1.newId)("pay_evt"),
        provider: "razorpay",
        provider_event_id: eventId,
        payload_hash: crypto_1.default.createHash("sha256").update(params.rawBody).digest("hex"),
        created_at: new Date().toISOString()
    });
    if (payload.event === "payment.captured") {
        const orderId = payload.payload?.payment?.entity?.order_id;
        if (orderId) {
            const updatedOrder = await (0, repository_1.updatePaymentOrderByProviderId)(orderId, {
                provider_payment_id: payload.payload?.payment?.entity?.id,
                status: "paid",
                updated_at: new Date().toISOString()
            });
            if (updatedOrder) {
                await (0, repository_1.updateBooking)(updatedOrder.booking_id, {
                    status: "confirmed",
                    updated_at: new Date().toISOString()
                });
            }
        }
    }
    if (payload.event === "payment.failed") {
        const orderId = payload.payload?.payment?.entity?.order_id;
        if (orderId) {
            await (0, repository_1.updatePaymentOrderByProviderId)(orderId, {
                status: "failed",
                updated_at: new Date().toISOString()
            });
        }
    }
    return { processed: true, event: payload.event };
}
async function refundPaymentForBooking(params) {
    if (params.actor.role !== "admin") {
        throw new errors_1.ApiException(403, "forbidden", "Only admin can create refunds.");
    }
    const booking = await (0, repository_1.getBookingOrThrow)(params.bookingId);
    const paymentOrder = await (0, repository_1.getLatestPaymentOrderForBooking)(params.bookingId);
    if (!paymentOrder || paymentOrder.status !== "paid") {
        throw new errors_1.ApiException(409, "payment_not_refundable", "Booking does not have a paid payment order.");
    }
    if (!paymentOrder.provider_payment_id) {
        throw new errors_1.ApiException(409, "payment_id_missing", "Razorpay payment id is missing; wait for captured webhook or reconcile before refunding.");
    }
    const maxRefundAmount = paymentOrder.amount;
    const requestedAmount = params.amount ?? maxRefundAmount;
    if (!Number.isInteger(requestedAmount) || requestedAmount <= 0) {
        throw new errors_1.ApiException(400, "invalid_refund_amount", "Refund amount must be a positive integer.");
    }
    if (requestedAmount > maxRefundAmount) {
        throw new errors_1.ApiException(400, "refund_exceeds_payment", "Refund amount exceeds paid amount.");
    }
    const refund = await (0, razorpay_1.createRazorpayRefund)({
        paymentId: paymentOrder.provider_payment_id,
        amountInPaise: requestedAmount,
        notes: {
            booking_id: booking.id,
            reason: params.reason ?? "admin_refund"
        }
    });
    const updatedOrder = await (0, repository_1.updatePaymentOrderByBookingId)(params.bookingId, {
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
function verifyClientPaymentSignature(input) {
    const valid = (0, razorpay_1.verifyRazorpaySignature)(input);
    if (!valid) {
        throw new errors_1.ApiException(400, "invalid_signature", "Client payment signature mismatch.");
    }
    return { verified: true };
}
