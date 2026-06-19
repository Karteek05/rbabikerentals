"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const context_1 = require("../../../lib/auth/context");
const service_1 = require("../../../lib/payments/service");
const http_1 = require("../../../lib/utils/http");
async function POST(request) {
    try {
        const actor = await (0, context_1.requireActor)(request, ["admin"]);
        const body = await (0, http_1.parseJson)(request);
        const result = await (0, service_1.refundPaymentForBooking)({
            bookingId: body.booking_id,
            amount: body.amount,
            reason: body.reason,
            actor
        });
        return (0, http_1.ok)(result, 201);
    }
    catch (error) {
        return (0, http_1.fromError)(error);
    }
}
