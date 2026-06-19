"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listBookingsForAdmin = listBookingsForAdmin;
exports.rejectBooking = rejectBooking;
const service_1 = require("../../lib/audit/service");
const repository_1 = require("../../lib/data/repository");
const state_machine_1 = require("../../lib/bookings/state-machine");
const errors_1 = require("../../lib/utils/errors");
async function listBookingsForAdmin(filters) {
    return (0, repository_1.listBookings)({ status: filters?.status });
}
async function rejectBooking(bookingId, input, actor) {
    if (actor.role !== "admin") {
        throw new errors_1.ApiException(403, "forbidden", "Only admin can reject bookings.");
    }
    const booking = await (0, repository_1.getBookingOrThrow)(bookingId);
    const rejectableFrom = new Set(["pending_kyc", "payment_pending", "confirmed"]);
    if (!rejectableFrom.has(booking.status)) {
        throw new errors_1.ApiException(409, "invalid_state", `Cannot reject booking in status ${booking.status}.`);
    }
    (0, state_machine_1.assertCanTransition)(booking.status, "cancelled", "admin.reject_booking");
    const updated = await (0, repository_1.updateBooking)(booking.id, {
        status: "cancelled",
        cancel_reason: input.reason,
        updated_at: new Date().toISOString()
    });
    await (0, service_1.recordAudit)({
        actorId: actor.userId,
        actorRole: actor.role,
        action: "admin.booking_reject",
        resourceType: "booking",
        resourceId: booking.id,
        metadata: {
            reason: input.reason
        }
    });
    return updated;
}
