"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertCanTransition = assertCanTransition;
const errors_1 = require("../../lib/utils/errors");
const transitions = {
    draft: ["pending_kyc", "payment_pending"],
    pending_kyc: ["payment_pending", "cancelled"],
    payment_pending: ["confirmed", "cancelled"],
    confirmed: ["ongoing", "cancelled"],
    ongoing: ["extension_requested", "completed", "cancelled"],
    extension_requested: ["extended", "cancelled"],
    extended: ["ongoing", "completed", "cancelled"],
    completed: [],
    cancelled: []
};
function assertCanTransition(from, to, action) {
    if (!transitions[from].includes(to)) {
        throw new errors_1.ApiException(409, "invalid_booking_transition", `Cannot move booking from ${from} to ${to} during ${action}.`);
    }
}
