"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBooking = createBooking;
exports.extendBooking = extendBooking;
exports.cancelBooking = cancelBooking;
exports.reportDamageIncident = reportDamageIncident;
const state_machine_1 = require("../../lib/bookings/state-machine");
const service_1 = require("../../lib/audit/service");
const repository_1 = require("../../lib/data/repository");
const razorpay_1 = require("../../lib/integrations/razorpay");
const engine_1 = require("../../lib/pricing/engine");
const errors_1 = require("../../lib/utils/errors");
const ids_1 = require("../../lib/utils/ids");
async function createBooking(input, actor) {
    (0, repository_1.assertBengaluruCity)(input.city);
    if (actor.role !== "customer" && actor.role !== "admin") {
        throw new errors_1.ApiException(403, "forbidden", "Only customer or admin can create booking.");
    }
    if (actor.role === "customer" && actor.userId !== input.user_id) {
        throw new errors_1.ApiException(403, "forbidden", "Customer can create booking only for self.");
    }
    const user = await (0, repository_1.getUserOrThrow)(input.user_id);
    const vehicle = await (0, repository_1.getVehicleOrThrow)(input.vehicle_id);
    let kyc;
    try {
        kyc = await (0, repository_1.getKycRecordOrThrow)(input.user_id);
    }
    catch (error) {
        if (!(error instanceof errors_1.ApiException) || error.code !== "kyc_not_found") {
            throw error;
        }
        kyc = await (0, repository_1.upsertKycRecord)({
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
        throw new errors_1.ApiException(400, "invalid_booking_window", "Pickup time must be before drop time.");
    }
    if (vehicle.city !== "bengaluru") {
        throw new errors_1.ApiException(400, "unsupported_city", "Vehicle is not available in Bengaluru.");
    }
    const resolvedDurationValue = (0, engine_1.resolveDurationValueFromWindow)({
        duration_bucket: input.duration_bucket,
        start_at: input.pickup_at,
        end_at: input.drop_at
    });
    const quoteInput = {
        user_id: input.user_id,
        vehicle_id: input.vehicle_id,
        city: input.city,
        duration_bucket: input.duration_bucket,
        duration_value: resolvedDurationValue,
        extra_helmet_count: input.extra_helmet_count,
        coupon_code: input.coupon_code
    };
    const quote = await (0, engine_1.computePricingQuote)(quoteInput);
    const now = new Date().toISOString();
    if (await isVehicleBlockedDuring(input.vehicle_id, input.pickup_at, input.drop_at)) {
        throw new errors_1.ApiException(409, "vehicle_blocked", "Vehicle has a maintenance/block window in requested time.");
    }
    if (await hasVehicleBookingOverlap(input.vehicle_id, input.pickup_at, input.drop_at)) {
        throw new errors_1.ApiException(409, "vehicle_unavailable", "Vehicle is already booked for requested time.");
    }
    const booking = await (0, repository_1.insertBooking)({
        id: (0, ids_1.newId)("booking"),
        user_id: input.user_id,
        vehicle_id: input.vehicle_id,
        city: "bengaluru",
        status: kyc.status === "verified" ? "payment_pending" : "pending_kyc",
        pickup_at: input.pickup_at,
        drop_at: input.drop_at,
        quote,
        coupon_code: input.coupon_code,
        km_limit_bucket: input.km_limit_bucket,
        km_limit_value: input.km_limit_value,
        created_at: now,
        updated_at: now
    });
    let paymentOrder = null;
    if (booking.status === "payment_pending") {
        try {
            const createdOrder = await (0, razorpay_1.createRazorpayOrder)({
                amountInPaise: booking.quote.total_payable * 100,
                receipt: booking.id
            });
            paymentOrder = createdOrder;
            await (0, repository_1.insertPaymentOrder)({
                id: (0, ids_1.newId)("pay_order"),
                booking_id: booking.id,
                provider: "razorpay",
                provider_order_id: createdOrder.order_id,
                amount: createdOrder.amount,
                currency: "INR",
                status: "created",
                created_at: now,
                updated_at: now
            });
        }
        catch {
            paymentOrder = null;
        }
    }
    await (0, service_1.recordAudit)({
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
    return {
        ...booking,
        payment_order: paymentOrder
    };
}
async function extendBooking(bookingId, input, actor) {
    const booking = await (0, repository_1.getBookingOrThrow)(bookingId);
    const ownerAllowed = actor.role === "customer" && booking.user_id === actor.userId;
    if (!ownerAllowed && actor.role !== "admin") {
        throw new errors_1.ApiException(403, "forbidden", "Not allowed to extend this booking.");
    }
    if (booking.status !== "ongoing" && booking.status !== "extended") {
        throw new errors_1.ApiException(409, "invalid_state", "Booking can be extended only from ongoing or extended status.");
    }
    if (new Date(input.requested_drop_at).getTime() <= new Date(booking.drop_at).getTime()) {
        throw new errors_1.ApiException(400, "invalid_extension_time", "Extended drop time must be after current drop time.");
    }
    if (await isVehicleBlockedDuring(booking.vehicle_id, booking.drop_at, input.requested_drop_at)) {
        throw new errors_1.ApiException(409, "vehicle_blocked", "Vehicle has a block or maintenance window for requested extension.");
    }
    if (await hasVehicleBookingOverlap(booking.vehicle_id, booking.drop_at, input.requested_drop_at, booking.id)) {
        throw new errors_1.ApiException(409, "vehicle_unavailable", "Vehicle has another booking in requested extension period.");
    }
    (0, state_machine_1.assertCanTransition)(booking.status, "extension_requested", "booking.extend.request");
    const resolvedExtensionDurationValue = (0, engine_1.resolveDurationValueFromWindow)({
        duration_bucket: input.duration_bucket,
        start_at: booking.drop_at,
        end_at: input.requested_drop_at
    });
    const additionalQuote = await (0, engine_1.computePricingQuote)({
        user_id: booking.user_id,
        vehicle_id: booking.vehicle_id,
        city: booking.city,
        duration_bucket: input.duration_bucket,
        duration_value: resolvedExtensionDurationValue
    });
    const extensionQuote = {
        ...additionalQuote,
        deposit_amount: 0,
        total_payable: additionalQuote.total_payable - additionalQuote.deposit_amount
    };
    (0, state_machine_1.assertCanTransition)("extension_requested", "extended", "booking.extend.confirm");
    const updated = await (0, repository_1.updateBooking)(booking.id, {
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
    await (0, service_1.recordAudit)({
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
async function cancelBooking(bookingId, input, actor) {
    const booking = await (0, repository_1.getBookingOrThrow)(bookingId);
    const ownerAllowed = actor.role === "customer" && booking.user_id === actor.userId;
    if (!ownerAllowed && actor.role !== "admin") {
        throw new errors_1.ApiException(403, "forbidden", "Not allowed to cancel this booking.");
    }
    const cancellableStates = new Set([
        "pending_kyc",
        "payment_pending",
        "confirmed",
        "ongoing",
        "extended"
    ]);
    if (!cancellableStates.has(booking.status)) {
        throw new errors_1.ApiException(409, "invalid_state", `Cannot cancel booking from status ${booking.status}.`);
    }
    (0, state_machine_1.assertCanTransition)(booking.status, "cancelled", "booking.cancel");
    const breakup = (0, engine_1.computeCancellationBreakup)({
        totalPayable: booking.quote.total_payable,
        pickupAt: booking.pickup_at
    });
    const updated = await (0, repository_1.updateBooking)(booking.id, {
        status: "cancelled",
        cancel_reason: input.reason,
        updated_at: new Date().toISOString()
    });
    await (0, service_1.recordAudit)({
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
async function reportDamageIncident(input) {
    const booking = await (0, repository_1.getBookingOrThrow)(input.bookingId);
    if (input.actorRole === "customer" &&
        booking.user_id !== input.actorId) {
        throw new errors_1.ApiException(403, "forbidden", "Customer can report only own booking incident.");
    }
    const incident = await (0, repository_1.insertDamageIncident)({
        id: (0, ids_1.newId)("incident"),
        booking_id: booking.id,
        vehicle_id: booking.vehicle_id,
        reported_by: input.actorId,
        description: input.description,
        photo_urls: input.photoUrls,
        created_at: new Date().toISOString()
    });
    // Auto-block for 24h pending review.
    await (0, repository_1.insertVehicleBlock)({
        id: (0, ids_1.newId)("block"),
        vehicle_id: booking.vehicle_id,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        reason: "auto_block_damage_incident",
        created_by: input.actorId,
        created_at: new Date().toISOString()
    });
    await (0, service_1.recordAudit)({
        actorId: input.actorId,
        actorRole: input.actorRole,
        action: "booking.damage_report",
        resourceType: "booking",
        resourceId: booking.id,
        metadata: { incident_id: incident.id }
    });
    return incident;
}
async function isVehicleBlockedDuring(vehicleId, windowStart, windowEnd) {
    const start = new Date(windowStart).getTime();
    const end = new Date(windowEnd).getTime();
    const blocks = await (0, repository_1.listVehicleBlocks)(vehicleId);
    return blocks.some((block) => {
        const blockStart = new Date(block.starts_at).getTime();
        const blockEnd = new Date(block.ends_at).getTime();
        return start < blockEnd && end > blockStart;
    });
}
async function hasVehicleBookingOverlap(vehicleId, windowStart, windowEnd, ignoreBookingId) {
    const start = new Date(windowStart).getTime();
    const end = new Date(windowEnd).getTime();
    const bookings = await (0, repository_1.listBookings)({
        vehicleId,
        excludeStatuses: ["cancelled", "completed"]
    });
    return bookings.some((booking) => {
        if (booking.id === ignoreBookingId)
            return false;
        const bookingStart = new Date(booking.pickup_at).getTime();
        const bookingEnd = new Date(booking.drop_at).getTime();
        return start < bookingEnd && end > bookingStart;
    });
}
