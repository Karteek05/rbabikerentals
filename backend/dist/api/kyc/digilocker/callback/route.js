"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const service_1 = require("../../../../lib/kyc/service");
const errors_1 = require("../../../../lib/utils/errors");
const http_1 = require("../../../../lib/utils/http");
async function POST(request) {
    try {
        const expectedSecret = process.env.SETU_WEBHOOK_SECRET;
        const providedSecret = request.headers.get("x-setu-webhook-secret") ??
            request.headers.get("x-webhook-secret");
        if (!expectedSecret) {
            throw new errors_1.ApiException(500, "setu_webhook_secret_missing", "SETU_WEBHOOK_SECRET is missing.");
        }
        if (providedSecret !== expectedSecret) {
            throw new errors_1.ApiException(401, "invalid_callback_secret", "Invalid KYC callback secret.");
        }
        const body = await (0, http_1.parseJson)(request);
        const normalized = (0, service_1.normalizeKycCallbackPayload)(body);
        const updated = await (0, service_1.handleDigilockerCallback)(normalized);
        return (0, http_1.ok)({ kyc: updated });
    }
    catch (error) {
        return (0, http_1.fromError)(error);
    }
}
