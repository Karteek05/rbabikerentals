"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const service_1 = require("../../../lib/payments/service");
const http_1 = require("../../../lib/utils/http");
async function POST(request) {
    try {
        const rawBody = await request.text();
        const signature = request.headers.get("x-razorpay-signature");
        const result = await (0, service_1.processRazorpayWebhook)({ rawBody, signature });
        return (0, http_1.ok)(result);
    }
    catch (error) {
        return (0, http_1.fromError)(error);
    }
}
